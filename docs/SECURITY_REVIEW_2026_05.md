# Security review — May 2026

A comprehensive review of the post-Clerk, post-Stripe-removal codebase.
Scope: auth middleware, Clerk JWT verification, AES-GCM crypto module,
CSRF + rate limit + hash primitives, Zod validators, Resend wrapper,
email delivery, invoice HTML renderer, every route module under
`api/src/routes/`, the cron sweeper, the Hono entry point, and the
Wrangler config. Both the authenticated `/api/v1/*` surface and the
public `/invoice/*` + `/consent/*` surfaces.

**Headline:** no exploitable vulnerabilities found in the
request-handling paths. The hardening already shipped (constant-time
token compare, Zod everywhere, attachments-table-as-authority,
synchronizer-token CSRF on consent, JWT signature + iss/azp/exp, no-
referrer + nosniff on public pages) genuinely closes the obvious attack
surface. The items below are mostly **operational footguns** (silent
fail-open on misconfiguration), defense-in-depth gaps, and one DoS risk
on import.

Findings older than this review live in `docs/SECURITY_REMAINING.md`.
Items below that overlap with that doc are cross-referenced; the
defense-in-depth follow-ups from the previous review still stand.

---

## 🔴 High — fail-open on misconfiguration

### H1. `CLERK_BYPASS=true` deployed to production opens the whole app

**Location:** `api/src/middleware/auth.ts:47-50`

```ts
if (env.CLERK_BYPASS === "true") {
  clerkUserId = env.CLERK_DEV_USER_ID || "user_dev_localhost";
  bypassEmail = env.CLERK_DEV_EMAIL || "dev@localhost";
  ...
}
```

If `CLERK_BYPASS=true` ever lands as a production Worker var (stray
`wrangler deploy` after editing `.dev.vars`, a leaked deploy script,
or copy/paste from a how-to-run-locally README), the middleware skips
JWT verification entirely and provisions a single shared "dev user"
that every visitor authenticates as. Every visitor sees the same data.
There is no second gate.

**Recommendation.** Refuse to engage the bypass in any environment
whose `APP_BASE_URL` looks production-like (anything that isn't
`http://localhost*`, `http://127.0.0.1*`, or a `*.workers.dev` preview
URL), or require an explicit `CLERK_BYPASS_ACK=YES_I_KNOW_THIS_IS_DEV_ONLY`
companion var. Failing that, log `console.warn` on every bypassed
request so a misdeployed Worker screams in the Cloudflare logs.

```ts
if (env.CLERK_BYPASS === "true") {
  const base = env.APP_BASE_URL ?? "";
  const looksDev =
    base.startsWith("http://localhost") ||
    base.startsWith("http://127.0.0.1") ||
    base.includes(".workers.dev");
  if (!looksDev) {
    console.error("CLERK_BYPASS=true rejected — not a dev origin", { base });
    return c.json({ error: "Authentication is misconfigured" }, 500);
  }
  // …existing bypass logic
}
```

**Effort:** ~10 minutes. **Severity:** High (operational footgun).

---

### H2. Missing `ENCRYPTION_KEY` silently stores everything in plaintext

**Location:** `api/src/lib/crypto.ts:15-20`

```ts
export function isEncryptionEnabled(env: Env): boolean {
  return !!env.ENCRYPTION_KEY;
}
export async function encrypt(plaintext: string, env: Env): Promise<string> {
  if (!isEncryptionEnabled(env)) return plaintext;
  ...
}
```

The fall-through "return plaintext" path was added for the encryption
rollout, but it means a production deploy that forgets to set
`ENCRYPTION_KEY` writes every customer name, email, address, business
profile, invoice amount, line-item description, audit-log payload, and
R2 file body to D1/R2 in the clear — with no visible signal until you
read a row out and notice it isn't `enc:`-prefixed. The README calls
the key "required" but nothing enforces it at startup.

**Recommendation.** Fail closed in the auth middleware (and in a
sibling middleware that protects the public mounts). Once a deploy is
out of bypass mode, missing key is a deployment bug, not a graceful
degradation.

