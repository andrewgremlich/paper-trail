# Paper Trail

A web-based timesheet and invoicing application. Tracks time and
expenses, generates hosted invoices, emails them through Resend with a
per-customer consent flow, and renders payment links for Venmo and
PayPal so the customer can settle the invoice out-of-band.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, CSS Modules, Zustand, TanStack React Query
- **Backend**: Cloudflare Workers with Hono
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Storage**: Cloudflare R2 (file attachments)
- **Auth**: [Clerk](https://clerk.com) (GitHub OAuth + others)
- **Email**: [Resend](https://resend.com) (invoice + consent delivery)
- **Payments**: Hosted invoice page links to Venmo / PayPal handles

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Create a `.dev.vars` file (Worker-side secrets) — see `.dev.vars.example`:
   ```ini
   ENCRYPTION_KEY=<base64-encoded 32-byte key>
   # Quickest local dev: bypass Clerk verification entirely
   CLERK_BYPASS=true
   CLERK_DEV_USER_ID=user_dev_localhost
   CLERK_DEV_EMAIL=dev@localhost.dev
   ```

   Generate an encryption key:
   ```bash
   openssl rand -base64 32
   ```

3. Create `.env.local` (Vite frontend env) so the React app can boot:
   ```ini
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
   ```
   Get the key from <https://dashboard.clerk.com> → API Keys. Required
   even with `CLERK_BYPASS=true` — the Clerk React SDK still needs to
   initialise.

4. Apply D1 migrations:
   ```bash
   pnpm run migrate
   ```

5. Start the dev server:
   ```bash
   pnpm run dev
   ```
   The app is served at `http://localhost:5173`.

6. Configure Clerk for production (required — see [docs/CLERK_AUTH.md](docs/CLERK_AUTH.md) for the full guide):
   ```bash
   wrangler secret put CLERK_ISSUER          # e.g. https://clerk.example.com
   wrangler secret put CLERK_SECRET_KEY      # sk_live_…
   wrangler secret put CLERK_JWT_KEY         # optional, enables networkless verification
   wrangler secret put CLERK_AUTHORIZED_PARTY  # optional, pin tokens to your frontend origin
   ```
   The Worker verifies the `Authorization: Bearer <token>` JWT on every
   request. Without `CLERK_ISSUER` (and without `CLERK_BYPASS=true` for
   dev) the API fails closed with HTTP 500 instead of trusting any
   unauthenticated identity.

   Enable GitHub OAuth in the Clerk dashboard under
   **User & Authentication → Social Connections → GitHub**. Include the
   `user:email` scope so the first-sign-in flow can resolve the user's
   primary email.

7. Configure Resend for production email — see [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md):
   ```bash
   wrangler secret put RESEND_API_KEY
   # also set RESEND_FROM_ADDRESS and APP_BASE_URL as vars in wrangler.jsonc
   ```
   A verified sending domain in Resend is required before any invoice
   or consent email will be accepted by the API.

## Security

### Encryption at Rest

All sensitive financial data is encrypted using AES-256-GCM before being stored in D1. The encryption key is configured via the `ENCRYPTION_KEY` environment variable (Wrangler secret in production, `.dev.vars` locally).

**Encrypted fields:**
- **users**: `venmoHandle`, `paypalHandle`, `businessName`, `businessAddress`, `resendApiKey`, `resendFromAddress`
- **customers**: `name`, `email`, `address`
- **customer_events**: `payload` (consent audit log)
- **projects**: `rate_in_cents`, `description`
- **timesheets**: `description`
- **timesheet_entries**: `description`, `amount`
- **transactions**: `description`, `amount`
- **invoices**: `amount_cents`, `description`, `snapshot` (frozen invoice JSON)
- **invoice_events**: `payload` (audit log incl. hashed viewer IP/UA)
- **attachments**: `originalName`
- **R2 files**: entire file contents

Unencrypted values are handled gracefully on read, so enabling encryption on an existing database works without migration.

### Other Security Measures

- Resend API key, Clerk secrets, and the encryption key are stored as Wrangler secrets, never in code or localStorage
- Authentication via Clerk — every API request carries a short-lived
  session JWT, signature-verified against Clerk's JWKS (or a configured
  PEM public key). The Clerk `sub` claim is the source of truth for
  identity; no headers are trusted on their own
- CORS restricted to `APP_BASE_URL` (no wildcard reflection of arbitrary origins)
- R2 file routes (`/api/v1/files/*`) authorise each request against the
  caller's `transactions.filePath` ownership; UUIDs are validated before lookup
- Public invoice and consent pages send `Referrer-Policy: no-referrer` to
  prevent per-invoice access tokens from leaking via Referer to Venmo/PayPal
- All database queries scoped by `userId` for multi-user data isolation
- Parameterized queries (D1 `.bind()`) to prevent SQL injection
- Sanitized file names and paths for attachments

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start local dev server (Vite + Workers runtime) |
| `pnpm run check` | TypeScript type checking + Biome linting/formatting |
| `pnpm run test` | Run Vitest tests |
| `pnpm run deploy` | Build and deploy to Cloudflare |
| `pnpm run migrate` | Apply D1 migrations locally |
| `pnpm run migrate:remote` | Apply D1 migrations to the remote D1 instance |
| `pnpm run enc:key` | Generate a fresh base64 AES-256 key for `ENCRYPTION_KEY` |
| `pnpm run knip` | Find unused exports / files / dependencies |

## Further Reading

| Doc | Topic |
|-----|-------|
| [docs/CLERK_AUTH.md](docs/CLERK_AUTH.md) | Clerk auth setup, JWT verification, dev bypass |
| [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md) | Resend domain verification + consent flow |
| [docs/FILE_HANDLING.md](docs/FILE_HANDLING.md) | Attachments table lifecycle + cron sweeper |
| [docs/PRIVACY.md](docs/PRIVACY.md) | What customer data we store and why |
| [docs/COMPONENT_ORGANIZATION.md](docs/COMPONENT_ORGANIZATION.md) | Frontend component layout |
| [docs/SECURITY_REMAINING.md](docs/SECURITY_REMAINING.md) | Security review follow-ups |
