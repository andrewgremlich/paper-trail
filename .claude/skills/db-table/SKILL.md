---
name: db-table
description: Add a new database table to Paper Trail following existing conventions
argument-hint: <table_name> (e.g., invoices, categories)
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Add Database Table

Add a new database table following Paper Trail's Cloudflare D1
conventions.

## Steps

1. **Migration** (`api/db/migrations/`):
   - Generate the file: `wrangler d1 migrations create paper-trail-db "add_<table>"`
   - In the generated SQL, add `CREATE TABLE IF NOT EXISTS` with:
     - A `TEXT PRIMARY KEY` column (UUIDv4, generated in code with `crypto.randomUUID()`)
     - `userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` for multi-user isolation
     - `createdAt TEXT NOT NULL DEFAULT (datetime('now'))` and `updatedAt TEXT NOT NULL DEFAULT (datetime('now'))`
   - Add an `idx_<table>_userId` index
   - Add a `trg_<table>_set_updatedAt` AFTER UPDATE trigger that bumps `updatedAt`
   - Store money as cents (integer if unencrypted, encrypted-string of cents if encrypted), dates as ISO `YYYY-MM-DD`, booleans as `INTEGER CHECK (col IN (0, 1))`

2. **Encryption (`api/src/lib/crypto.ts`)**:
   - For sensitive columns, wrap values in `await encrypt(env, value)` on write and `await decrypt(env, value)` on read at the route boundary
   - Remember: encrypted columns can't be matched with `WHERE col = ?` — they need a scan-then-decrypt loop

3. **Backend types** (`api/src/lib/types.ts`):
   - Add the entity type matching the SQL schema
   - Normalize booleans as `boolean | number` since D1 returns integers

4. **Route handler** (`api/src/routes/<table>.ts`):
   - Export a `Hono` sub-app
   - Use `getDb(c.env)` and `c.get("userId")`
   - Use parameterized queries with `.bind(...)` (D1 placeholders are `?`, not `$1`)
   - Validate every body with a Zod schema (add it to `api/src/lib/validators.ts` if shared)
   - Always include `WHERE userId = ?` in every query

5. **Mount the route** in `api/src/index.ts` under the `v1` router.

6. **Frontend types** (`src/app/lib/db/types.ts`):
   - Mirror the backend type for the frontend
   - Add `Create*` / `Update*` `Pick` types for forms
   - Normalize booleans with `!!` if needed

7. **Frontend client** (`src/app/lib/db/<table>.ts`):
   - Wrap the API calls using the `api` helper from `./client`
   - Re-export from `src/app/lib/db/index.ts`

8. **React Query hooks** in consuming components:
   - Use `useQuery` for reads and `useMutation` + `invalidateQueries` after writes

9. **Apply the migration**: `pnpm run migrate` (local) or `pnpm run migrate:remote` (production)

## Arguments

$ARGUMENTS - The table name (e.g., `categories`)
