# Turso Migration Guide

This document explains the migration from Tauri's SQL plugin to Turso with embedded replicas.

## What Changed

### Backend (Rust)

- **Removed**: `tauri-plugin-sql` dependency
- **Added**: `libsql` crate (version 0.6)
- **New Module**: `src-tauri/src/db.rs` - Database management with Turso embedded replica support
- **Updated**: `src-tauri/src/lib.rs` - Initialization now uses Turso instead of SQL plugin

### Frontend (TypeScript)

- **Updated**: `src/app/lib/db/client.ts` - New database client that wraps Tauri commands
- **Removed**: `@tauri-apps/plugin-sql` from package.json
- **Added**: `src/app/lib/db/syncConfig.ts` - Sync configuration management
- **Added**: `src/app/components/features/settings/SyncSettings/` - React component for sync settings UI

### Configuration

- **Updated**: `src-tauri/capabilities/default.json` - Removed SQL plugin permissions

## Features

### Embedded Replicas

Your local database now supports syncing with a remote Turso database using embedded replicas. This provides:

- **Local-first architecture**: All data is stored locally for fast access
- **Optional cloud sync**: Sync to Turso cloud when configured
- **Offline support**: Works perfectly without network connection
- **Conflict-free**: Turso handles synchronization conflicts automatically

### Multi-User Data Isolation

All data tables (`projects`, `timesheets`, `timesheet_entries`, `transactions`) include a `userId` foreign key referencing `user_profile.id`. This ensures each user's data is isolated when sharing a remote Turso database. The `userId` filtering is handled transparently by the data layer — no component code changes are needed.

### Sync Configuration

Sync is currently **enabled by default** but will be a **paid feature** in the future. The code includes infrastructure to gate this behind a subscription check:

```typescript
// In syncConfig.ts
export interface SyncConfig {
  syncUrl: string | null;
  authToken: string | null;
  enableSync: boolean;
  isPaidFeature: boolean; // Future: gate sync behind paid tier
}
```

## How to Use Turso Sync

### 1. Create a Turso Account

1. Visit [turso.tech](https://turso.tech) and sign up
2. Install the Turso CLI:
   ```bash
   brew install tursodatabase/tap/turso
   ```

### 2. Create Your Database

```bash
# Login to Turso
turso auth login

# Create a database for Paper Trail
turso db create paper-trail

# Get your database URL
turso db show paper-trail --url
# Example output: libsql://paper-trail-your-org.turso.io

# Create an authentication token
turso db tokens create paper-trail
# Example output: eyJhbGc... (long token string)
```

### 3. Push the Schema to Turso

The `seed.sql` file contains a `PRAGMA journal_mode = WAL` statement that is incompatible with Turso remote databases. Strip it when pushing the schema:

```bash
sed '3d' src-tauri/db/seed.sql | turso db shell paper-trail
```

This only creates the schema on the remote — your local data is unaffected.

### 4. Configure Sync in the App

You can configure sync in two ways:

#### Option A: Use the Settings UI

The `SyncSettings` component is available in the app's Settings modal. Enter your Turso database URL and auth token there.

#### Option B: Programmatically

```typescript
import { configureTursoSync, syncNow } from "@/lib/db/syncConfig";

// Configure sync
await configureTursoSync(
  "libsql://paper-trail-your-org.turso.io",
  "your-auth-token"
);

// Manually trigger sync
await syncNow();
```

**Note**: After configuring sync credentials for the first time, an app restart is required. The `update_sync_config` Tauri command updates the in-memory config but does not rebuild the database connection with the new remote replica URL.

### 5. Enable Auto-Sync (Optional)

To automatically sync in the background:

```typescript
import { startAutoSync } from "@/lib/db/syncConfig";

// Start auto-sync every 5 minutes
const stopAutoSync = startAutoSync(5);

// Later, to stop auto-sync
stopAutoSync();
```

## API Changes

The database client API remains **largely the same**, so existing code should work with minimal changes:

### Before (SQL Plugin)

```typescript
const db = await getDb();
const results = await db.select<User[]>(
  "SELECT * FROM users WHERE id = $1",
  [userId]
);
```

### After (Turso)

```typescript
const db = await getDb();
const results = await db.select<User[]>(
  "SELECT * FROM users WHERE id = $1",
  [userId]
);
// No changes needed!
```

### New Methods

```typescript
const db = await getDb();

// Manually trigger sync
await db.sync();

// Update sync configuration (in-memory only; restart required to take effect)
await db.updateSyncConfig(
  "libsql://your-db.turso.io",
  "your-token",
  true
);
```

## Migration Notes

### Database Location

- **Old**: SQLite file managed by Tauri SQL plugin
- **New**: `{AppLocalData}/paper-trail.db` (same location, just different management)

### Existing Data

Your existing database will be automatically migrated. The schema uses `CREATE TABLE IF NOT EXISTS`, so existing tables and data are preserved. On first launch after the update, a TypeScript migration adds `userId` columns to all data tables and backfills existing rows with the current user's profile ID.

### Sync Behavior

- **Local-only mode**: If no sync URL/token is configured, works exactly like before
- **Sync mode**: When configured, syncs with remote Turso database
- **Sync trigger**: Manual via `syncNow()` or automatic via `startAutoSync()`
- **First-time setup**: Requires app restart after entering sync credentials

## Future: Paid Feature

The codebase includes infrastructure to make sync a paid feature:

```typescript
// TODO: Uncomment when implementing paid subscriptions
if (config.isPaidFeature && !userHasPaidSubscription()) {
  throw new Error("Sync is a paid feature. Please upgrade.");
}
```

To enable this:

1. Implement `userHasPaidSubscription()` function
2. Set `isPaidFeature: true` in `DbConfig::default()`
3. Update UI to show upgrade prompts

## Tauri Commands

Tauri commands available from the frontend:

- `execute_query(query, params)` - Execute SELECT queries
- `execute_statement(query, params)` - Execute INSERT/UPDATE/DELETE
- `sync_database()` - Trigger manual sync
- `update_sync_config(syncUrl, authToken, enableSync)` - Update sync settings (in-memory only)

## Troubleshooting

### Build Errors

If you get permission errors during build:
- Ensure `sql:default` and `sql:allow-execute` are removed from `src-tauri/capabilities/default.json`

### Sync Not Working

1. Verify your Turso credentials are correct
2. Check that `enableSync` is `true` in your config
3. Look for errors in the console when calling `syncNow()`
4. Restart the app after configuring sync credentials for the first time

### Data Not Syncing

- Embedded replicas sync on-demand, not automatically
- Call `syncNow()` explicitly or set up `startAutoSync()`
- Check your Turso dashboard to verify data is being received

### Schema Mismatch

If the remote database schema is out of date, re-push it:
```bash
sed '3d' src-tauri/db/seed.sql | turso db shell paper-trail
```

## Benefits of Turso

- **Local-first**: Faster queries, works offline
- **Edge deployment**: Deploy read replicas globally
- **Cost-effective**: Generous free tier, pay per read/write
- **SQLite compatible**: All your existing SQL code works
- **Multi-device sync**: Sync same database across multiple devices

## Additional Resources

- [Turso Documentation](https://docs.turso.tech)
- [libSQL Rust SDK](https://docs.turso.tech/sdk/rust)
- [Embedded Replicas Guide](https://docs.turso.tech/features/embedded-replicas)
