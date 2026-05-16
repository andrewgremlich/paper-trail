# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paper Trail is a web-based timesheet and invoicing application built
with Cloudflare Workers (Hono backend) and React 19 (TypeScript
frontend). It tracks time and expenses, generates self-hosted invoices
rendered from a frozen JSON snapshot, emails them via Resend (after a
per-customer consent flow), and renders Venmo / PayPal deep links on
the hosted invoice page so customers can pay out-of-band. Stripe is
**not** part of the current architecture — invoice lifecycle and
payment tracking live entirely in D1.

## Build & Development Commands

```bash
# Local development (Vite + Cloudflare Workers runtime via @cloudflare/vite-plugin)
# Access at http://localhost:5173 — auth is bypassed via .dev.vars
pnpm run dev

# Type checking and formatting
pnpm run check

# Run tests
pnpm run test

# Run a single test file
npx vitest run src/app/lib/utils.test.ts

# Deploy (builds frontend + deploys worker with static assets)
pnpm run deploy

# Apply D1 migrations (local)
pnpm run migrate

# Apply D1 migrations (remote)
pnpm run migrate:remote
```

### Local Development Notes
- `pnpm run dev` runs `vite dev` — the `@cloudflare/vite-plugin` runs the Workers runtime inside Vite's dev server
- The app is served at `http://localhost:5173` (Vite serves both static assets and the API worker)
- Dev environment variables come from `.dev.vars` — sets `CLERK_BYPASS=true` and `CLERK_DEV_EMAIL=dev@localhost.dev` to bypass Clerk auth. The frontend still needs `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local` so the Clerk React SDK initialises (see `docs/CLERK_AUTH.md`)
- API routes (`/api/*`) are handled by the worker via `run_worker_first` in `wrangler.jsonc`
- All other routes fall through to the SPA via `not_found_handling = "single-page-application"`

## Architecture

### Frontend (`src/`)
- **React 19** with TypeScript, built with **Vite**
- **Zustand** for state management (persisted to localStorage)
- **TanStack React Query** for async data fetching
- **CSS Modules** for component styling (no Tailwind)
- **Zod** for validation, **date-fns** for date utilities, **sanitize-filename** for file safety
- Path aliases: `@/components/*`, `@/lib/*`, `@/*` map to `src/app/`

### Backend (`api/`)
- **Cloudflare Workers** with **Hono** web framework
- **Cloudflare D1** (SQLite) database
- **Cloudflare R2** for file storage (transaction attachments)
- **Clerk** (GitHub OAuth + other connectors) for authentication — see `docs/CLERK_AUTH.md`
- **Resend** for invoice + consent email delivery — see `docs/EMAIL_SETUP.md`
- **Cron trigger** (`*/15 * * * *`) runs the attachment sweeper in `api/src/scheduled.ts` — see `docs/FILE_HANDLING.md`
- Database migrations in `api/db/migrations/` (currently a single squashed `0001_initial_schema.sql`)

### Key Data Flow
1. Frontend calls API endpoints via `src/app/lib/db/client.ts` — attaches Clerk session JWT as `Authorization: Bearer <token>` via a token provider registered from `<SignInGate>`
2. Clerk authenticates user via GitHub OAuth (or other connectors); the React SDK manages session state and token rotation
3. Auth middleware (`api/src/middleware/auth.ts`) verifies the bearer token against Clerk's JWKS (or PEM), reads `sub`, looks up or provisions the local `users` row by `clerkUserId`, and sets `userId` in context
4. Route handlers in `api/src/routes/` perform D1 queries with userId isolation; sensitive columns are encrypted on write and decrypted on read via `api/src/lib/crypto.ts`
5. Invoice send / consent request goes through `api/src/lib/resend.ts` (with per-user override from `users.resendApiKey`, falling back to the shared `RESEND_API_KEY` env var)
6. File uploads/downloads go through `api/src/routes/files.ts`, backed by R2; the `attachments` table is the lifecycle authority (see `docs/FILE_HANDLING.md`)
7. Public, unauthenticated customer-facing routes (`/invoice/*`, `/consent/*`) are mounted **outside** the auth middleware and use single-use tokens for access