```ts
// In clerkAuth, before the bypass branch:
if (env.CLERK_BYPASS !== "true" && !env.ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY missing in production deploy");
  return c.json({ error: "Server is misconfigured" }, 500);
}
```

Add the same guard to `publicInvoiceRoutes` and `consentRoutes` (both
call `decrypt()` and would otherwise serve plaintext rows as if they
were encrypted).

**Effort:** ~15 minutes. **Severity:** High (silent data exposure).

---

## 🟡 Medium

### M1. ZIP import has no decompression-bomb defenses

**Location:** `api/src/routes/exportImport.ts:632-694`

```ts
const arrayBuffer = await c.req.arrayBuffer();
entries = unzipSync(new Uint8Array(arrayBuffer));
```

`unzipSync` is synchronous and materialises every entry up front.
Workers has a 128 MB memory cap and ~30 s CPU. A 50 MB zip with a 99 %
compression ratio expands to 5 GB and crashes the isolate. It's
self-targeted (the attacker is wiping their own account) and the
isolate gets recycled, but it's a cheap way to make Worker logs noisy
and to cost the operator CPU minutes.

**Recommendation.** Cap the request body, the total uncompressed size,
the per-entry size, and the entry count.

```ts
const MAX_ZIP_BYTES = 50 * 1024 * 1024;            // 50 MB compressed
const MAX_TOTAL_INFLATED = 200 * 1024 * 1024;      // 200 MB uncompressed
const MAX_ENTRIES = 5000;

if (arrayBuffer.byteLength > MAX_ZIP_BYTES) {
  return c.json({ error: "ZIP too large", code: "ZIP_TOO_LARGE" }, 413);
}
// after unzipSync:
const entryList = Object.entries(entries);
if (entryList.length > MAX_ENTRIES) {
  return c.json({ error: "ZIP has too many entries" }, 413);
}
let total = 0;
for (const [, bytes] of entryList) {
  total += bytes.byteLength;
  if (total > MAX_TOTAL_INFLATED) {
    return c.json({ error: "ZIP expands too large" }, 413);
  }
}
```

**Effort:** ~30 minutes. **Severity:** Medium (self-DoS).

---

### M2. Per-recipient consent-email throttle is missing

**Location:** `api/src/routes/customers.ts:200-307` + `api/src/lib/rateLimit.ts`

`assertWithinSendLimit` is a per-userId 30/hour budget shared across
invoice send and consent request. A user can spray 30 *distinct*
recipient addresses per hour with consent emails, each delivered from
the verified sending domain. The 24h re-request back-off
(`customers.ts:218-240`) only applies to the *same* customer.

Resend's domain reputation absorbs some of this, but the operator's
shared sending domain is the asset at risk. One bad-actor user can
torch the deliverability everyone else relies on.

**Recommendation.** Add a second throttle keyed by `(userId, lower(email))`
with a higher daily cap (e.g. 50 unique recipients/day for fresh
accounts, ramped up as their account ages). New table or
`send_rate_log.recipientHash` column.

**Effort:** ~1 hour. **Severity:** Medium.

---

### M3. Unused heavyweight dependencies still bundled

**Location:** `package.json:22, 24, 28, 31`

```json
"@tanstack/react-table": "^8.21.3",
"class-variance-authority": "^0.7.1",
"stripe": "^22.1.1",
"summit-kit": "^3.5.2",
```

`grep -r` finds zero imports of any of these in `src/` or `api/`. They
add npm install time, lockfile churn, CVE-watch surface, and (for
`stripe`) misleading "this app uses Stripe" signals. The May-2026 doc
sweep already corrected the docs; the package manifest is the last
holdout.

**Recommendation.**

```bash
pnpm remove stripe @tanstack/react-table summit-kit class-variance-authority
pnpm knip   # confirm nothing else is orphaned
```

**Effort:** ~5 minutes. **Severity:** Medium (supply-chain hygiene).

---

## 🟢 Low — defense in depth

### L1. JWT verification is missing `iat` and `typ` checks

**Location:** `api/src/lib/clerkJwt.ts:237-256`

