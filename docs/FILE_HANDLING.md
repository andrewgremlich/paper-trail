# File Handling & Attachments

How Paper Trail tracks user-uploaded files (R2 objects) so that:

- No file can become orphaned without being noticed and cleaned up.
- Original filenames are preserved end-to-end (upload → list → download → export).
- File ownership has a single, authoritative source — not "scan three places and hope they agree."

## Big picture

Every uploaded file has exactly one row in the `attachments` table, keyed by the same UUID as the R2 object key. The DB row is the **lifecycle authority** — if it's there, the file is real and tracked; if it's gone, the R2 object is allowed to be deleted on the next sweep.

```
┌──────────────┐       ┌──────────────┐
│ attachments  │ ──┬─→ │  R2 object   │
│ (DB row)     │   │   │ (encrypted)  │
└──────────────┘   │   └──────────────┘
        │          │
        │ txId     │ FILES_BUCKET
        ↓          │
┌──────────────┐   │
│ transactions │ ──┘  R2 key == attachments.id == transactions.filePath
│  filePath    │
└──────────────┘
```

## Lifecycle states

A row's state is derived from two columns:

| State | `attachedAt` | `txId` | Meaning |
| --- | --- | --- | --- |
| **pending** | NULL | NULL | Just uploaded; user hasn't saved a transaction yet. |
| **attached** | NOT NULL | NOT NULL | Linked to a live transaction. |
| **orphaned** | NOT NULL | NULL | Was attached, then the transaction was deleted, the file was replaced, or the user removed the link. |

Transitions:

```
upload          ─→  pending
attach to tx    ─→  attached     (set attachedAt, set txId)
replace on tx   ─→  orphaned     (clear txId on the OLD attachment, attach the new one)
delete tx       ─→  orphaned     (FK ON DELETE SET NULL clears txId)
delete file     ─→  removed      (DB row + R2 object both deleted, by user action)
sweep           ─→  removed      (DB row + R2 object both deleted, by cron)
```

## The cron sweeper

Defined in [api/src/scheduled.ts](../api/src/scheduled.ts) and scheduled in [wrangler.jsonc](../wrangler.jsonc) (`triggers.crons`).

Default cadence: **every 15 minutes**.

Each run deletes:

- **Pending** rows older than `PENDING_TTL_MIN` (default: 60 minutes). Catches abandoned uploads — user closed the tab, lost connection, or never finished the transaction form.
- **Orphaned** rows older than `ORPHAN_GRACE_HOURS` (default: 24 hours). Gives the user a window to recover via the Files page before the file is permanently gone.

Bounded at `MAX_DELETES_PER_RUN` (500) per invocation so a runaway dataset can't blow Worker CPU/wall-time limits — leftovers get picked up on the next tick.

For each candidate, R2 is deleted **before** the DB row. If the R2 delete throws, the row stays so the next sweep retries. If the row delete fails after a successful R2 delete, the row stays as a dangling reference; the download endpoint returns 404 in that case and the next sweep cleans it up.

## Why this is bulletproof

The previous design tracked file ownership via `transactions.filePath` plus an in-memory `Map<key, userId>` for in-flight uploads. Four leak sites:

1. **Upload-then-close-tab** — pending Map entries expired but the R2 object stayed forever.
2. **Worker cold start** — the Map vanished, leaving uploads only reachable via `customMetadata.ownerUserId`.
3. **File replacement** — `UPDATE transactions SET filePath = newKey` silently abandoned the old R2 object.
4. **Transaction delete** — `DELETE FROM transactions` left the R2 object behind.

The new design closes all four:

- (1) Pending row lives in D1, not memory; cron sweeps it after `PENDING_TTL_MIN`.
- (2) Cold start has no effect on D1; the row is still there.
- (3) Transaction `PUT` orphans the previous attachment (`txId = NULL`); cron deletes it after the orphan grace period.
- (4) FK `ON DELETE SET NULL` orphans the attachment; same path as (3).

## Original filename

`attachments.originalName` is encrypted with the same AES-256-GCM helper as every other sensitive field ([api/src/lib/crypto.ts](../api/src/lib/crypto.ts)). Filenames frequently leak intent or subject matter (`tax_return_2025.pdf`, `medical_invoice.pdf`), so they're treated like `transactions.description`.

The download endpoint sets `Content-Disposition` using both forms for cross-browser support:

```
attachment; filename="ascii-fallback.pdf"; filename*=UTF-8''percent-encoded.pdf
```