### Key Files to Understand
- `src/index.tsx` - App bootstrap: wraps in `<ClerkProvider>`, `<QueryClientProvider>`, `<ErrorBoundary>`, `<SignInGate>`
- `src/app/index.tsx` - Tab-switch component (rendered inside the layout)
- `src/app/lib/store.ts` - Zustand state management for UI (activeTab, activeModal, theme), persisted to localStorage
- `src/app/lib/db/client.ts` - API client (fetch wrapper) that attaches the Clerk bearer token via a registered provider
- `src/app/lib/db/types.ts` - Frontend entity types (Project, Timesheet, Transaction, Customer, Invoice, Attachment, UserProfile, etc.)
- `src/app/lib/types.ts` - The `ProjectPageTab` enum (the only shared frontend-only types)
- `api/src/index.ts` - Hono app entry point, route mounting, CORS, cron handler
- `api/src/scheduled.ts` - Cron sweep that cleans up pending + orphaned attachments
- `api/src/lib/db.ts` - D1 database binding accessor
- `api/src/lib/types.ts` - Backend types: `Env` binding shape + entity types incl. `InvoiceSnapshot`
- `api/src/lib/crypto.ts` - AES-256-GCM encrypt/decrypt for column values and R2 file bodies
- `api/src/lib/clerkJwt.ts` - Clerk JWT verification (RS256 against JWKS or PEM, with caching)
- `api/src/lib/clerkApi.ts` - Minimal Clerk Backend API client (first-sign-in only)
- `api/src/lib/resend.ts` - Resend HTTP client + error mapping
- `api/src/lib/emailDelivery.ts` - Higher-level send wrapper used by invoice + consent routes
- `api/src/lib/invoiceHtml.ts` - Hosted invoice HTML renderer (consumes an `InvoiceSnapshot`)
- `api/src/lib/csrf.ts` - Synchronizer-token CSRF for unauthenticated consent + revoke POSTs
- `api/src/lib/rateLimit.ts` - 30 sends/hour throttle for invoice + consent emails
- `api/src/lib/hash.ts` - HMAC-SHA-256 helper for IP/UA pseudonymisation in audit logs
- `api/src/lib/validators.ts` - Zod schemas shared across route handlers
- `api/src/middleware/auth.ts` - Clerk auth middleware (`clerkAuth`)
- `api/src/routes/` - All API route handlers (see "API routes" below)
- `api/db/migrations/` - Database migrations
- `src/app/components/features/auth/SignInGate/` - Gates the app behind Clerk sign-in and bridges the session token into the API client
- `wrangler.jsonc` - Cloudflare Workers config (D1, R2 bindings, cron triggers, static assets, `run_worker_first` paths)

### API Routes (Hono modules under `api/src/routes/`)

| File | Mount | Notes |
|------|-------|-------|
| `projects.ts` | `/api/v1/projects` | Authed |
| `timesheets.ts` | `/api/v1/timesheets` | Authed |
| `timesheetEntries.ts` | `/api/v1/timesheet-entries` | Authed |
| `transactions.ts` | `/api/v1/transactions` | Authed; also writes xlsx export |
| `customers.ts` | `/api/v1/customers` | Authed; consent request lives here |
| `invoices.ts` | `/api/v1/invoices` | Authed; create, send, mark paid/void, list events |
| `files.ts` | `/api/v1/files` | Authed; upload/download/delete R2 objects |
| `attachments.ts` | `/api/v1/attachments` | Authed; list + summary for the Files page |
| `exportImport.ts` | `/api/v1/export` and `/api/v1/import` | Authed; zip + JSON round-trip |
| `userProfile.ts` | `/api/v1/user-profile` | Authed; business info, Venmo/PayPal handles, per-user Resend creds |
| `publicInvoice.ts` | `/invoice/*` | **Unauthed**; hosted invoice page, token-gated |
| `consent.ts` | `/consent/*` | **Unauthed**; per-customer consent + revoke pages |

### Database Tables
All user-owned tables include a `userId` column for multi-user data
isolation. The full schema lives in
`api/db/migrations/0001_initial_schema.sql` (the original migrations
were squashed before any production data existed).

- `users` - User accounts (displayName, email, uuid, clerkUserId, Venmo/PayPal handles, business info, per-user Resend creds). Auto-created on first sign-in by `clerkAuth` middleware. Identified by `clerkUserId` (stable Clerk `sub`).
- `customers` - Invoice recipients (name, email, address) with per-customer consent state + single-use revoke token
- `customer_events` - Consent audit log (`consent_requested`, `consent_granted`, `consent_declined`, `consent_revoked`)
- `projects` - Work streams linked to a customer, with an hourly rate
- `timesheets` - Time tracking documents linked to projects
- `timesheet_entries` - Individual work entries (date, minutes, description, amount)
- `transactions` - Expense/income tracking separate from timesheets; optional R2 file attachment
- `attachments` - Lifecycle authority for R2 file objects (pending → attached → orphaned). Source of truth for file ownership; see `docs/FILE_HANDLING.md`
- `invoices` - Invoice rows (number, amount, status, dueDate, frozen JSON snapshot, per-invoice access token). Soft-deleted via `archivedAt`; never hard-deleted.
- `invoice_events` - Audit log per invoice (`created`, `sent`, `paid`, `voided`, `viewed`); `viewed` rows contain hashed viewer IP/UA
- `send_rate_log` - Rolling 30-sends-per-hour throttle log
- `schema_migrations` - Legacy migration tracking table (kept for compatibility)

