# Production Readiness Audit — May 2026

Scope: a holistic readout of whether Paper Trail (Cloudflare Workers
+ Hono backend, React 19 + Vite frontend, D1 + R2, Clerk auth, Resend
email) is ready to run as a production service. Covers code quality,
security, deployment, observability, accessibility, and operations.

Date: 2026-05-16. Branch: `claude/audit-production-readiness-Z7jMd`.

## TL;DR

**Verdict: ready for single-operator personal use, NOT ready for
multi-user / paying-customer production.**

The application logic is in good shape. Security has been reviewed
twice (see `docs/SECURITY_REVIEW_2026_05.md` and
`docs/SECURITY_REMAINING.md`) and the high-severity items have been
closed. AES-GCM encryption-at-rest, Clerk JWT verification, CSRF,
rate limiting, per-user data isolation, atomic imports, and the
attachments-table-as-authority pattern are all in place. 213 frontend
tests pass; `tsc --noEmit` is clean.

The blockers are operational, not architectural:

1. **No CI for this project.** The only workflow in `.github/workflows/`
   is for a different repo (a Tauri desktop app called ProvelPrint).
   Nothing gates `pnpm run deploy` behind tests or lint.
2. **A live `console.log` inside a `.map()` is in the shipped Timesheets
   page** and Biome flags it as an error — it would have been caught by
   CI that doesn't exist.
3. **The Timesheets page has no error state** — if the query fails, the
   user sees a blank screen.
4. **No remote error tracking, no cron failure alerting.**
5. **No backup / DR runbook**, no custom domain, and the `workers.dev`
   preview URL is still publicly reachable.
6. **A handful of remaining Medium / Low security follow-ups** are
   tracked in `TODO.md` and `docs/SECURITY_REVIEW_2026_05.md` but not
   yet shipped.

Sections below break this down by area. Severity tags use
**Blocker / High / Medium / Low**.

---

## 1. Build, type-check, lint, tests

| Check | Status | Notes |
|-------|--------|-------|
| `pnpm install` | ✅ | Clean install on a fresh checkout |
| `tsc --noEmit` | ✅ | No type errors |
| `pnpm run check` (Biome) | ❌ | 1 warning: comma-operator in `Timesheets.tsx:53` |
| `pnpm run test` | ✅ | 213 tests pass across 27 files |
| API test coverage | ❌ | Zero tests under `api/` — the entire backend is untested |

### 1.1 Biome warning is a real bug — [Blocker]

`src/app/Timesheets.tsx:53` has:

```ts
timesheets.map(
  (timesheet) => (
    console.log(timesheet),       // ← comma-operator side-effect
    (<CardPreview … />)
  ),
)
```

This logs every timesheet to the browser console on every render of
the Timesheets page. PII (encrypted at rest, decrypted server-side,
returned over the wire to the authed user) ends up in the browser
console — fine for the operator, but it's a leftover debug statement
that should not have shipped. Biome correctly flags it. Fix: drop
both the `console.log` and the outer parens.

A second instance lives at
`src/app/components/features/timesheets/CreateTimesheetRecord/index.tsx:56`:

```ts
console.log(evt.target);
evt.target.reset();
```

Also debug code; can be removed.

### 1.2 No backend tests — [High]

27 test files exist, all under `src/app/components/` and `src/app/lib/`.
Nothing under `api/`. The backend includes the auth middleware, JWT
verification, AES-GCM encrypt/decrypt, CSRF, rate-limit, the invoice
snapshot renderer, the cron sweeper, and ~12 route modules — none of
it has any test coverage. The route logic is also the part of the
codebase most exposed to security regression.

Suggested floor for the next round of work:
- `api/src/lib/crypto.test.ts` — round-trip encrypt/decrypt, IV
  uniqueness, plaintext-passthrough on missing key.
- `api/src/lib/clerkJwt.test.ts` — clock-skew, issuer mismatch, alg
  pinning, malformed token rejection.
- `api/src/lib/csrf.test.ts` — token validate/issue cycle.
- `api/src/lib/rateLimit.test.ts` — per-recipient + per-user buckets.
- One end-to-end happy-path test per route module, using `unstable_dev`
  or a Hono test client.