Verifies `alg`, signature, `exp`, `nbf`, `iss`, optional `azp`, `sub`.
Doesn't pin `typ` (Clerk emits `typ=JWT`) and doesn't reject `iat` in
the far future. Both are belt-and-braces against forged tokens or
token confusion across Clerk's product surfaces.

```ts
if (header.typ && header.typ !== "JWT") throw new ClerkJwtError("malformed");
if (typeof payload.iat === "number" && payload.iat > nowSec + 60) {
  throw new ClerkJwtError("malformed");
}
```

### L2. `nbf` accepts 60 s of future skew, `exp` accepts zero

**Location:** `api/src/lib/clerkJwt.ts:238, 241`

```ts
if (typeof payload.exp !== "number" || payload.exp < nowSec) {
  throw new ClerkJwtError("expired");
}
if (typeof payload.nbf === "number" && payload.nbf > nowSec + 60) {
  throw new ClerkJwtError("not_yet_valid");
}
```

Asymmetric — a Worker whose clock is 30 s slow rejects freshly-issued
tokens that have just expired. Allow the same 60 s skew on `exp`:

```ts
if (typeof payload.exp !== "number" || payload.exp + 60 < nowSec) {
  throw new ClerkJwtError("expired");
}
```

### L3. `pickPrimaryEmail` can fall back to an unverified email

**Location:** `api/src/lib/clerkApi.ts:46-54`

```ts
const candidate = primary ?? user.email_addresses.find(
  (e) => e.verification?.status === "verified",
);
return candidate?.email_address ?? user.email_addresses[0].email_address;
```

If neither a primary nor any verified email exists, we pick the first
array element regardless of verification. That email is cached on
`users.email`, becomes the `replyTo` on outbound mail, and is embedded
in invoice snapshot "From" blocks.

**Recommendation:** require a verified email; throw a 500 with a clear
error if none exists.

### L4. No Content-Security-Policy on public pages

**Locations:** `api/src/routes/publicInvoice.ts:33-38`, `consent.ts:31-36`

`PUBLIC_PAGE_HEADERS` covers `Referrer-Policy`, `X-Content-Type-Options`,
`X-Frame-Options`, `Cache-Control` — not CSP. Stored XSS via
`invoiceHtml.ts` already requires bypassing `escapeHtml`, but CSP is a
strong second line. This is the same item flagged in
`docs/SECURITY_REMAINING.md` ("Defense-in-depth follow-ups").

**Blocker:** the print button at `invoiceHtml.ts:126` uses inline
`onclick="window.print()"`. Either move to an external script with a
per-request nonce, or drop the button (browsers offer Ctrl/Cmd-P).

Proposed header (once the inline handler is gone):

```
Content-Security-Policy: default-src 'none';
                         style-src 'unsafe-inline';
                         img-src 'self' data:;
                         form-action 'self';
                         base-uri 'none';
                         frame-ancestors 'none'
```

### L5. `timesheetImportSchema` uses `active`, but the column is `closed`

**Location:** `api/src/routes/exportImport.ts:45-53` vs `:312`

```ts
const timesheetImportSchema = z.object({
  ...
  active: boolOrNumber,    // ← schema field
  ...
});
// later in the batch builder:
ts.closed ? 1 : 0,         // ← reads a field the schema doesn't define
```

Result: every imported timesheet lands with `closed=0`. The export
side correctly emits `closed`, so a round-trip silently loses closed
state on every timesheet.

**Recommendation:** rename the schema field to `closed`. Accept both
spellings during a transition window so older backups still import.

### L6. `/api/v1/export/transactions` coerces a UUID `projectId` to `Number`

**Location:** `api/src/routes/exportImport.ts:768`

```ts
.bind(Number(projectId), userId)
```

`projectId` is a UUID. `Number("abc-…") === NaN`. The bind matches no
rows. Stale code from before the integer-id → UUID migration. Not a
security issue; the endpoint is effectively dead. Either fix or
delete.

### L7. Chained-FK queries don't re-scope to `userId`

**Representative locations:**