## Code Style

- **Biome** for formatting and linting (tab indentation, double quotes)
- Use async/await pattern, not callbacks
- Use ES modules, not CommonJS
- Use arrow functions in predicates
- Test files use `.test.ts`/`.test.tsx` extension with Vitest
- Use React Query's `invalidateQueries` to refresh data after mutations
- Store money values in cents (integers) to avoid floating-point errors
- Dates use ISO format (YYYY-MM-DD)

### Component Organization

Components in `src/app/components/` are organized into four categories:
- **`ui/`** - Reusable primitive UI components (Button, Card, Dialog, Grid, Input, Select, Spinner, Table, Textarea)
- **`layout/`** - Layout and structural components (Flex, HtmlElements, Nav, PageWrapper)
- **`shared/`** - Reusable composed components (CardPreview, CloseModalButton, DeleteItem, EditToggleButton, ErrorBoundary, ModalHeader, ModalRenderer)
- **`features/`** - Domain-specific components organized by feature area:
  - `auth/` - SignInGate (gates the app behind Clerk + bridges the session token into the API client)
  - `customers/` - AddressFields, CreateCustomer, CreateCustomerDialog, CustomerDialog, CustomerEditDialog, CustomerEditRow, CustomerViewRow (+ `addressHelpers.ts`, `consentBadge.ts`)
  - `timesheets/` - TimesheetTable, CreateTimesheetRecord, GenerateTimesheet, TimesheetModal, TimesheetEditForm
  - `projects/` - GenerateProject, GenerateProjectDialog, ProjectEditForm, ProjectModal
  - `invoices/` - CreateInvoiceForm, GenerateInvoice, InvoiceDetails, InvoiceModal, PayVoidButtons
  - `transactions/` - TransactionDialog, TransactionEditRow, TransactionForm, TransactionList, TransactionTotalRow, TransactionViewRow
  - `settings/` - DeleteDataSection, EmailDeliverySection, ExportImportSection, InvoiceProfileSection, ThemeSection

### Component File Naming Conventions

Each component follows this folder structure:
```
ComponentName/
├── index.tsx              # Main component file
├── styles.module.css      # CSS module (always named styles.module.css)
└── ComponentName.test.tsx # Test file (named after the component)
```

- **CSS modules**: Always name `styles.module.css`, import as `import styles from "./styles.module.css"`
- **Test files**: Always name `ComponentName.test.tsx` (matching the folder name)
- Use Lucide icons for UI elements
- The app uses light/dark theme toggle - ensure new components respect theme classes
- **MUST** use existing layout and UI components when creating new components:
  - **Layout** (`@/components/layout/`): `Flex`, `HtmlElements`, `Nav`, `PageWrapper`
  - **UI** (`@/components/ui/`): `Button`, `Card`, `Dialog`, `Grid`, `Input`, `Select`, `Spinner`, `Table`, `Textarea`
  - Do not create custom versions of these primitives — always import from the existing shared components

## Invoices & Email Delivery

Invoices are **fully self-hosted** — there is no Stripe (or other
payment processor) integration. The flow:

1. The user adds a Customer (Customers tab) and clicks "Request consent".
   That sends a one-click confirmation email through Resend to the customer
   pointing to `${APP_BASE_URL}/consent/<token>`. The customer must click
   Agree before any invoice email can be sent to them.
2. The user creates an invoice — either one-off or from an open timesheet.
   On send, the entire invoice (seller block, buyer block, line items,
   totals) is frozen into a JSON `snapshot` stored encrypted on
   `invoices.snapshot`. Later edits to the project/customer/user never
   mutate a sent invoice.
3. The customer receives an email with a tokenised link to the public
   hosted invoice page (`/invoice/<id>?t=<token>`). The page renders the
   snapshot HTML and includes deep links to the user's Venmo / PayPal
   handles (stored encrypted on `users.venmoHandle` / `users.paypalHandle`).
