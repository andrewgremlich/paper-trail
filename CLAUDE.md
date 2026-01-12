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
- **Tailwind CSS 4** for styling
- Path aliases: `@/components/*`, `@/lib/*`, `@/*` map to `src/app/`

### Backend (`src-tauri/`)
- **Tauri 2** Rust framework for desktop capabilities
- **SQLite** database via `tauri-plugin-sql`
- **Stronghold** plugin for encrypted Stripe key storage
- Database schema in `src-tauri/db/seed.sql`

### Key Data Flow
1. Frontend calls Tauri commands or uses SQL plugin directly
2. Database operations in `src/app/lib/db/` (projects, timesheets, timesheetEntries, transactions)
3. Stripe API calls via `src/app/lib/stripeApi.ts` using keys from Stronghold

### Database Tables
- `projects` - Clients with Stripe customer IDs and hourly rates
- `timesheets` - Time tracking documents linked to projects
- `timesheet_entries` - Individual work entries (date, minutes, description)
- `transactions` - Expense/income tracking separate from timesheets

## Code Style

- **Biome** for formatting and linting (tab indentation, double quotes)
- Use async/await pattern, not callbacks
- Use ES modules, not CommonJS
- Use arrow functions in predicates
- Test files use `.test.ts`/`.test.tsx` extension with Vitest

## Stripe Integration

Stripe API keys are stored encrypted via Stronghold plugin. The app supports:
- Creating invoices from timesheet entries
- Customer management synced with projects
- Invoice lifecycle (pay, void, track status)
