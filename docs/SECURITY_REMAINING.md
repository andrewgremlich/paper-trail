# Security follow-ups

This file tracks the findings from the comprehensive security review that
were **not** fixed in the two security-fix commits on
`claude/security-review-invoices-IyvHR`. Items are ordered by severity,
then by implementation cost.

> A second, broader review covering the post-Clerk / post-Stripe-removal
> codebase lives in
> [`docs/SECURITY_REVIEW_2026_05.md`](./SECURITY_REVIEW_2026_05.md). New
> findings (most notably H1 `CLERK_BYPASS` fail-open and H2 missing-
> `ENCRYPTION_KEY` fail-open) are tracked there. The defense-in-depth
> follow-ups at the bottom of this file (CSP header, secret rotation
> runbook, backup encryption, `workers.dev`) are still open.

## ✅ Already shipped on this branch

The two security commits closed everything **Critical** and **High** from
the review, plus the easy **Medium** items. Quick recap:

| # | Severity | Subject | Status |
|---|----------|---------|--------|
| §2 | Critical | Clerk session JWT verification (JWKS or PEM + RS256 + iss/azp/exp) | ✅ Shipped — auth migrated from Cloudflare Access to Clerk; see `docs/CLERK_AUTH.md` |
| §3 | High | CORS locked to `APP_BASE_URL` | ✅ Shipped |
| §4 | High | `/api/v1/files/*` ownership check (transactions FK + R2 metadata fallback) | ✅ Shipped |
| §5 | High | SSRF removed from `/files/check-link` (no outbound URL probing) | ✅ Shipped |
| §6 | High | `Referrer-Policy: no-referrer` on public invoice + consent pages | ✅ Shipped |
| §7 | Medium | CSRF tokens (synchronizer pattern) on consent + revoke POSTs | ✅ Shipped |
| §8 | Medium | `/customers/:id/request-consent` rate limit + 24h re-request back-off | ✅ Shipped |
| §9 | Medium | Zod schemas + FK ownership checks on transactions / projects / timesheets / timesheet entries | ✅ Shipped |
| §10 | Medium | File upload size (10 MB) + content-type allowlist | ✅ Shipped |
| §11 | Low | Constant-time invoice token comparison | ✅ Shipped |
| §12 | Low | UNIQUE indexes on `customers.revokeToken` + `invoices.accessToken` | ✅ Shipped |
| §13 | Low | Drop `tokenLast4` from audit-log payloads | ✅ Shipped |
| §14 | Low | HMAC-SHA-256 keyed by `ENCRYPTION_KEY` for IP/UA pseudonymisation | ✅ Shipped |
| §15 | Low | Atomic `/import/data` + `/import/zip` via `db.batch()` + `?confirm=true` | ✅ Shipped |
| §16 | Low | Pin `xlsx` to 0.18.5 + document write-only risk model | ✅ Shipped |

---

## 🟡 Remaining items

_All severity-tagged review findings have been addressed on this branch.
The items below are discussion-required follow-ups that need product input
before any code change._

### §12 (Low) — Add `UNIQUE` constraint on `revokeToken` and `accessToken` ✅ Shipped

**Where:** `api/db/migrations/0001_initial_schema.sql`, shipped as `0002_unique_token_indexes.sql`

`customers.consentToken` is `UNIQUE`. `customers.revokeToken` and
`invoices.accessToken` are not. Collisions are cryptographically improbable
(32 random bytes), but a future RNG bug would silently misroute lookups
instead of erroring out.

**Plan:**