### 1.3 `pnpm run check` only lints `./src` — [Low]

```
"check": "tsc --noEmit && npx @biomejs/biome check --write ./src"
```

`tsc --noEmit` covers the whole project, but Biome is scoped to `./src`
only. Backend code in `./api` is unformatted/unlinted by the same
script. Fix: change to `./src ./api` or drop the path argument.

---

## 2. CI / CD

### 2.1 No CI for Paper Trail — [Blocker]

`.github/workflows/publish.yml` is a Tauri build pipeline for a
desktop app called **ProvelPrint** (macOS / Windows / Apple Developer
codesigning). It belongs to a different repo and does nothing for
Paper Trail. There is **no** workflow that:

- runs `pnpm run check` on PR
- runs `pnpm run test` on PR
- runs `pnpm run deploy` on merge to `main`
- blocks merge on failures

The stray `console.log` from §1.1 would have been caught by any
of these. Deploys are 100% manual via `pnpm run deploy` from a
developer machine.

Recommendation: delete `publish.yml` (or move it out of this repo)
and replace it with a small `ci.yml` that runs `pnpm install`,
`pnpm run check`, `pnpm run test` on every PR, plus a `deploy.yml`
gated on `workflow_dispatch` or `push: main` that runs
`pnpm run deploy` with `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` as repo secrets.

### 2.2 No staging environment — [Medium]

`wrangler.jsonc` defines a `dev` env, but it points at a local D1
(`database_id: "local"`) and a local APP_BASE_URL. There is no
**remote** staging deploy — every change ships to the same production
worker on first deploy. For a single-operator system this is
acceptable; for any user-facing release process it is not.

### 2.3 Migrations have no rollback path — [Medium]

`api/db/migrations/` contains exactly one file
(`0001_initial_schema.sql`), squashed before any production data
existed. That's fine going forward, but there is no documented
pattern for safe rollbacks, no `--dry-run` style preview before
`pnpm run migrate:remote`, and no checkpoint/snapshot is taken
before applying migrations. A migration that breaks production is
not recoverable without manually restoring D1 state.

---

## 3. Security

The security posture is the strongest dimension of the project.
Both `docs/SECURITY_REVIEW_2026_05.md` and
`docs/SECURITY_REMAINING.md` already enumerate what's fixed and
what's open. Headline:

| Severity | Closed | Open |
|----------|--------|------|
| Critical | All | None |
| High | All (H1 CLERK_BYPASS guard, H2 ENCRYPTION_KEY fail-closed) | None |
| Medium | M1 ZIP-bomb caps, M2 per-recipient throttle, M3 unused deps | None |
| Low | L1–L11 all shipped | CSP rollout still partially open |
| Invoice-specific | INV1, INV2, INV4 shipped | INV5 doc-only |

### 3.1 Currently open security work — [Medium / Low]

From `TODO.md` and the two review docs:

- **CSP header rollout** on `/invoice/*` and `/consent/*` — the
  technical blocker (inline `onclick="window.print()"`) has been
  removed and headers have been added in `publicInvoice.ts` and
  `consent.ts`; double-check the rollout is live in production
  and not just on a feature branch.
- **`workers_dev = false`** in `wrangler.jsonc` — currently `true`,
  so `paper-trail.andrew-4ae.workers.dev` is reachable as a preview
  URL even after a custom domain is set up.
- **Secret rotation runbook** — `ENCRYPTION_KEY` rotation requires
  re-encrypting every encrypted column and every R2 object. No
  script and no runbook exist.
- **Backup-encryption story** — `wrangler d1 export` produces
  plaintext SQL; the encrypted columns stay ciphertext, but the
  rest of the export (IDs, timestamps, statuses, file metadata)
  is plaintext. No operator workflow is documented.

### 3.2 Auth bypass surface area — [Medium]

`CLERK_BYPASS=true` is documented in `.dev.vars.example` as the
default. The H1 mitigation refuses the bypass when `APP_BASE_URL`
isn't a localhost/workers.dev origin, which is the right behavior.
But the bypass is documented as the "quickest local dev" path in
`README.md` and `.dev.vars.example`, which trains operators to leave
it set. Two recommendations:

