# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paper Trail is a web-based timesheet and invoicing application built with Cloudflare Workers (Hono backend) and React 19 (TypeScript frontend). It integrates with Stripe for invoice generation and payment processing.

## Build & Development Commands

```bash
# Frontend development
npm run dev

# Type checking and formatting
npm run check

# Run tests
npm run test

# Run a single test file
npx vitest run src/app/lib/utils.test.ts

# Workers API development
cd workers && npm run dev

# Deploy workers
cd workers && npm run deploy

# Seed D1 database (remote)
cd workers && npm run seed

# Seed D1 database (local)
cd workers && npm run seed:local

# Generate worker types
cd workers && npm run types
```

## Architecture

### Frontend (`src/`)
- **React 19** with TypeScript, built with **Vite**
- **Zustand** for state management (persisted to localStorage)
- **TanStack React Query** for async data fetching
- **CSS Modules** for component styling (no Tailwind)
- **Zod** for validation, **date-fns** for date utilities, **sanitize-filename** for file safety
- Path aliases: `@/components/*`, `@/lib/*`, `@/*` map to `src/app/`

### Backend (`workers/`)
- **Cloudflare Workers** with **Hono** web framework
- **Cloudflare D1** (SQLite) database
- **Cloudflare R2** for file storage (transaction attachments)
- **Cloudflare Access** (GitHub OAuth) for authentication
- **Stripe** API keys stored via Wrangler secrets
- Database schema in `workers/db/seed.sql`

### Key Data Flow
1. Frontend calls API endpoints via `src/app/lib/db/client.ts` (thin fetch wrapper)
2. Cloudflare Access authenticates user via GitHub OAuth, injects email header
3. Auth middleware auto-creates user profile, sets userId in context
4. Route handlers in `workers/src/routes/` perform D1 queries with userId isolation
5. Stripe API calls via `workers/src/routes/stripe.ts` using Wrangler secrets
6. File uploads/downloads via R2 bucket through `workers/src/routes/files.ts`

### Key Files to Understand
- `src/app/lib/store.ts` - Zustand state management, UI state and localStorage persistence
- `src/app/lib/db/client.ts` - API client (fetch wrapper for Workers backend)
- `src/app/lib/db/types.ts` - Database entity type definitions (Project, Timesheet, Transaction, UserProfile, etc.)
- `src/app/lib/types.ts` - Shared TypeScript type definitions (Stripe types, enums)
- `workers/src/index.ts` - Hono app entry point, route mounting, CORS
- `workers/src/lib/db.ts` - D1 database binding accessor
- `workers/src/lib/types.ts` - Backend type definitions (Env, entity types)
- `workers/src/middleware/auth.ts` - Cloudflare Access auth middleware
- `workers/src/routes/` - All API route handlers
- `workers/db/seed.sql` - Database schema (tables, indexes, triggers)
- `workers/wrangler.toml` - Cloudflare Workers configuration (D1, R2 bindings)
- `src/app/index.tsx` - Main app router and page layout

### Database Tables
All tables include a `userId` column for multi-user data isolation:
- `projects` - Clients with Stripe customer IDs and hourly rates
- `timesheets` - Time tracking documents linked to projects
- `timesheet_entries` - Individual work entries (date, minutes, description)
- `transactions` - Expense/income tracking separate from timesheets
- `user_profile` - User information (displayName, email, uuid)
- `schema_migrations` - Tracks applied migration versions

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
- **`shared/`** - Reusable composed components (CardPreview, CloseModalButton, DeleteItem, EditToggleButton, ErrorBoundary, ModalHeader)
- **`features/`** - Domain-specific components organized by feature area:
  - `timesheets/` - TimesheetTable, CreateTimesheetRecord, GenerateTimesheet, TimesheetModal, TimesheetEditForm
  - `projects/` - GenerateProject, ProjectEditForm, ProjectModal
  - `invoices/` - CreateInvoiceForm, GenerateInvoice, InvoiceDetails, InvoiceModal, PayVoidButtons
  - `transactions/` - ExportTransactions, TransactionEditRow, TransactionForm, TransactionList, TransactionTotalRow, TransactionViewRow
  - `settings/` - ExportImportSection, SettingsModal, StripeSecretSection, SyncSettings, ThemeSection

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

## Stripe Integration

Stripe API keys are stored as Wrangler secrets (`wrangler secret put STRIPE_SECRET_KEY`). The app supports:
- Creating invoices from timesheet entries
- One-off invoice creation
- Customer management synced with projects
- Invoice lifecycle (pay, void, track status)
- Automatic transaction creation when invoices are marked paid

## Cloudflare D1 Database

The app uses **Cloudflare D1** (SQLite at the edge) as its primary database:

### Setup
1. Create the database: `wrangler d1 create paper-trail-db`
2. Paste the `database_id` into `workers/wrangler.toml`
3. Seed the schema: `cd workers && npm run seed` (remote) or `npm run seed:local` (local)

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
- `wrangler dev` automatically provisions a local D1 instance
- Local data persists in `.wrangler/state/`
- Use `npm run seed:local` to seed the local database

## Security Considerations

- Stripe API keys stored as Wrangler secrets, never in code or localStorage
- Authentication via Cloudflare Access (GitHub OAuth)
- All queries include `WHERE userId = ?` for multi-user data isolation
- Use parameterized queries (D1 `.bind()`) to prevent SQL injection
- Sanitize file names and paths for transaction attachments
- File uploads stored in Cloudflare R2 with sanitized paths

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
- `/check` - Run `npm run check` (TypeScript + Biome)
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
1. Add table definition to `workers/db/seed.sql` (include `userId` column for multi-user isolation)
2. Create TypeScript types in `workers/src/lib/types.ts`
3. Create route handler in `workers/src/routes/[table-name].ts`
4. Mount route in `workers/src/index.ts`
5. Add frontend API functions in `src/app/lib/db/[table-name].ts`
6. Set up React Query hooks in components
7. Run migration: `wrangler d1 execute paper-trail-db --file=db/seed.sql`

### Adding a Stripe Feature
1. Update `workers/src/routes/stripe.ts` with new Stripe SDK calls
2. Ensure proper error handling
3. Add UI components for the feature
4. Test with Stripe test keys first

### Adding a Workers Route
1. Create route handler in `workers/src/routes/[name].ts`
2. Mount in `workers/src/index.ts` under the v1 router
3. Use `getDb(c.env)` for database access
4. Use `c.get("userId")` for authenticated user ID
5. Add frontend API functions in `src/app/lib/db/`
