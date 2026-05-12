#!/usr/bin/env bash
# Wipe the production D1 database, the production R2 bucket, and re-apply
# the single consolidated migration. Destructive — only run when you're
# certain nothing on the remote needs to be preserved.
#
# Run with:  bash scripts/reset-remote.sh
#
# Pre-reqs:  `wrangler login` (or CLOUDFLARE_API_TOKEN env var) must be
# in place so wrangler can hit the remote.

set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="paper-trail-db"
BUCKET_NAME="paper-trail-files"

echo "→ Dropping every table on remote D1 ($DB_NAME)..."
# Disable FK enforcement, drop tables in any order, drop the wrangler-internal
# d1_migrations table so the new 0001 will reapply.
pnpm exec wrangler d1 execute "$DB_NAME" --remote --yes --command "
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS invoice_events;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS customer_events;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS timesheet_entries;
DROP TABLE IF EXISTS timesheets;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS send_rate_log;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS schema_migrations;
DROP TABLE IF EXISTS d1_migrations;
DROP TABLE IF EXISTS stripe_connections;
"

echo "→ Re-applying consolidated migration on remote..."
pnpm run migrate:remote

echo "→ Listing remote R2 objects in $BUCKET_NAME and deleting them..."
# `r2 object list` paginates; loop until the bucket reports empty.
while :; do
  KEYS=$(pnpm exec wrangler r2 object list "$BUCKET_NAME" --json 2>/dev/null \
    | python3 -c "import sys, json; d=json.load(sys.stdin); print('\n'.join(o['key'] for o in d.get('objects', [])))")
  [ -z "$KEYS" ] && break
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    echo "  deleting $key"
    pnpm exec wrangler r2 object delete "$BUCKET_NAME/$key" --remote --yes
  done <<< "$KEYS"
done

echo "✓ Remote D1 + R2 are clean and the schema is at 0001."