1. Add `console.warn` on every bypassed request so a misconfigured
   worker screams in Cloudflare logs (currently it logs only on the
   refusal path).
2. Consider making `CLERK_BYPASS` opt-out via a `CLERK_BYPASS_ACK`
   companion var.

---

## 4. Frontend code quality (`src/`)

### 4.1 Timesheets page has no loading / error state — [High]

`src/app/Timesheets.tsx:23-30` runs three `useQueries` in parallel and
then renders only `{timesheets && timesheets.length > 0 && ...}`. If
any query throws (network failure, auth expiry, 5xx), the page renders
a blank `<Main>` with no error message and no spinner. Customers,
Files, Transactions all handle loading + error correctly; Timesheets
is the outlier.

### 4.2 `window.alert()` used for user feedback — [Medium]

```
src/app/Files.tsx:54
src/app/Customers.tsx:74, 85, 89, 103
```

5 `window.alert()` calls block the UI, kill mobile UX, and don't fit
the rest of the app (which uses inline error states + dialog
components). Replace with toast notifications or inline error UI.
The Files / Customers pages already have proper loading + error
states next to these calls — the alerts are redundant.

### 4.3 Invoices table row is clickable but not keyboard-accessible — [High]

`src/app/Invoices.tsx` renders `<TR onClick={...} style={{cursor: "pointer"}}>`.
That violates the CLAUDE.md WCAG 2.1 AA mandate: the row has no
`role="button"`, no `tabIndex`, no `onKeyDown` for Enter/Space. Screen
reader users won't know the row is interactive, keyboard-only users
can't open it. Compare with `shared/CardPreview` (lines 29-30) which
implements this correctly — apply the same pattern.

### 4.4 `<TH>` elements missing `scope` attribute — [Medium]

The `Table/TH` primitive doesn't take or apply a `scope` attribute,
so no table in the app has `scope="col"` / `scope="row"` headers.
CLAUDE.md explicitly says: *"Tables must use `<th>` with `scope`
attributes for proper header association."* This is a one-line fix
in `src/app/components/ui/Table/index.tsx` plus passing `scope` from
call sites.

### 4.5 Error boundary leaks stack traces in production — [Medium]

`src/app/components/shared/ErrorBoundary/index.tsx` renders the full
React stack trace in its fallback UI. In production this exposes
internal file paths, component names, and minified bundle hints to
anyone who triggers an uncaught error. Limit the fallback to a
friendly message + "reload" button, and log the stack to the console
only.

The error boundary also calls `logErrorToMyService()` which only
console.errors — there is no remote error reporting (Sentry,
Logflare, etc.) integrated. Production errors are invisible unless
the operator happens to be reading Cloudflare logs.

### 4.6 API client has no retry / timeout / 401 handling — [Medium]

`src/app/lib/db/client.ts` is a single `fetch` per call:
- No `AbortController` → a hung worker request blocks the UI forever.
- No retry on 5xx → transient Cloudflare blips fail user actions.
- No special handling for 401 → an expired token surfaces as the
  same generic `ApiError` as a 400 bad input.

Suggest adding a 30-second `AbortController` timeout, one retry with
backoff on 5xx, and special-casing 401 to trigger Clerk's
`signOut()` flow.

### 4.7 `addCustomer(fd).then(() => {})` swallow — [Low]

`src/app/Timesheets.tsx:88` chains `.then(() => {})` to the customer-
create mutation. Failures throw but nothing catches them — they
bubble up to the global rejection handler with no UI feedback.

---

## 5. Backend code quality (`api/`)

The exploratory pass confirmed the backend is in good shape:

- **Auth + JWT**: RS256 pinned, `iss` / `azp` / `exp` / `nbf` / `iat`
  / `typ` all validated, clock skew handled, JWKS cached with `kid`
  refresh, networkless PEM mode supported. No header trust, no
  email-as-identity.
- **Encryption**: AES-GCM with 12-byte random IV, key import cached
  per isolate, graceful fall-through on legacy plaintext rows.
