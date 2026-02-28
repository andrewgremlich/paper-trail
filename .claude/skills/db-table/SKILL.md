---
name: db-table
description: Add a new database table to Paper Trail following existing conventions
argument-hint: <table_name> (e.g., invoices, categories)
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Add Database Table

Add a new database table following Paper Trail's database conventions.

## Steps

1. **Schema** (`src-tauri/db/seed.sql`):
   - Add `CREATE TABLE IF NOT EXISTS` with `userId` column for multi-user isolation
   - Include `createdAt` and `updatedAt` timestamp columns
   - Add `trg_{table}_set_updatedAt` trigger
   - Store money as cents (integers), dates as ISO YYYY-MM-DD, booleans as 0/1

2. **TypeScript types** (`src/app/lib/db/types.ts`):
   - Add entity type with all columns
   - Add `Create*` and `Update*` pick types for forms
   - Normalize booleans with `!!` when reading from DB

3. **CRUD operations** (`src/app/lib/db/{table_name}.ts`):
   - Use parameterized queries (`$1`, `$2`) to prevent SQL injection
   - Use `execute_query` for SELECT, `execute_statement` for mutations
   - Export functions from `src/app/lib/db/index.ts`

4. **React Query hooks** in consuming components:
   - Use `invalidateQueries` to refresh data after mutations

## Arguments

$ARGUMENTS - The table name (e.g., `categories`)