| File | Line | Query |
|------|------|-------|
| `invoices.ts` | 517 | `SELECT … FROM customers WHERE id = ?` (during send) |
| `invoices.ts` | 720 | `SELECT projectId FROM timesheets WHERE id = ?` (during pay) |
| `publicInvoice.ts` | 119 | `SELECT … FROM customers WHERE id = ?` (draft render) |

Safe today because the inbound FK was already validated under `userId`
on an upstream insert. Adding `AND userId = ?` to every join is cheap
insurance against a future refactor that breaks an upstream check.

### L8. No explicit HSTS or `Cache-Control` on authenticated responses

**Location:** `api/src/index.ts`

Cloudflare's edge typically adds HSTS on managed domains, but the
Worker itself doesn't set it. Authenticated JSON responses with
customer PII don't set `Cache-Control: no-store`, relying on the
absence of cacheable headers.

**Recommendation:** add a tiny middleware to `v1`:

```ts
v1.use("/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
});
```

### L9. `getKey()` re-imports the AES key on every call

**Location:** `api/src/lib/crypto.ts:5-13`

`crypto.subtle.importKey` runs on every `encrypt()` / `decrypt()` /
`encryptBuffer()` / `decryptBuffer()`. Not a vulnerability — but a
measurable per-request cost on list endpoints that decrypt N rows.
The imported `CryptoKey` is non-extractable so caching it per isolate
is safe:

```ts
let cachedKey: { material: string; key: CryptoKey } | null = null;

async function getKey(env: Env): Promise<CryptoKey> {
  if (cachedKey?.material === env.ENCRYPTION_KEY) return cachedKey.key;
  const rawKey = Uint8Array.from(atob(env.ENCRYPTION_KEY), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
  cachedKey = { material: env.ENCRYPTION_KEY, key };
  return key;
}
```

### L10. CSRF cookie is shared between consent and revoke flows

**Location:** `api/src/lib/csrf.ts:23, 32-42`

Both `/consent/:token` and `/consent/revoke/:token` issue and read the
same `pt_consent_csrf` cookie. With both pages open in the same
browser, the later-issued nonce overwrites the earlier one and the
older page's POST 403s. Usability glitch, not a vulnerability. Either
scope cookies separately (`pt_consent_csrf` vs `pt_revoke_csrf`) or
accept the trade-off.

### L11. Draft invoice preview has no token gate

**Location:** `api/src/routes/publicInvoice.ts:81-91`

```ts
if (row.snapshot) {
  const providedToken = c.req.query("t");
  const expected = row.accessToken;
  if (!expected || !providedToken || !constantTimeEqual(providedToken, expected)) {
    return notFound;
  }
}
// …falls through to draft rebuild path when snapshot is null
```

The token check is inside `if (row.snapshot)`. Draft invoices have a
NULL snapshot, so they bypass the token check entirely. The comment
on the route says "drafts are tokenless because they are only ever
opened from the authenticated app via Preview" — but the route is
mounted on the public `app`, not under `/api/v1`, so it doesn't run
through `clerkAuth`. Anyone with the invoice UUID can fetch a draft
preview rebuilt from live data: seller's business name + address +
email + Venmo + PayPal handles, customer's name + email + address,
line-item descriptions, invoice number, amount, due date.

The invoice UUID is 256-bit-random and unguessable, but it ends up in
the operator's clipboard, browser history, screen shares, and
screenshots. Security-through-obscurity.

**Recommendation:** serve drafts only from an authenticated route
(`GET /api/v1/invoices/:id/preview` behind `clerkAuth`) and reserve
the public `/invoice/:id` for sent invoices that require a token.
The hosted route would 404 on any invoice with `snapshot IS NULL`.

**Effort:** ~30 minutes (new authed route + frontend pointer change).
**Severity:** Low (gate via obscurity, not a vulnerability per se).

---

## 📨 Invoice-specific hardening

The hosted invoice flow has its own cluster of trust assumptions worth
documenting and (in some cases) tightening. None of these are
exploitable vulnerabilities — they're design boundaries that should be
deliberate.

### INV1. `accessToken` has no expiry

**Location:** `api/src/routes/invoices.ts:596-662`, `publicInvoice.ts:81-91`