1. Write a new migration `0002_unique_token_indexes.sql`:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_revokeToken_unique
     ON customers(revokeToken) WHERE revokeToken IS NOT NULL;
   CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_accessToken_unique
     ON invoices(accessToken) WHERE accessToken IS NOT NULL;
   ```
2. Apply locally with `pnpm run migrate` then remote with `pnpm run migrate:remote`.

**Effort:** ~10 minutes.

---

### §13 (Low) — Drop `tokenLast4` from audit-log payloads ✅ Shipped

**Where:** `api/src/routes/consent.ts` (3 sites), `api/src/routes/customers.ts` (1 site)

The encrypted `customer_events.payload` stores `tokenLast4: token.slice(-4)`.
That's 16 bits of a single-use token; useless to an attacker but also
useless to us in practice — there's no support flow that consumes it.

**Plan:** remove the `tokenLast4` field from the four `JSON.stringify` payloads. Existing rows are encrypted and stay readable; nothing migrates.

**Effort:** ~5 minutes.

---

### §14 (Low) — Use HMAC-SHA-256 instead of `H(salt || msg)` for IP/UA pseudonymisation ✅ Shipped

**Where:** `api/src/lib/hash.ts`

`hmacSha256Hex` is now the primary primitive; `sha256Hex` is kept exported only
so historical v1 rows can still be recomputed if needed. New audit-log
payloads carry `{ "v": 2, ... }` to mark the format.

`sha256Hex(input)` computes `SHA-256(ENCRYPTION_KEY || input)`. That's the
prefix-MAC construction, which is fine for SHA-256 but not the standard
primitive for "stable fingerprint of a string keyed by a secret". HMAC is.

**Plan:**

```ts
const key = await crypto.subtle.importKey(
  "raw",
  base64DecodeToBytes(env.ENCRYPTION_KEY),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const mac = await crypto.subtle.sign(
  "HMAC",
  key,
  new TextEncoder().encode(input),
);
```

**Caveat:** existing hashes in `customers.consentIpHash` / `consentUaHash`
/ `invoice_events.payload` were computed with the old construction. If we
want to preserve the ability to correlate historic events, we either:

  (a) keep the old function alongside the new one and use the new one for
      new writes only, or
  (b) rotate hashes (one-shot script) so old and new use the same
      primitive.

Option (a) is simplest; tag rows as v1 vs v2 (`{ "v": 2, ... }` in
payload) and dual-write briefly.

**Effort:** ~30 minutes + a deploy.

---

### §15 (Low) — Make `/import/data` and `/import/zip` atomic ✅ Shipped

**Where:** `api/src/routes/exportImport.ts`

Both endpoints now Zod-validate the entire payload, pre-encrypt every cell,
and submit the DELETEs+INSERTs as a single `db.batch()` so any failure
rolls the whole import back. Both also require `?confirm=true` so a stray
POST can't wipe data.

The import endpoints DELETE eight tables and then re-INSERT in eight more
loops. There's no atomic rollback — a malformed `data.json` that passes
the shape check but blows up mid-insert leaves the user with partial data
and no backup.

**Plan:** convert to D1 `.batch()`:

```ts
const stmts: D1PreparedStatement[] = [];

// Sanity-check the whole payload with Zod first — no destructive ops
// until we're confident the import will succeed.
const validated = ExportDataSchema.parse(data);

stmts.push(db.prepare("DELETE FROM invoice_events WHERE userId = ?").bind(userId));
// ...repeat the 7 other DELETEs...

for (const customer of validated.customers ?? []) {
  stmts.push(
    db.prepare("INSERT INTO customers (...) VALUES (?, ?, ...)").bind(...)
  );
}
// ...other tables...

await db.batch(stmts);
```

This requires resolving `await encrypt(...)` for every cell *before*
building the batch (encrypt isn't allowed mid-`bind`), which means a
prep pass that maps the rows through an async helper.

**Also recommended:**

- Require `?confirm=true` on the import POST so a stray frontend call
  doesn't wipe data.
- Validate the full payload with a `ExportDataSchema` Zod schema before
  any DELETE.

**Effort:** half a day. Worth it because data loss is irreversible.

---

### §16 (Low) — Audit the `xlsx` dependency ✅ Shipped

**Where:** `package.json` (now pinned to `xlsx 0.18.5` — no caret)

The dependency is pinned to an exact version so a patch release can't
silently land. The single use site (`api/src/routes/transactions.ts`)
carries a comment recording the write-only risk model: re-evaluate before
adding any code path that calls `XLSX.read*` on untrusted bytes.

SheetJS has had a track record of parse-time advisories. We only *write*
xlsx (in `api/src/routes/transactions.ts` and frontend exports), never
parse untrusted xlsx, so the parsing-path advisories don't currently
apply. Still worth doing one of:

1. Pin to a known-clean tag (the official CDN distribution, not the npm
   tarball, ships the same release with different supply-chain
   guarantees).
2. Replace with a writer-only library (e.g. `exceljs` with parser
   features disabled), or hand-roll a single-sheet XLSX writer — the
   wire format is documented and small.

**Effort:** an hour for option 1, half a day for option 3.

---

## 📋 Findings that need product input, not just code

### §6 follow-up — Hosted invoice token in URL path vs query string ✅ Shipped

Resolution: the public route now implements the cookie + 302 pattern
described as the "strongest fix". GET `/invoice/<id>?t=<token>` sets a
path-scoped HttpOnly cookie and 302s to `/invoice/<id>`; subsequent
requests authenticate via the cookie. Existing emailed `?t=` links
keep working; the token lives in the address bar for a single
request. Tracked as INV2 in `SECURITY_REVIEW_2026_05.md`.

---

### Defense-in-depth follow-ups

These are not findings from the review but obvious next steps:

- **CSP header** on the hosted invoice + consent pages: limit to `default-src 'self'; style-src 'unsafe-inline' 'self'; img-src 'self' data:; script-src 'none'`. The pages don't use JS today, so `script-src 'none'` is free hardening.
- **Secret rotation runbook**: document how to rotate `ENCRYPTION_KEY` (requires re-encrypting all encrypted columns + R2 objects under the new key — non-trivial, worth a script).
- **Backup encryption**: `pnpm run migrate:remote` and `wrangler d1 export` produce plaintext D1 snapshots if encryption is disabled, but the encrypted-at-rest values remain encrypted. Document the operator workflow.
- **`workers_dev = false`** in `wrangler.jsonc` once the custom-domain Access mapping is confirmed. Closes the workers.dev preview-URL exposure vector even if Access misconfigures.

---

## How to work through this list

§12–§16 are all shipped on this branch. The defense-in-depth follow-ups
above (CSP header, secret rotation runbook, backup encryption docs,
disabling `workers.dev`) remain open and can be picked up independently.
