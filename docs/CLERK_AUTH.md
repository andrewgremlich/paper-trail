# Clerk Authentication

Paper Trail uses [Clerk](https://clerk.com) for authentication. Clerk
handles the GitHub OAuth handshake, session management, JWT issuance,
and the sign-in UI; the Worker verifies the resulting JWT and isolates
data per Clerk user.

---

## Why Clerk

The previous setup put Cloudflare Access in front of the Worker.
Cloudflare Access works well for single-tenant internal apps, but it
hard-couples authentication to a Cloudflare Zero Trust org and only
exposes identity via an email header — not a stable user id. Clerk:

- Issues a stable `sub` (`user_…`) per identity, decoupled from the
  user's email address. Email changes don't break ownership.
- Ships drop-in `<SignIn />` / `<UserButton />` React components.
- Has first-class GitHub social login (plus Google, Apple, Microsoft,
  passkeys, etc. — flip on as desired in the dashboard).
- Provides a Backend API for user lookups when we provision a local
  row, and a JWKS endpoint for stateless JWT verification at the edge.

---

## Identity model

Every authenticated request carries a Clerk-issued JWT in
`Authorization: Bearer <token>`. The Worker:

1. Verifies the JWT signature against Clerk's JWKS (or against
   `CLERK_JWT_KEY` for networkless verification — see below).
2. Confirms `iss`, `exp`/`nbf`, and optionally `azp` (authorized
   party / frontend origin).
3. Reads `sub` — the Clerk user id — as the source of truth.
4. Looks up the local `users` row keyed by `clerkUserId`. On first
   sign-in (no row yet), it fetches the user's email + display name
   from the Clerk Backend API and INSERTs the row. Subsequent requests
   are 100 % local — no Clerk API calls.

This means **multiple users are first-class**: every D1 table already
carries a `userId` column and every query filters by it. Adding a
second user just requires them to sign in with Clerk; Paper Trail
provisions their row automatically and they can never see another
user's data.

### Email column behaviour

`users.email` still mirrors the verified primary email from Clerk. It
powers:

- The invoice snapshot seller block.
- Default email sender fallbacks.
- Export bundles.

If a user changes their primary email in Clerk we do **not** mutate
the local row automatically — the email is part of historical invoice
snapshots and should stay as-is. Display name is similarly cached at
sign-in and editable via Settings.

### Migration from Cloudflare Access

Any pre-Clerk `users` rows still exist with `clerkUserId IS NULL`. The
auth middleware patches them on first Clerk sign-in by matching on
email (an `UPDATE … WHERE email = ? AND clerkUserId IS NULL` so we
never accidentally overwrite an already-claimed row). After that the
user inherits all their previous projects/timesheets/invoices intact.

If you want to enforce a clean cutover, manually `DELETE` legacy rows
before re-enabling the new middleware.

---

## Setup

### 1. Create a Clerk application

1. Go to <https://dashboard.clerk.com> and create a new application.
2. Under **User & Authentication → Social Connections**, enable
   **GitHub**. Configure scopes to include `user:email` so we can
   resolve the primary email address. Disable any other connectors you
   don't want.
3. Optional but recommended: under **Sessions → Customize session
   token**, leave the defaults. The Worker only relies on `sub`, so a
   custom JWT template is not required.

### 2. Capture credentials

From the Clerk dashboard → **API Keys**:

| Value | Where it goes | Notes |
| --- | --- | --- |
| Publishable Key (`pk_test_…` / `pk_live_…`) | `VITE_CLERK_PUBLISHABLE_KEY` (Vite build env) | Embedded in the client bundle. Safe to commit to public configs. |
| Secret Key (`sk_test_…` / `sk_live_…`) | `CLERK_SECRET_KEY` (Wrangler secret) | Server-only. Used during first sign-in to fetch email + name. |
| Frontend API URL | `CLERK_ISSUER` (Wrangler var/secret) | The Clerk Frontend API host, e.g. `https://clerk.example.com` or `https://verb-noun-00.clerk.accounts.dev`. The JWT `iss` claim must match this exactly. |
| JWT Public Key (PEM) | `CLERK_JWT_KEY` (Wrangler secret, optional) | Enables networkless verification — skips the JWKS fetch on cold paths. Recommended for production. |

### 3. Configure local dev (`.dev.vars`)

The fastest way to iterate without setting up a Clerk instance is the
bypass mode:

```ini
CLERK_BYPASS=true
CLERK_DEV_USER_ID=user_dev_localhost
CLERK_DEV_EMAIL=dev@localhost.dev
```

With `CLERK_BYPASS=true` the Worker skips JWT verification entirely
and synthesises a single fake user. **Never set this in production.**

To exercise the real flow locally instead, populate the production
variables in `.dev.vars`:

```ini
CLERK_ISSUER=https://verb-noun-00.clerk.accounts.dev
CLERK_SECRET_KEY=sk_test_…
CLERK_JWT_KEY="""-----BEGIN PUBLIC KEY-----
…
-----END PUBLIC KEY-----"""
```

…and create a `.env.local` for Vite:

```ini
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
```

### 4. Configure production

1. Build-time env for the Worker bundle:
   ```bash
   wrangler secret put CLERK_ISSUER
   wrangler secret put CLERK_SECRET_KEY
   wrangler secret put CLERK_JWT_KEY         # optional, recommended
   wrangler secret put CLERK_AUTHORIZED_PARTY  # optional, e.g. https://paper-trail.example.com
   ```
2. Build-time env for the frontend (must be present when running
   `pnpm run build` so Vite inlines it):
   ```bash
   export VITE_CLERK_PUBLISHABLE_KEY=pk_live_…
   pnpm run deploy
   ```
   If you deploy through CI, plumb `VITE_CLERK_PUBLISHABLE_KEY` into
   the build job's environment.

---

## Networkless vs JWKS verification

The auth middleware supports two modes:

- **JWKS (default)** — when only `CLERK_ISSUER` is set, the Worker
  fetches `${CLERK_ISSUER}/.well-known/jwks.json` on cold start, caches
  the keys for one hour, and verifies every request against them. Key
  rotation is handled automatically — an unknown `kid` triggers one
  refresh.
- **Networkless** — when `CLERK_JWT_KEY` is set (the PEM-encoded public
  key from the dashboard), JWKS is never fetched. Verification is
  purely local crypto. Use this for production; it removes a per-cold-
  start outbound dependency and makes audits easier.

Both modes still require `CLERK_ISSUER` to be set so we can verify the
`iss` claim.

---

## Security properties

- **Signature-verified JWTs.** A request with no `Authorization`
  header, a malformed token, an expired token, a wrong-issuer token,
  or a forged signature is rejected with `401 Unauthorized`. The
  failure reason is logged server-side but never reflected to the
  client (a leaky 401 would help an attacker tune a forgery).
- **CORS locked to `APP_BASE_URL`.** Even with a stolen token, another
  origin can't read API responses from the user's browser.
- **`azp` pinning (optional).** Set `CLERK_AUTHORIZED_PARTY` to your
  production frontend origin to reject tokens minted for any other
  Clerk-protected application that happens to share the instance.
- **Per-user data isolation.** Every query in `api/src/routes/` is
  parameterised by `c.get("userId")`, which the middleware sets
  exclusively from the verified `sub` claim. No route can read or
  write another user's data.
- **No header trust.** Unlike the previous Cloudflare Access setup, no
  header value is ever trusted on its own. The only identity input is
  the verified JWT.

### Failure-closed config

If `CLERK_ISSUER` is unset *and* `CLERK_BYPASS` is not `true`, the
middleware returns `500` on every request. Partial configuration is
treated as a deployment bug, not as a silent fallback to anonymous
access.

---

## Files

| Path | Purpose |
| --- | --- |
| `api/src/middleware/auth.ts` | Clerk auth middleware (`clerkAuth`). Verifies the bearer token and resolves a local userId. |
| `api/src/lib/clerkJwt.ts` | RS256 JWT verification against JWKS or PEM, with caching. |
| `api/src/lib/clerkApi.ts` | Minimal Backend API client. Used on first sign-in only. |
| `api/db/migrations/0002_clerk_user_id.sql` | Adds the `clerkUserId` column + unique index. |
| `src/index.tsx` | Wraps the app in `<ClerkProvider>`. |
| `src/app/components/features/auth/SignInGate/` | Gates the app behind `<SignedIn>/<SignedOut>` and bridges the Clerk session token into `api` calls. |
| `src/app/components/layout/Nav/index.tsx` | Renders `<UserButton />` in the top-right. |
| `src/app/lib/db/client.ts` | API client; attaches `Authorization: Bearer <token>` via the registered token provider. |

---

## Troubleshooting

**`Unauthorized` on every request after sign-in.**
Check the Worker logs. If you see `Clerk JWT rejected { reason: 'bad_issuer' }`
then `CLERK_ISSUER` doesn't match the token's `iss` claim. Copy the value
out of `https://dashboard.clerk.com → API Keys → Frontend API`.

**`Authentication is not configured on the server` (HTTP 500).**
Neither `CLERK_ISSUER` nor `CLERK_BYPASS=true` is set on the Worker. In
production, set both `CLERK_ISSUER` and `CLERK_SECRET_KEY`.

**`Clerk user has no email address` on first sign-in.**
The Clerk GitHub connector wasn't requested with the `user:email` scope.
Re-configure the GitHub connection in the Clerk dashboard, then sign
out and back in.

**Local dev: `VITE_CLERK_PUBLISHABLE_KEY is not set`.**
Create `.env.local` at the repo root with that variable. Vite only
picks up env vars prefixed with `VITE_`.