- **CORS**: Locked to `APP_BASE_URL`; credentials only reflected on
  allowed origins.
- **Validation**: Zod `safeParse` on every body-accepting endpoint.
  All authed queries are scoped by `userId` and use `.bind()`
  parameterised queries.
- **Files**: 10 MB cap, MIME allowlist, UUID R2 keys, attachments
  table is the single source of truth for R2 ownership, force
  `Content-Disposition: attachment` + `X-Content-Type-Options:
  nosniff`.
- **Scheduled handler**: bounded per run, idempotent R2 deletes,
  per-attachment error isolation.

### 5.1 `api/src/index.ts:82` uses `console.log` for the cron result — [Low]

```
console.log("attachment sweep complete", result);
```

Cron summary lines should be `console.info` or `console.warn` to
match what observability tooling collects, and there should be a
companion alarm when `result.errors > 0`. Currently the cron silently
swallows partial failures (the per-id `console.error` lines exist
but no aggregate signal makes it past the worker logs).

### 5.2 Stale endpoint at `exportImport.ts:768` (L6) — [Low]

Already tracked in `TODO.md`. `Number(uuid) === NaN`, so the endpoint
never matches a row. Fix or delete.

### 5.3 Type-loose `as any` at `clerkJwt.ts:122` — [Low]

Justified by a Cloudflare Workers field type that isn't surfaced in
the `@cloudflare/workers-types`. Has a `biome-ignore` comment. Fine,
but worth a TODO to remove once types catch up.

---

## 6. Observability and operations

### 6.1 No remote error tracking — [High]

No Sentry, Logflare, Datadog, or equivalent. The only signal is
Cloudflare's built-in `observability: { enabled: true }`, which gives
you the worker dashboard but no alerting, no aggregation by error
class, no breadcrumbs, and no frontend coverage at all. A 500 in the
worker shows up in the dashboard; a frontend uncaught exception does
not.

For a paying-customer system this is insufficient. For a personal
system it's a known trade-off worth documenting.

### 6.2 No cron failure alerting — [Medium]

`api/src/scheduled.ts` catches per-attachment errors with
`console.error` but never escalates an aggregate failure. If R2 is
hard-down for an hour, the operator sees nothing until a user
complains about an orphaned file.

Recommendation: at end of sweep, if `errors > 0`, send a single
Resend alert email to the operator (rate-limited to once per hour).
Reuses existing infrastructure; no new vendor.

### 6.3 Health check is minimal — [Low]

`GET /health` returns `{status: "ok", version: "v1"}` without
touching D1 or R2. A real readiness check would `SELECT 1 FROM
schema_migrations LIMIT 1` and `HEAD` a known R2 key — that's the
difference between "the worker booted" and "the worker can serve
traffic." For Cloudflare Workers this matters less than for K8s
(no liveness probes), but it's the only place to put an automated
synthetic check.

### 6.4 No backup / DR runbook — [High]

The README and CLAUDE.md document the encryption-at-rest story
thoroughly, but there is **no documented procedure for**:

- Taking a periodic D1 snapshot (the `wrangler d1 export` workflow).
- Restoring a D1 snapshot.
- Backing up R2 (or accepting that R2 attachments are
  considered-lost on R2 bucket loss).
- Rotating `ENCRYPTION_KEY` without data loss (re-encrypt script
  needed).
- What "data loss" actually looks like: which tables are most
  critical (invoices snapshot), which are reproducible.

For a single-operator system that's also using the `wrangler d1
export` ZIP/JSON export on the Settings page, this is workable.
For anything beyond that, write a runbook.

### 6.5 `workers.dev` preview URL still public — [Medium]

`wrangler.jsonc` doesn't set `workers_dev: false`. Even after pointing
a custom domain at the worker, `paper-trail.andrew-4ae.workers.dev`
remains reachable. This is benign right now (Clerk JWTs are the same
on both URLs and CORS is locked to `APP_BASE_URL`), but it widens the
attack surface for free.

### 6.6 No custom domain — [Medium]

`APP_BASE_URL` is currently `https://paper-trail.andrew-4ae.workers.dev`.
For a credible production service, point a custom domain at the
worker (and only then can `workers_dev: false` take effect).

