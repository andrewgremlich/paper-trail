# Paper Trail: Desktop → Web App + Stripe Connect Migration

## Overview

Convert Paper Trail from a Tauri 2 desktop app to a web application using Cloudflare Workers as the backend, and replace manual Stripe API key entry with Stripe Connect Standard OAuth.

## Current Desktop Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Rust (Tauri 2 commands)
- **Database**: Turso/libSQL (embedded replica via Tauri)
- **Secret storage**: Stronghold plugin + Keyring plugin
- **File operations**: Tauri filesystem, dialog, opener plugins

## Target Web Stack

- **Frontend**: React 19 + Vite + TypeScript (mostly unchanged)
- **Backend**: Cloudflare Workers (Hono or itty-router)
- **Database**: Turso/libSQL (remote via `@libsql/client`)
- **Auth**: User authentication (session-based, stored in Turso)
- **Secret storage**: Cloudflare Workers secrets (env vars) + encrypted DB columns
- **File storage**: Cloudflare R2 (S3-compatible object storage)
- **Hosting**: Cloudflare Pages (frontend) + Cloudflare Workers (API)

---

## Part 1: Web App Conversion

### Phase 1: Set Up Cloudflare Workers Backend

Create a new `workers/` directory (or separate repo) for the API backend.

#### Project Structure

```
workers/
├── src/
│   ├── index.ts              # Worker entry point + router
│   ├── routes/
│   │   ├── auth.ts           # Login, register, session
│   │   ├── projects.ts       # CRUD for projects
│   │   ├── timesheets.ts     # CRUD for timesheets
│   │   ├── timesheetEntries.ts
│   │   ├── transactions.ts   # CRUD for transactions
│   │   ├── userProfile.ts    # User profile operations
│   │   ├── stripe.ts         # Stripe Connect OAuth + API proxy
│   │   └── files.ts          # File upload/download (R2)
│   ├── middleware/
│   │   └── auth.ts           # Session validation middleware
│   └── lib/
│       ├── db.ts             # Turso client setup
│       └── stripe.ts         # Stripe client factory
├── wrangler.toml             # Cloudflare Workers config
└── package.json
```

#### `wrangler.toml` Configuration

```toml
name = "paper-trail-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
TURSO_DATABASE_URL = ""   # Set via wrangler secret

# R2 bucket for file attachments
[[r2_buckets]]
binding = "FILES_BUCKET"
bucket_name = "paper-trail-files"
```

#### Cloudflare Workers Secrets (set via `wrangler secret put`)

```
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
STRIPE_PLATFORM_SECRET_KEY     # Platform's own Stripe key
STRIPE_PLATFORM_CLIENT_ID      # Connect client ID (ca_...)
SESSION_SECRET                  # For signing session cookies
```

#### Worker Router Example (Hono)

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { projectRoutes } from "./routes/projects";
import { stripeRoutes } from "./routes/stripe";
// ...