4. The user marks the invoice paid manually once the off-platform payment
   clears. Marking paid is a status change only — no external webhook
   reconciles it.

Email delivery requires Resend setup; see `docs/EMAIL_SETUP.md` for the
domain-verification + DKIM/SPF/DMARC steps. The Worker sends through
either the user's own Resend key (stored encrypted on
`users.resendApiKey`) or the shared `RESEND_API_KEY` env var as a
fallback.

## Cloudflare D1 Database

The app uses **Cloudflare D1** (SQLite at the edge) as its primary database:

### Setup
1. Create the database: `wrangler d1 create paper-trail-db`
2. Paste the `database_id` into `wrangler.jsonc`
3. Apply migrations: `pnpm run migrate` (local) or `pnpm run migrate:remote` (remote)

### D1 API Pattern
```typescript
// Single row
const row = await db.prepare("SELECT * FROM table WHERE id = ?").bind(id).first();

// Multiple rows
const { results } = await db.prepare("SELECT * FROM table WHERE userId = ?").bind(userId).all();

// Mutations (INSERT/UPDATE/DELETE)
const result = await db.prepare("INSERT INTO table (col) VALUES (?)").bind(val).run();
const lastId = result.meta.last_row_id;
```

### Local Development
- `pnpm run dev` (via `@cloudflare/vite-plugin`) automatically provisions a local D1 instance
- Local data persists in `.wrangler/state/`
- Use `pnpm run migrate` to apply pending migrations to the local database

## Security Considerations

- Resend API keys, Clerk secrets, and the AES encryption key are stored as Wrangler secrets, never in code or localStorage
- Authentication via Clerk (GitHub OAuth + other connectors). Every API request carries a short-lived Clerk session JWT verified against Clerk's JWKS (or a configured PEM public key) before any DB query runs. No request header is ever trusted on its own
- CORS is locked to `APP_BASE_URL` — arbitrary origins are not reflected
- Public invoice + consent pages send `Referrer-Policy: no-referrer` so per-invoice access tokens don't leak via Referer headers
- Public consent POSTs (`/consent/*`, customer revoke) use a synchronizer-token CSRF defence (`api/src/lib/csrf.ts`)
- Invoice send and consent request endpoints are rate-limited at 30/hour per user (`api/src/lib/rateLimit.ts`)
- All queries include `WHERE userId = ?` for multi-user data isolation, plus FK ownership checks on cross-table writes
- Use parameterized queries (D1 `.bind()`) to prevent SQL injection
- Every body-accepting endpoint validates input with Zod (`api/src/lib/validators.ts`)
- File uploads: size cap (10 MB), content-type allowlist, sanitised filenames via `sanitize-filename`. File ownership is sourced from the `attachments` table — no in-memory map, no `customMetadata` fallback (see `docs/FILE_HANDLING.md`)

### Encryption at Rest

All sensitive data (financial values, customer PII, business profile,
audit-log payloads, file contents) is encrypted using AES-256-GCM
before being stored in D1 or R2. The encryption key is a base64-encoded
32-byte value stored in `ENCRYPTION_KEY` (Wrangler secret in
production, `.dev.vars` locally — generate with `pnpm run enc:key`).
Encryption is implemented in `api/src/lib/crypto.ts`.

**Encrypted fields by table:**
- **users**: `venmoHandle`, `paypalHandle`, `businessName`, `businessAddress`, `resendApiKey`, `resendFromAddress`
- **customers**: `name`, `email`, `address`
- **customer_events**: `payload` (consent audit JSON)
- **projects**: `rate_in_cents`, `description`
- **timesheets**: `description`
- **timesheet_entries**: `description`, `amount`
- **transactions**: `description`, `amount`
- **attachments**: `originalName` (filenames can leak intent — `tax_return.pdf`, `medical_invoice.pdf`)
- **invoices**: `amount_cents`, `description`, `snapshot` (the frozen invoice JSON used by the hosted page and email body)
- **invoice_events**: `payload` (audit-log entries; `viewed` events include hashed viewer IP/UA)
- **R2 files**: entire file contents via `encryptBuffer`/`decryptBuffer`