`accessToken` is set on `/send` (rotated on resend) and never expires.
A paid invoice from two years ago is still openable by anyone the
email got forwarded to. The hosted page exposes the full snapshot:
seller PII, customer PII, line items, amount.

**Recommendation:** add `accessTokenExpiresAt` (or compute it: e.g.
`sentAt + 90 days`, or `paidAt + 30 days` once paid). The hosted route
checks the expiry and 404s after it passes. Operator can re-issue by
re-sending.

**Effort:** ~1 hour (column + migration + check). **Severity:** Low.

### INV2. Token in URL query string lands in logs

Existing follow-up in `docs/SECURITY_REMAINING.md` ("§6 follow-up —
Hosted invoice token in URL path vs query string"). Repeated here for
completeness: the `?t=<token>` form means the token appears in proxy
logs, CDN access logs, and browser history. Path-segment
(`/invoice/<id>/<token>`) is marginal. The strongest fix is the
signed-cookie + 302-to-bare-URL pattern: GET `/invoice/<id>?t=<token>`
sets an HttpOnly cookie and 302s to `/invoice/<id>`; subsequent
requests authenticate via the cookie. Adds complexity, doesn't break
existing emailed links.

**Effort:** ~half-day. **Severity:** Low.

### INV3. Draft invoice preview has no token gate

See L11 above. Cross-listed here because it's an invoice-flow gap.

### INV4. Email prefetch poisons the `viewed` event signal

**Location:** `api/src/routes/publicInvoice.ts:204-223`

Gmail, Outlook, Apple Mail, and corporate URL scanners prefetch links
in incoming email. Every prefetch is logged as a `viewed` event with
a hashed IP. The operator-facing "your customer opened the invoice"
signal therefore fires before the customer has actually seen it —
sometimes long before, sometimes by a bot that never shows it to a
human.

**Recommendation:** move logging from the initial GET to a confirmation
beacon. Either:
- Render the page, include a tiny `<img>` to `/invoice/<id>/seen?t=…`
  that the email-prefetcher won't fire (most prefetchers fetch the
  primary URL only); log on the beacon.
- Or: delay-log on the server side by 5-10s and de-duplicate
  consecutive views from the same hashed IP within a window.

**Effort:** ~1 hour. **Severity:** Informational (signal quality, not
security).

### INV5. Hosted URL is freely shareable; trust model isn't documented

The customer can forward the invoice email to anyone, and the
forwarded recipient can hit Venmo/PayPal links to pay the user. Two
parties could each click "Pay" and the user gets double-paid (or under-
paid, since Venmo/PayPal let the payer edit the amount on their side
before confirming).

This is intentional for the "send the same link to a customer + their
bookkeeper" workflow, but it's an implicit trust assumption: the
operator manually verifies the actual amount cleared before marking
paid. Not exploitable, but worth documenting in `CLAUDE.md` next to
the "Invoices & Email Delivery" section so it doesn't surprise a
future operator.

**Effort:** ~5 minutes (docs only). **Severity:** Informational.

---

## ⚪ Informational

- **AES-GCM IV-reuse bound.** Random 12-byte IV with a single key is
  safe to ~2³² encryptions before birthday-bound IV collision becomes
  meaningful. At single-tenant scale this is decades away. At
  multi-tenant SaaS scale, prefer a per-row nonce + counter scheme or
  per-user subkeys.
- **JWKS fetch thundering herd.** First request after a cold start (or
  a `kid` rotation) triggers `fetchJwks`. Concurrent requests in the
  same isolate each fire one. Coalesce with an in-flight Promise cached
  in `jwksCache`.
- **`send_rate_log` purge runs three writes per send** (trim + count +
  insert). Acceptable at current scale.
- **Customer name/email/address ciphertext defeats server-side search.**
  Documented limitation. Files page already filters client-side; if
  the customers list grows, plan for either client-side filtering or a
  deterministic blind-index column.
- **`workers.dev` preview URL is still reachable.** Already tracked in
  `docs/SECURITY_REMAINING.md`. Lower priority now that auth is
  Clerk-JWT (both URLs are equally protected) but still preview-URL
  exposure.

