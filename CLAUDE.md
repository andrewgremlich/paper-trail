# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paper Trail is a desktop timesheet and invoicing application built with Tauri 2 (Rust backend) and React 19 (TypeScript frontend). It integrates with Stripe for invoice generation and payment processing.

## Build & Development Commands

```bash
# Development - starts both Vite dev server and Tauri app
npm run tauri dev

# Production build
npm run tauri build

# Type checking and formatting
npm run check

# Run tests
npm run test

# Run a single test file
npx vitest run src/app/lib/utils.test.ts
```

## Architecture

### Frontend (`src/`)
- **React 19** with TypeScript, built with **Vite**
- **Zustand** for state management (persisted to localStorage)
- **TanStack React Query** for async data fetching
- **CSS Modules** for component styling (no Tailwind)
- **Zod** for validation, **date-fns** for date utilities, **sanitize-filename** for file safety
- Path aliases: `@/components/*`, `@/lib/*`, `@/*` map to `src/app/`

### Backend (`src-tauri/`)
- **Tauri 2** Rust framework for desktop capabilities
- **Turso/libSQL** database with embedded replica support (see `src-tauri/src/db.rs`)
- **Stronghold** plugin for encrypted Stripe key storage
- **Keyring** plugin for vault password management
- Database schema in `src-tauri/db/seed.sql`

### Key Data Flow
1. Frontend calls Tauri commands (`execute_query`, `execute_statement`) via `src/app/lib/db/client.ts`
2. Database operations in `src/app/lib/db/` (projects, timesheets, timesheetEntries, transactions, userProfile)
3. Stripe API calls via `src/app/lib/stripeApi.ts` using keys from Stronghold
4. Optional cloud sync via Turso embedded replicas (configurable in `src/app/lib/db/syncConfig.ts`)
5. File operations (export/import, file storage, Stronghold) via `src/app/lib/files/`

### Key Files to Understand
- `src/app/lib/store.ts` - Zustand state management, UI state and localStorage persistence
- `src/app/lib/db/client.ts` - Turso/libSQL connection manager (TursoDatabase class) and database initialization
- `src/app/lib/db/types.ts` - Database entity type definitions (Project, Timesheet, Transaction, UserProfile, etc.)
- `src/app/lib/stripeApi.ts` - Stripe API integration functions
- `src/app/lib/files/stronghold.ts` - Secure credential storage wrapper (Stronghold + Keyring)
- `src/app/lib/types.ts` - Shared TypeScript type definitions (Stripe types, enums)
- `src-tauri/db/seed.sql` - Database schema and migration logic
- `src-tauri/src/lib.rs` - Tauri application setup and Rust commands
- `src-tauri/src/db.rs` - Rust database management, sync, and migration logic
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

Stripe API keys are stored encrypted via Stronghold plugin. The app supports:
- Creating invoices from timesheet entries
- One-off invoice creation
- Customer management synced with projects
- Invoice lifecycle (pay, void, track status)
- Automatic transaction creation when invoices are marked paid

## Turso Database & Sync

The app uses **Turso (libSQL)** with embedded replicas for local-first database with optional cloud sync:

### Local-First Architecture
- Database stored locally at `{AppLocalData}/paper-trail.db`
- Fast queries, works offline
- No network required for basic operations

### Optional Cloud Sync (Future Paid Feature)
- Sync configuration in `src/app/lib/db/syncConfig.ts`
- UI component at `src/app/components/features/settings/SyncSettings/`
- Currently enabled by default, will be gated behind subscription in future
- See [TURSO_MIGRATION.md](TURSO_MIGRATION.md) for setup instructions

### Tauri Commands for Database
- `execute_query` - Run SELECT queries
- `execute_statement` - Run INSERT/UPDATE/DELETE
- `sync_database` - Manually trigger sync
- `update_sync_config` - Update sync credentials

## Security Considerations

- Stripe API keys MUST be stored in Stronghold, never in plain text or localStorage
- Vault password managed via system Keyring plugin
- Validate all user inputs before database operations
- Use parameterized queries to prevent SQL injection
- Sanitize file names and paths for transaction attachments

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
1. Add table definition to `src-tauri/db/seed.sql` (include `userId` column for multi-user isolation)
2. Create TypeScript types in `src/app/lib/db/types.ts`
3. Create CRUD functions in `src/app/lib/db/[table-name].ts`
4. Set up React Query hooks in components
5. Test database operations

### Adding a Stripe Feature
1. Update `src/app/lib/stripeApi.ts` with new Stripe SDK calls
2. Ensure proper error handling
3. Add UI components for the feature
4. Test with Stripe test keys first

### Adding a Tauri Command
1. Define Rust function in `src-tauri/src/lib.rs` (or `src-tauri/src/db.rs` for database commands)
2. Add to Tauri app builder in `lib.rs`
3. Invoke from React with `@tauri-apps/api/core`
4. Handle async operations properly