**Important considerations:**
- Encrypted values use a random IV per encryption, so the same plaintext produces different ciphertext each time. This means `WHERE column = ?` cannot match encrypted values — lookups by encrypted fields must scan and decrypt
- The `decrypt()` function gracefully handles unencrypted values (returns them as-is), so existing plaintext data continues to work after enabling encryption
- The export/import system respects encryption: exports can be plaintext or encrypted, and imports encrypt plaintext data before storing
- IDs, tokens, FKs, status enums, timestamps, sizes, content types, and the sortable `name` columns on `projects` / `timesheets` / `invoices` / `users` are intentionally left unencrypted because they're either operational (used in `WHERE` predicates, indexes, or sort orders) or non-sensitive

## Accessibility

All UI components and pages must meet **WCAG 2.1 AA** standards:

- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<table>`, `<dialog>`, etc.) instead of generic `<div>` or `<span>` with click handlers
- All interactive elements must be keyboard accessible (focusable, operable via Enter/Space, support Tab navigation)
- Form inputs must have associated `<label>` elements or `aria-label`/`aria-labelledby` attributes
- Images and icons must have meaningful `alt` text or `aria-label`; decorative icons should use `aria-hidden="true"`
- Maintain sufficient color contrast ratios (4.5:1 for normal text, 3:1 for large text) in both light and dark themes
- Use `aria-live` regions for dynamic content updates (e.g., toast notifications, loading states, form validation errors)
- Modals/dialogs must trap focus, return focus to the trigger element on close, and be dismissible via Escape
- Use appropriate ARIA roles and attributes (`role`, `aria-expanded`, `aria-selected`, `aria-disabled`) when semantic HTML alone is insufficient
- Ensure visible focus indicators on all interactive elements — do not remove outline styles without providing an alternative
- Tables must use `<th>` with `scope` attributes for proper header association

## Claude Code Configuration

Project-level Claude Code configuration lives in `.claude/`:

```
.claude/
├── .mcp.json              # MCP servers (context7 for docs lookup)
├── settings.json          # Project permissions (auto-allow safe commands)
├── agents/
│   └── code-reviewer/     # Reviews code for conventions, a11y, and security
└── skills/
    ├── new-component/     # /new-component - Scaffold a component
    ├── db-table/          # /db-table - Add a database table
    ├── check/             # /check - Run type checking and linting
    └── test/              # /test - Run tests (optionally a specific file)
```

### Available Skills
- `/new-component features/settings/NewSection` - Scaffold component with index.tsx, styles.module.css, and test file
- `/db-table categories` - Add a new database table with schema, types, and CRUD operations
- `/check` - Run `pnpm run check` (TypeScript + Biome)
- `/test [file]` - Run all tests or a specific test file

### Available Agents
- **code-reviewer** - Reviews changes against project conventions, accessibility standards, and security practices

## Common Tasks

### Adding a New Page
1. Create new component in `src/app/`
2. Add route to `src/app/index.tsx`
3. Add navigation link if needed
4. Create database operations if needed in `src/app/lib/db/`
5. Set up React Query hooks for data fetching

### Adding a New Feature Component
1. Create folder in `src/app/components/features/<feature-area>/ComponentName/`
2. Use existing `ui/` and `layout/` components — do not recreate primitives
3. Add `index.tsx`, `styles.module.css`, and optional `ComponentName.test.tsx`

### Adding a Database Table
1. Create a new migration: `wrangler d1 migrations create paper-trail-db "description_of_change"`
2. Add the table/column SQL to the generated file in `api/db/migrations/` (include `userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` for multi-user isolation, plus an `updatedAt` trigger if you have mutable rows)
3. Add encryption for sensitive columns by wrapping values in `encrypt()` / `decrypt()` from `api/src/lib/crypto.ts` at the route boundary
4. Create TypeScript types in `api/src/lib/types.ts` (backend) and `src/app/lib/db/types.ts` (frontend)
5. Create route handler in `api/src/routes/[table-name].ts`
6. Mount route in `api/src/index.ts` under the `v1` router
7. Add frontend API functions in `src/app/lib/db/[table-name].ts`
8. Set up React Query hooks in components
9. Apply migration: `pnpm run migrate` (local) or `pnpm run migrate:remote` (remote)

### Adding a Workers Route
1. Create route handler in `api/src/routes/[name].ts`
2. Mount in `api/src/index.ts` under the v1 router (or directly on `app` if it's a public unauthenticated endpoint like `/invoice/*` or `/consent/*`)
3. Use `getDb(c.env)` for database access
4. Use `c.get("userId")` for the authenticated user ID (only inside v1; public routes don't have this)
5. Validate request bodies with a Zod schema from `api/src/lib/validators.ts`
6. Add frontend API functions in `src/app/lib/db/`