---

## ✅ Positive findings (what's done well)

1. **End-to-end JWT verification.** RS256 pinned via header check,
   signature verified against JWKS or PEM, `iss` / `exp` / `nbf` /
   `azp` / `sub` all validated, generic 401 to the client with the
   detailed reason logged server-side.
2. **`sub` is the only identity source.** No header trust, no
   email-as-identity ambiguity.
3. **Failure-closed on misconfig (mostly).** Missing `CLERK_ISSUER`
   returns 500, not anonymous access. The remaining gap is
   `ENCRYPTION_KEY` (H2).
4. **CORS locked to `APP_BASE_URL`** with credential reflection refused
   on unknown origins.
5. **Constant-time comparisons** for `accessToken`
   (`publicInvoice.ts:87`) and CSRF nonces (`csrf.ts:63`).
6. **HMAC-SHA-256 IP/UA pseudonymisation** with v2 audit-log payload
   markers for the migration off the old `H(salt || msg)`.
7. **Attachments table is the single source of truth** for R2
   ownership — no in-memory map, no metadata fallback as primary auth.
   The cron sweeper closes every leak path.
8. **Zod validation on every body-accepting authenticated endpoint**,
   plus FK ownership helpers (`userOwnsProject` / `userOwnsTimesheet`
   / `userOwnsCustomer`) for cross-table writes.
9. **Public hosted invoice page** uses an immutable encrypted
   snapshot, hides existence on token mismatch (same 404 as
   "doesn't exist"), and HTML-escapes every interpolated field in the
   renderer.
10. **CSRF + 24h consent re-request back-off + 30/hour send rate
    limit** all in place.
11. **File downloads force `Content-Disposition: attachment` +
    `nosniff`** so an uploaded `image/jpeg` that's secretly HTML can't
    run on origin.
12. **Atomic import via `db.batch()` + `?confirm=true`** — partial
    failures roll the whole import back and leave previous data
    intact.

---

## Recommended fix priority

| Order | Item | Effort | Severity | Rationale |
|-------|------|--------|----------|-----------|
| 1 | H2 — `ENCRYPTION_KEY` fail-closed | ~15 min | High | One-line gate, highest ROI; eliminates silent plaintext storage |
| 2 | H1 — `CLERK_BYPASS` guard | ~10 min | High | One-line gate; eliminates fail-open auth |
| 3 | L4 + CSP rollout (drop or nonce the inline `onclick`) | ~1 hour | Low | Big defence-in-depth lift; long-tracked |
| 4 | M1 — ZIP-bomb caps | ~30 min | Medium | Cheap and self-contained |
| 5 | L11 — gate draft invoice preview behind `clerkAuth` | ~30 min | Low | Removes a security-through-obscurity gate on PII |
| 6 | L5 — timesheet `active` / `closed` mismatch | ~10 min | Low | Silent correctness bug; ship while you're already in `exportImport.ts` |
| 7 | M3 — unused-deps removal | ~5 min | Medium | Pure cleanup; shrinks supply-chain surface |
| 8 | INV1 — `accessToken` expiry | ~1 hour | Low | Bounds the leak window on forwarded invoice emails |
| 9 | L1 / L2 / L3 / L7 — JWT + ownership DiD | ~30 min | Low | Bundle into one PR |
| 10 | INV5 — document shareable-URL trust model in `CLAUDE.md` | ~5 min | Informational | Done in the May 2026 doc sweep |
| 11 | M2 — per-recipient consent throttle | ~1 hour | Medium | Protects sending-domain reputation |
| 12 | INV4 — beacon-based `viewed` event logging | ~1 hour | Informational | Signal quality, not security |
| 13 | INV2 — token off the query string | ~half-day | Low | Long-tracked; needs care to keep existing emailed links working |
| 14 | L8 / L9 / L10 — headers, key cache, CSRF cookies | ~30 min | Low | Polish |

H1 + H2 are roughly five lines of code combined and would be a sensible
immediate commit. Everything below the line is non-blocking.