const app = new Hono();
app.use("/*", cors({ origin: "https://paper-trail.pages.dev" }));
app.route("/api/auth", authRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/stripe", stripeRoutes);
// ...

export default app;
```

### Phase 2: Add User Authentication

The desktop app had implicit single-user auth. The web app needs real auth.

#### Auth Strategy

- Email/password registration + login
- Session cookie (signed with `SESSION_SECRET`)
- Sessions stored in a `sessions` table in Turso
- Every API route validates the session via middleware
- The existing `userId` column on all tables already supports multi-user isolation

#### New Database Tables

```sql
-- Password hashes for email/password auth
ALTER TABLE user_profile ADD COLUMN passwordHash TEXT;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                -- random session ID
  userId INTEGER NOT NULL REFERENCES user_profile(id),
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
```

#### Auth API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/register` | POST | Create account (email, password, displayName) |
| `/api/auth/login` | POST | Authenticate, create session, set cookie |
| `/api/auth/logout` | POST | Destroy session |
| `/api/auth/me` | GET | Get current user from session |

### Phase 3: Migrate Database Operations to API Routes

Replace all Tauri `invoke()` calls with `fetch()` to Workers API routes.

#### Current Tauri Commands → Worker API Routes

| Tauri Command | Worker API Route | Method |
|---|---|---|
| `execute_query` (projects) | `/api/projects` | GET |
| `execute_statement` (projects) | `/api/projects` | POST/PUT/DELETE |
| `execute_query` (timesheets) | `/api/timesheets` | GET |
| `execute_statement` (timesheets) | `/api/timesheets` | POST/PUT/DELETE |
| `execute_query` (timesheet_entries) | `/api/timesheet-entries` | GET |
| `execute_statement` (timesheet_entries) | `/api/timesheet-entries` | POST/PUT/DELETE |
| `execute_query` (transactions) | `/api/transactions` | GET |
| `execute_statement` (transactions) | `/api/transactions` | POST/PUT/DELETE |
| `execute_query` (user_profile) | `/api/auth/me` | GET |
| `sync_database` | Remove (server connects directly to Turso) | — |
| `update_sync_config` | Remove | — |

#### Replace `src/app/lib/db/client.ts`

The `TursoDatabase` class wrapping Tauri IPC becomes a thin `fetch` wrapper:

```typescript
// Before: Tauri IPC
const result = await invoke<T>("execute_query", { query, params });

// After: fetch to Workers API
const response = await fetch("/api/projects", {
  credentials: "include",  // send session cookie
});
const data = await response.json();
```

Better approach: create typed API client functions per resource instead of a generic query interface. Each existing DB module (`src/app/lib/db/projects.ts`, `timesheets.ts`, etc.) becomes a set of `fetch` calls to REST endpoints.

### Phase 4: Migrate File Operations

#### Files That Use Tauri APIs (must be rewritten)

| File | Tauri APIs Used | Web Replacement |
|---|---|---|
| `src/app/lib/files/stronghold.ts` | Stronghold, Keyring, appDataDir | Remove entirely — secrets on server |
| `src/app/lib/files/fileStorage.ts` | plugin-fs (writeFile, exists, mkdir, remove), plugin-opener (openPath, openUrl) | R2 upload via API + `window.open()` |
| `src/app/lib/files/exportImport.ts` | plugin-fs (readTextFile, writeTextFile, exists, mkdir), plugin-dialog (open), documentDir | API route generates file, browser downloads |
| `src/app/lib/files/exportTransactions.ts` | plugin-fs (writeTextFile, exists, mkdir), documentDir | API route generates CSV/JSON, browser downloads |

#### File Upload/Download API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/files/upload` | POST | Upload attachment to R2 |
| `/api/files/download/:key` | GET | Download/serve file from R2 |
| `/api/files/delete/:key` | DELETE | Remove file from R2 |
| `/api/export/data` | GET | Export all data as JSON download |
| `/api/export/transactions` | GET | Export transactions as CSV download |
| `/api/import/data` | POST | Import JSON data |

#### Frontend Replacements

- `openUrl(url)` → `window.open(url, "_blank")`
- `openPath(path)` → `window.open(r2Url, "_blank")`
- Native file dialog → `<input type="file">`
- `writeFile` → POST to `/api/files/upload`

### Phase 5: Update Frontend

#### Remove Tauri Imports

Files with Tauri imports that need updating:

1. **`src/app/lib/db/client.ts`** — `@tauri-apps/api/core` → typed fetch client
2. **`src/app/lib/files/stronghold.ts`** — Delete entirely
3. **`src/app/lib/files/fileStorage.ts`** — `@tauri-apps/plugin-fs`, `plugin-opener` → fetch + `window.open`
4. **`src/app/lib/files/exportImport.ts`** — `@tauri-apps/plugin-fs`, `plugin-dialog` → fetch + `<input type="file">`
5. **`src/app/lib/files/exportTransactions.ts`** — `@tauri-apps/plugin-fs` → fetch download
6. **`src/app/components/features/invoices/PayVoidButtons/index.tsx`** — `@tauri-apps/plugin-opener` → `window.open()`
7. **`src/app/components/features/invoices/InvoiceDetails/index.tsx`** — `@tauri-apps/plugin-opener` → `window.open()`

#### Move Stripe API Calls to Server

`src/app/lib/stripeApi.ts` currently runs Stripe calls **client-side** (in the Tauri webview). All Stripe operations must move server-side to Workers routes. The frontend calls the Workers API instead:

```typescript
// Before: direct Stripe SDK call in frontend
const invoice = await stripe.invoices.create({ ... });

// After: call Workers API
const res = await fetch("/api/stripe/invoices", {
  method: "POST",
  credentials: "include",
  body: JSON.stringify({ timesheetId, customerId }),
});
```

#### Keep As-Is

These require no changes:

- React components (JSX, props, state)
- Zustand store (`src/app/lib/store.ts`)
- React Query hooks (just update `queryFn` to call fetch instead of Tauri)
- CSS Modules
- Vite config (for dev server + build)
- Component structure and organization

### Phase 6: Remove Tauri

- Delete `src-tauri/` directory entirely
- Remove from `package.json`:
  - `@tauri-apps/api`
  - `@tauri-apps/plugin-dialog`
  - `@tauri-apps/plugin-fs`
  - `@tauri-apps/plugin-opener`
  - `@tauri-apps/plugin-stronghold`
  - `@tauri-apps/plugin-updater`
  - `tauri-plugin-keyring-api`
  - `@tauri-apps/cli` (devDependency)
- Remove `"tauri"` script from `package.json`
- Remove `src/app/lib/db/syncConfig.ts` (server manages DB connection directly)
- Remove `src/app/components/features/settings/SyncSettings/` (no longer relevant)
- Update `vite.config.ts` if it has Tauri-specific config

### Phase 7: Deploy

- **Frontend**: `npm run build` → deploy to Cloudflare Pages
- **Backend**: `wrangler deploy` → deploy Workers
- **Database**: Turso cloud (already have this set up)
- **Files**: Cloudflare R2 bucket
- Configure custom domain, CORS, and session cookie domain

---

## Part 2: Stripe Connect OAuth Integration

### Account Type: Stripe Connect Standard

- Users connect their existing Stripe accounts via OAuth
- Users manage their own Stripe dashboard, disputes, payouts, compliance
- Paper Trail makes API calls on their behalf using their access token
- No additional KYC burden on the platform

### Prerequisites

1. Register as a Connect platform in Stripe Dashboard → Connect → Settings
2. Get your platform's `client_id` from Connect settings
3. Add platform Stripe secret key as a Workers secret

### OAuth Flow

```
1. User clicks "Connect with Stripe"
     ↓
2. Frontend redirects to:
   /api/stripe/connect (Workers route)
     ↓
3. Worker generates state nonce, stores in session, redirects to:
   https://connect.stripe.com/oauth/authorize?
     response_type=code&
     client_id=<PLATFORM_CLIENT_ID>&
     scope=read_write&
     state=<nonce>&
     redirect_uri=<callback_url>
     ↓
4. User authorizes on Stripe's website
     ↓
5. Stripe redirects to:
   /api/stripe/callback?code=<auth_code>&state=<nonce>
     ↓
6. Worker validates state, exchanges code for access token:
   stripe.oauth.token({ grant_type: 'authorization_code', code })
     ↓
7. Worker stores credentials in Turso:
   - stripe_user_id (acct_xxx)
   - access_token (encrypted)
   - refresh_token (encrypted)
     ↓
8. Worker redirects user back to /settings with success flag
```

### Stripe API Routes (all in Workers)

| Route | Method | Purpose |
|---|---|---|
| `/api/stripe/connect` | GET | Generate OAuth URL, redirect to Stripe |
| `/api/stripe/callback` | GET | Handle OAuth callback, exchange code, store credentials |
| `/api/stripe/disconnect` | POST | Revoke access, clear stored credentials |
| `/api/stripe/status` | GET | Return connection status for current user |
| `/api/stripe/customers` | GET | List customers (proxied to Stripe) |
| `/api/stripe/invoices` | GET | List invoices |
| `/api/stripe/invoices` | POST | Create invoice (from timesheet or one-off) |
| `/api/stripe/invoices/:id` | GET | Get invoice details |
| `/api/stripe/invoices/:id/pay` | POST | Mark invoice as paid |
| `/api/stripe/invoices/:id/void` | POST | Void invoice |

### Database Schema Addition

```sql
CREATE TABLE IF NOT EXISTS stripe_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES user_profile(id),
    stripe_user_id TEXT NOT NULL,       -- acct_xxx
    access_token TEXT NOT NULL,          -- encrypted
    refresh_token TEXT,                  -- encrypted
    scope TEXT,
    connectedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(userId)
);
```

### Stripe Client Factory (server-side only)

```typescript
// workers/src/lib/stripe.ts
import Stripe from "stripe";

export function getStripeClientForUser(accessToken: string): Stripe {
  return new Stripe(accessToken);
}

export function getPlatformStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_PLATFORM_SECRET_KEY);
}
```

All existing Stripe API calls work unchanged — the access token returned by Connect OAuth scopes all calls to the connected account automatically.

### Frontend: Replace `StripeSecretSection` with `StripeConnectSection`

**Disconnected state:**
- "Connect with Stripe" button
- "Connect your Stripe account to send invoices and manage payments."

**Connected state:**
- Green "Connected" badge with account display name or ID
- "Disconnect" button

**Loading state:**
- Spinner while OAuth flow is in progress

### Security

- **CSRF**: Random `state` nonce per OAuth attempt, stored in session, validated on callback
- **Token encryption**: Encrypt access tokens at rest in Turso
- **Platform key**: Lives only in Workers secrets, never sent to frontend
- **Scope**: Request only `read_write` (minimum for invoicing)
- **Revocation**: Call `stripe.oauth.deauthorize()` on disconnect
- **Token lifetime**: Standard Connect tokens do not expire, but store refresh token as precaution

---

## Implementation Order

### Web Conversion (do first)

1. **Scaffold Workers backend** — Set up Hono router, Turso client, wrangler config
2. **Add auth** — Register, login, session middleware, `sessions` table
3. **Migrate DB operations** — Create REST routes for projects, timesheets, entries, transactions
4. **Migrate file operations** — R2 upload/download routes, export endpoints
5. **Update frontend** — Replace all `invoke()` with `fetch()`, remove Tauri imports
6. **Move Stripe calls server-side** — Proxy all Stripe SDK calls through Workers routes
7. **Remove Tauri** — Delete `src-tauri/`, clean `package.json`

### Stripe Connect (do second)

8. **Add `stripe_connections` table** — Schema migration
9. **Add OAuth routes** — `/api/stripe/connect`, `/callback`, `/disconnect`, `/status`
10. **Build `StripeConnectSection` UI** — Replace `StripeSecretSection`
11. **Delete `stronghold.ts`** — No longer needed

### Deploy

12. **Deploy Workers + Pages** — Configure domain, CORS, secrets
13. **Test end-to-end** — Full OAuth flow, invoice creation, customer management

---

## Cloudflare-Specific Considerations

- **Workers limits**: 10ms CPU time on free plan, 30s on paid. Stripe API calls may need paid plan or use `waitUntil()` for non-blocking work.
- **R2 free tier**: 10GB storage, 10M reads/month, 1M writes/month — should be plenty for file attachments.
- **Pages + Workers**: Frontend on Pages, API on Workers. Use `_routes.json` or a custom domain to avoid CORS issues by serving both from the same domain.
- **Stripe SDK in Workers**: The `stripe` npm package works in Workers/edge runtime. Use `stripe` v13+ which supports the Fetch API.
- **No Node.js built-ins**: Workers don't have `fs`, `path`, `crypto` (Node). Use Web APIs (`crypto.subtle`, `TextEncoder`, etc.) or Cloudflare-specific polyfills.

## Notes

- The existing React frontend transfers almost entirely unchanged
- The `userId` column on all DB tables means multi-user support is already partially built in
- Test with Stripe sandbox credentials first
- Consider using Cloudflare Access or Turnstile for additional auth/bot protection