- `filename=` is the ASCII fallback (older browsers). Non-ASCII characters and shell-unsafe characters are stripped via `sanitize-filename` and a regex.
- `filename*=UTF-8''…` is RFC 5987, the authoritative form for modern browsers — supports the full Unicode range.

The user always downloads the file with the name they uploaded it as.

## What's NOT encrypted, and why

| Column | Plaintext because |
| --- | --- |
| `id` | R2 lookup key — must be a literal match. |
| `userId`, `txId` | FKs — must be queryable for joins and the cron's `WHERE txId IS NULL` predicate. |
| `createdAt`, `attachedAt` | Used by the sweep's time-based predicates and by the Files page sort. Low sensitivity on their own. |
| `sizeBytes` | Needed for the storage-summary UI; size alone leaks little. |
| `contentType` | Needed for the Files page filter and to set the `Content-Type` header on download. Already inferable from R2 metadata. |

Consequence of encrypting `originalName`: server-side `WHERE name LIKE ?` and SQL `ORDER BY name` don't work. Same constraint as `transactions.description`. The Files page does any name filtering client-side.

## Authorization

The download/delete endpoints check exactly one thing:

```sql
SELECT 1 FROM attachments WHERE id = ? AND userId = ?
```

No transaction join, no `customMetadata.ownerUserId` fallback, no in-memory map. The `attachments` row is the source of truth for "this file belongs to this user."

The transaction `POST` and `PUT` handlers also verify the caller owns the attachment they're linking — without this check, a caller could attach another tenant's pending upload to their own transaction and then download it.

## Per-route summary

| Route | Effect on `attachments` |
| --- | --- |
| `POST /api/v1/files/upload` | Insert pending row, then write R2. |
| `GET /api/v1/files/:key` | Auth via `attachments.userId`; fetch original filename for `Content-Disposition`. |
| `DELETE /api/v1/files/:key` | Clear `transactions.filePath` if linked, delete row, delete R2 object. |
| `GET /api/v1/files/check-link` | Auth via `attachments.userId`. |
| `POST /api/v1/transactions` | Set `txId` + `attachedAt` on the linked attachment. |
| `PUT /api/v1/transactions/:id` | Orphan the previous attachment (`txId = NULL`); attach the new one. |
| `DELETE /api/v1/transactions/:id` | FK `ON DELETE SET NULL` orphans the attachment. |
| `GET /api/v1/attachments` | Lists all attachments for the user (hides <10min pending). |
| `GET /api/v1/attachments/summary` | Counts + total bytes for the Files page header. |
| `DELETE /api/v1/user-profile` | Deletes all R2 objects + attachment rows for the user. |
| Import | Inserts attachment rows alongside R2 puts so imported files are tracked. |
| Export | Reads `customMetadata.originalName` from R2 to name files in the zip. |

## Files page

[src/app/Files.tsx](../src/app/Files.tsx). Lives at `ProjectPageTab.Files`; reachable from the Nav.

Shows:
- Original filename, content type, size, upload date, status (Attached / Orphaned — will auto-delete / Upload abandoned).
- Header summary: total count, total bytes, and counts of orphaned / pending.
- Per-row Download (uses original filename) and Delete actions.

Pending rows under 10 minutes old are hidden — they're transient and would create noise. Anything older indicates an abandoned upload and is shown so the user can manually delete or wait for the sweeper.

## Tunables

All in [api/src/scheduled.ts](../api/src/scheduled.ts):

```typescript
const PENDING_TTL_MIN = 60;       // 1h grace for abandoned uploads
const ORPHAN_GRACE_HOURS = 24;    // 24h to recover an unlinked attachment
const MAX_DELETES_PER_RUN = 500;  // bound per cron invocation
```

Cron cadence: `wrangler.jsonc` → `triggers.crons`. Default `*/15 * * * *`. Cloudflare's minimum is `* * * * *` (every minute).

## Operational notes

- **Cron triggers don't fire in `wrangler dev`.** Test the sweeper either by triggering it manually with `wrangler dev --test-scheduled` and hitting `/__scheduled?cron=*/15+*+*+*+*`, or by deploying.
- **R2.delete is idempotent.** Re-running the sweep on the same set is safe.
- **The sweeper logs counts.** Watch `console.log("attachment sweep complete", …)` in the Workers dashboard.
- **The schema invariant:** every R2 key in the bucket SHOULD have a matching `attachments.id`. The only legitimate exceptions are objects mid-upload (between `db.run()` and `R2.put()` in the upload handler) and objects mid-delete. If you ever see persistent unmatched R2 keys in production, something has bypassed the upload route.
