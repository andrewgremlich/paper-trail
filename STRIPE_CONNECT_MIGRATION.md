# Stripe Connect Migration

## Status Checklist

- [x] Web app conversion (Tauri removed, Cloudflare Workers backend, D1 database, R2 file storage)
- [x] Authentication (Cloudflare Access with GitHub OAuth)
- [x] All CRUD API routes (projects, timesheets, entries, transactions, user profile)
- [x] File operations (R2 upload/download, export/import)
- [x] Stripe invoice/customer operations (server-side via Workers)
- [x] Single-domain deployment (Workers static assets + API)
- [x] Delete stub files (`stronghold.ts`, `SyncSettings/`)
- [ ] Register as Stripe Connect platform
- [ ] Add `stripe_connections` table to D1
- [ ] Add OAuth routes (`/connect`, `/callback`, `/disconnect`, `/status`)
- [ ] Build `StripeConnectSection` UI (replace `StripeSecretSection`)
- [x] Implement encryption for sensitive data at rest (tokens, financial records, file attachments)
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
- **Platform key**: Lives only in Workers secrets, never sent to frontend
- **Scope**: Request only `read_write` (minimum for invoicing)
- **Revocation**: Call `stripe.oauth.deauthorize()` on disconnect
- **Token lifetime**: Standard Connect tokens do not expire, but store refresh token as precaution

---

## Encryption & Data Protection

This application handles financial data (invoices, transactions, payment tokens). All sensitive data must be encrypted at rest.

### Encryption Key Management

Store an AES-256 encryption key as a Workers secret:

```
wrangler secret put ENCRYPTION_KEY
```

Generate a 256-bit key:

```bash
openssl rand -base64 32
```

### What to Encrypt

| Data | Storage | Encryption |
|---|---|---|
| Stripe access tokens | D1 `stripe_connections.access_token` | AES-256-GCM, per-row IV |
| Stripe refresh tokens | D1 `stripe_connections.refresh_token` | AES-256-GCM, per-row IV |
| Transaction amounts & descriptions | D1 `transactions` | AES-256-GCM (amount, description columns) |
| File attachments | R2 | Encrypt before upload, decrypt on download |
| Stripe platform keys | Workers secrets | Handled by Cloudflare (encrypted at rest by platform) |
| User emails | D1 `users.email` | Not encrypted (needed for Cloudflare Access lookup) |

### AES-256-GCM Implementation

Use the Web Crypto API available in Workers (no Node.js dependencies):

```typescript
// api/src/lib/crypto.ts

async function getKey(env: Env): Promise<CryptoKey> {
  const rawKey = Uint8Array.from(atob(env.ENCRYPTION_KEY), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(plaintext: string, env: Env): Promise<string> {
  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  // Store as base64: iv + ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encrypted: string, env: Env): Promise<string> {
  const key = await getKey(env);
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}
```

Each encrypted value gets a unique random IV (12 bytes for GCM). The IV is stored alongside the ciphertext -- it does not need to be secret, only unique.

### R2 File Encryption

Encrypt file contents before uploading, decrypt after downloading:

```typescript
// In file upload route
const fileBytes = await file.arrayBuffer();
const encryptedBytes = await encryptBuffer(fileBytes, env);
await bucket.put(key, encryptedBytes);

// In file download route
const object = await bucket.get(key);
const encryptedBytes = await object.arrayBuffer();
const decryptedBytes = await decryptBuffer(encryptedBytes, env);
return new Response(decryptedBytes);
```

### Key Rotation

When rotating the encryption key:

1. Set new key: `wrangler secret put ENCRYPTION_KEY_NEW`
2. Run a migration worker that re-encrypts all rows with the new key
3. Swap: rename `ENCRYPTION_KEY_NEW` to `ENCRYPTION_KEY`
4. Delete old secret

### D1 Considerations

- Encrypted columns cannot be queried with `WHERE` clauses (use IDs for lookups, not encrypted values)
- Store encrypted values as TEXT (base64-encoded)
- Keep `userId`, `id`, and foreign keys unencrypted for query performance
- Amounts stored encrypted lose the ability to do SQL `SUM()` -- aggregate in application code after decryption if needed
