-- =====================
-- Per-user Data Encryption Keys (DEKs)
-- =====================
-- Adds the columns needed to envelope-encrypt each user's data under
-- a per-user DEK that is itself wrapped by a versioned Key Encryption
-- Key (KEK_V<n>). The migration only adds columns; existing rows keep
-- their NULL DEK and continue to be served by the legacy single-key
-- path until the DEK backfill worker has rewritten their ciphertext.
--
-- Gating: the auth middleware only materialises a DEK when the
-- DEK_MIGRATION_ENABLED env binding is set to "true". Until that
-- flag flips, this migration is a no-op at runtime.

ALTER TABLE users ADD COLUMN wrappedDek TEXT;
ALTER TABLE users ADD COLUMN kekVersion INTEGER;
ALTER TABLE users ADD COLUMN dekCreatedAt TEXT;

-- Per-row migration tracking. A row appears here once every encrypted
-- column on `(tableName, rowId)` has been re-encrypted under the
-- owning user's DEK. The presence of the row is the marker; the
-- backfill worker queries `LEFT JOIN ... WHERE dek_migration.rowId IS
-- NULL` to find work. Idempotent: the UNIQUE index makes restarts
-- safe.
CREATE TABLE IF NOT EXISTS dek_migration (
  tableName TEXT NOT NULL,
  rowId TEXT NOT NULL,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  migratedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tableName, rowId)
);

CREATE INDEX IF NOT EXISTS idx_dek_migration_userId
  ON dek_migration(userId);
