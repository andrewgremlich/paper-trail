# Paper Trail

A web-based timesheet and invoicing application that integrates with Stripe for invoice generation and payment processing.

## Reference

[Stripe SDK Invoice Doc](https://docs.stripe.com/api/invoices?lang=node)

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, CSS Modules, Zustand, TanStack React Query
- **Backend**: Cloudflare Workers with Hono
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Storage**: Cloudflare R2 (file attachments)
- **Auth**: Cloudflare Access (GitHub OAuth)
- **Payments**: Stripe API

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Create a `.dev.vars` file with the following variables:
   ```
   CF_ACCESS_BYPASS=true
   CF_ACCESS_DEV_EMAIL=dev@localhost
   ENCRYPTION_KEY=<base64-encoded 32-byte key>
   ```

   Generate an encryption key:
   ```bash
   openssl rand -base64 32
   ```

3. Create and seed the D1 database:
   ```bash
   pnpm run seed
   ```

4. Start the dev server:
   ```bash
   pnpm run dev
   ```
   The app is served at `http://localhost:5173`.

5. Store the Stripe secret key (for production):
   ```bash
   wrangler secret put STRIPE_SECRET_KEY
   ```

## Security

### Encryption at Rest

All sensitive financial data is encrypted using AES-256-GCM before being stored in D1. The encryption key is configured via the `ENCRYPTION_KEY` environment variable (Wrangler secret in production, `.dev.vars` locally).

**Encrypted fields:**
- **projects**: `customerId`, `rate_in_cents`, `description`
- **timesheets**: `invoiceId`, `description`
- **timesheet_entries**: `description`, `amount`
- **transactions**: `description`, `amount`
- **R2 files**: entire file contents

Unencrypted values are handled gracefully on read, so enabling encryption on an existing database works without migration.

### Other Security Measures

- Stripe API keys stored as Wrangler secrets, never in code or localStorage
- Authentication via Cloudflare Access (GitHub OAuth)
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
| `pnpm run seed` | Seed local D1 database |
| `pnpm run seed:remote` | Seed remote D1 database |
