#!/usr/bin/env bash
# Wipe the production D1 database, empty the production R2 bucket, and
# re-apply the single consolidated migration. Destructive — only run
# when you're certain nothing on the remote needs to be preserved.
#
# Run with:  bash scripts/reset-remote.sh
#
# Pre-reqs (always):
#   `wrangler login` (or CLOUDFLARE_API_TOKEN env var) must be in place.
#
# To also wipe R2 in this script, export:
#   R2_ACCOUNT_ID         (Cloudflare account id)
#   R2_ACCESS_KEY_ID      (R2 API token — Object Read & Write scope)
#   R2_SECRET_ACCESS_KEY  (same token's secret)
# and have the `aws` CLI installed. Without those, the R2 step is
# skipped and you'll get a link to the dashboard.

set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="paper-trail-db"
BUCKET_NAME="paper-trail-files"

echo "→ Dropping every table on remote D1 ($DB_NAME)..."
# Disable FK enforcement, drop tables in any order, drop the wrangler-internal
# d1_migrations table so the new 0001 will reapply on the next migrate.
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

# ----- R2 wipe -----
if [[ -n "${R2_ACCOUNT_ID:-}" && -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "✗ aws CLI not found on PATH. Install it or wipe the bucket from the dashboard."
    exit 1
  fi
  R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  echo "→ Emptying R2 bucket $BUCKET_NAME via $R2_ENDPOINT ..."
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION="auto" \
    aws s3 rm "s3://$BUCKET_NAME" --recursive --endpoint-url "$R2_ENDPOINT"
  echo "✓ R2 bucket emptied."
else
  cat <<EOF
ℹ  Skipping R2 wipe (no R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).

   wrangler can't list R2 objects from the CLI, so to wipe automatically
   either:

   1. Open the dashboard:
        https://dash.cloudflare.com/?to=/:account/r2/default/buckets/$BUCKET_NAME
      and click "Delete all objects".

   2. Or, create an R2 API token (Object Read & Write) and re-run this
      script with:
        export R2_ACCOUNT_ID=...
        export R2_ACCESS_KEY_ID=...
        export R2_SECRET_ACCESS_KEY=...
EOF
fi

echo "✓ D1 is at the consolidated 0001 schema."