---

## 7. Documentation

Strong. `CLAUDE.md`, `docs/CLERK_AUTH.md`, `docs/EMAIL_SETUP.md`,
`docs/FILE_HANDLING.md`, `docs/PRIVACY.md`, and the two security
review docs cover most of what an operator needs. Gaps:

- No runbook for "what do I do when X breaks" (D1 outage, R2 outage,
  Clerk outage, Resend bounces all my emails, encryption key
  compromised).
- No operator onboarding doc beyond the README "Setup" section.
- `TODO.md` doubles as both a roadmap and a security backlog —
  consider splitting.

---

## 8. Recommended fix order

| Order | Item | Severity | Effort |
|-------|------|----------|--------|
| 1 | Remove `console.log` in `Timesheets.tsx:53` and `CreateTimesheetRecord:56` | Blocker | 1 min |
| 2 | Replace `publish.yml` with a real `ci.yml` (check + test on PR) | Blocker | 1 hour |
| 3 | Add loading + error state to `Timesheets.tsx` | High | 30 min |
| 4 | Fix `<TR onClick>` accessibility on Invoices table | High | 30 min |
| 5 | Add `scope` attribute support to `Table/TH` primitive + apply | Medium | 1 hour |
| 6 | Replace `window.alert` calls with toast / inline UI | Medium | 1 hour |
| 7 | Add deploy workflow (`deploy.yml`) gated on `workflow_dispatch` | Medium | 1 hour |
| 8 | Wire up Sentry (or equivalent) for frontend + worker | High | 2 hours |
| 9 | Add at least crypto / clerkJwt / csrf / rateLimit tests under `api/` | High | half day |
| 10 | Cron failure alert via Resend | Medium | 30 min |
| 11 | Set `workers_dev: false` + point a custom domain | Medium | 30 min + DNS |
| 12 | Sanitise ErrorBoundary fallback (no stack in prod) | Medium | 15 min |
| 13 | API client: 30s timeout + 1 retry on 5xx + 401 → signOut | Medium | 1 hour |
| 14 | Write DR runbook (`docs/OPERATIONS.md`) | High | 2 hours |
| 15 | Burn down remaining items in `TODO.md` (L5 / L6 / `workers_dev`) | Low | 1 hour |
| 16 | Lint `./api` with Biome in `pnpm run check` | Low | 1 min |
| 17 | Stronger health check (`SELECT 1` + R2 HEAD) | Low | 30 min |

Items 1–4 are the minimum to call the current state "ready to ship
something" — none are big. Items 5–14 are what separates "running
the app" from "running a service."

---

## 9. What's already done well

In the spirit of fairness — this codebase has a lot going for it:

1. **The security model is genuinely solid.** Two thorough reviews
   have already been done and the headline findings are closed.
2. **AES-GCM at rest with graceful legacy passthrough.** Most
   self-hosted apps don't bother; this one does it correctly.
3. **The attachments table as authority for R2** removes a whole class
   of "orphaned blob" bugs.
4. **Constant-time comparisons** for tokens and CSRF nonces.
5. **The frozen invoice snapshot + sidecar status split** is the
   right design for an audit-trail-bearing invoice flow, and it's
   documented in `CLAUDE.md`.
6. **Zod everywhere.** No raw `req.body` reads, no string concatenation
   into SQL.
7. **Per-user data isolation** is consistent across all 12 route
   modules — every query is scoped by `userId`.
8. **Clerk JWT verification** with networkless PEM mode is a non-
   trivial primitive done well.
9. **Atomic imports via `db.batch()` + `?confirm=true`.**
10. **213 passing frontend tests across 27 files.** The UI primitives,
    feature components, and form behaviors all have coverage.
11. **`tsc --noEmit` is clean** across both frontend and backend.
12. **Component organisation** (`ui` / `layout` / `shared` / `features`)
    is consistent and the primitives are reusable.

The shortest summary: the *application* is well-built; the
*service around it* is incomplete.
