# Stripe Connect Migration

## Status Checklist

- [x] Web app conversion (Tauri removed, Cloudflare Workers backend, D1 database, R2 file storage)
- [x] Authentication (Cloudflare Access with GitHub OAuth)
- [x] All CRUD API routes (projects, timesheets, entries, transactions, user profile)
- [x] File operations (R2 upload/download, export/import)
- [x] Stripe invoice/customer operations (server-side via Workers)
- [x] Single-domain deployment (Workers static assets + API)
- [ ] Delete stub files (`stronghold.ts`, `SyncSettings/`)
- [ ] Register as Stripe Connect platform
- [ ] Add `stripe_connections` table to D1
- [ ] Add OAuth routes (`/connect`, `/callback`, `/disconnect`, `/status`)
- [ ] Build `StripeConnectSection` UI (replace `StripeSecretSection`)
- [ ] End-to-end test with Stripe sandbox

---

## Current State

The web conversion is complete. The app runs on:

- **Frontend**: React 19 + Vite, served as static assets from the Worker
- **Backend**: Cloudflare Workers + Hono, API at `/api/v1/*`
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: Cloudflare Access (GitHub OAuth)
- **Files**: Cloudflare R2
- **Deployment**: Single `wrangler deploy` (frontend + API together)

Stripe currently works via a single platform secret key (`STRIPE_SECRET_KEY` set via `wrangler secret put`). The goal is to migrate to Stripe Connect Standard so each user connects their own Stripe account.

---

## Stripe Connect Integration

### Account Type: Stripe Connect Standard

- Users connect their existing Stripe accounts via OAuth
- Users manage their own Stripe dashboard, disputes, payouts, compliance
- Paper Trail makes API calls on their behalf using their access token
- No additional KYC burden on the platform

### Prerequisites

1. Register as a Connect platform in Stripe Dashboard > Connect > Settings
2. Get the platform's `client_id` from Connect settings
3. Set Workers secrets:
   ```
   wrangler secret put STRIPE_PLATFORM_SECRET_KEY
   wrangler secret put STRIPE_PLATFORM_CLIENT_ID
   ```

### OAuth Flow

```
1. User clicks "Connect with Stripe"
     |
2. Frontend redirects to: /api/v1/stripe/connect
     |
3. Worker generates state nonce, stores in cookie, redirects to:
   https://connect.stripe.com/oauth/authorize?
     response_type=code&
     client_id=<PLATFORM_CLIENT_ID>&
     scope=read_write&
     state=<nonce>&
     redirect_uri=<callback_url>
     |
4. User authorizes on Stripe's website
     |
5. Stripe redirects to: /api/v1/stripe/callback?code=<auth_code>&state=<nonce>
     |
6. Worker validates state, exchanges code for access token:
   stripe.oauth.token({ grant_type: 'authorization_code', code })
     |
7. Worker stores credentials in D1:
   - stripe_user_id (acct_xxx)
   - access_token (encrypted)
   - refresh_token (encrypted)
     |
8. Worker redirects user back to /settings with success flag
```

### New API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/v1/stripe/connect` | GET | Generate OAuth URL, redirect to Stripe |
| `/api/v1/stripe/callback` | GET | Handle OAuth callback, exchange code, store credentials |
| `/api/v1/stripe/disconnect` | POST | Revoke access, clear stored credentials |
| `/api/v1/stripe/status` | GET | Return connection status for current user |

Existing invoice/customer routes remain unchanged but will use the connected account's access token instead of the platform key.

### Database Schema Addition

```sql
CREATE TABLE IF NOT EXISTS stripe_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id),
    stripe_user_id TEXT NOT NULL,       -- acct_xxx
    access_token TEXT NOT NULL,          -- encrypted
    refresh_token TEXT,                  -- encrypted
    scope TEXT,
    connectedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(userId)
);
```

### Stripe Client Factory

```typescript
// api/src/lib/stripe.ts
import Stripe from "stripe";

export function getStripeClientForUser(accessToken: string): Stripe {
  return new Stripe(accessToken);
}

export function getPlatformStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_PLATFORM_SECRET_KEY);
}
```

Existing Stripe API calls work unchanged -- the access token returned by Connect OAuth scopes all calls to the connected account automatically.

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

- **CSRF**: Random `state` nonce per OAuth attempt, stored in signed cookie, validated on callback
- **Token encryption**: Encrypt access tokens at rest in D1
- **Platform key**: Lives only in Workers secrets, never sent to frontend
- **Scope**: Request only `read_write` (minimum for invoicing)
- **Revocation**: Call `stripe.oauth.deauthorize()` on disconnect
- **Token lifetime**: Standard Connect tokens do not expire, but store refresh token as precaution
