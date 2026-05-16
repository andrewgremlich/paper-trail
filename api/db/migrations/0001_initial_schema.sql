-- Migration 0001 — Initial schema (squash of 0001 + 0002)
--
-- Single-source-of-truth for Paper Trail. All migrations have been
-- squashed into this file before any production data existed.
--
-- Conventions:
-- * users.id stays INTEGER (autoincrement). clerkUserId is the stable
--   Clerk `sub` claim used as the primary identity; cross-device identity
--   is also carried by the separate users.uuid column.
-- * Every other user-owned table uses TEXT UUID primary keys, generated
--   in code with crypto.randomUUID() at INSERT time.
-- * Sensitive fields are encrypted with AES-256-GCM (see api/src/lib/crypto.ts).
--   The encrypted columns are declared TEXT here so SQLite stores the
--   prefixed base64 ciphertext verbatim — no implicit type coercion.
-- * Money: cents, encrypted as a string ("rate_in_cents", "amount",
--   "amount_cents") so we don't have to round-trip integers through
--   text + encryption.
-- * Dates: ISO YYYY-MM-DD for entry dates; ISO timestamps for createdAt
--   and similar columns.

-- =====================
-- users  (auto-created on first login by clerkAuth middleware)
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  clerkUserId TEXT,
  venmoHandle TEXT,           -- encrypted, nullable
  paypalHandle TEXT,          -- encrypted, nullable
  businessName TEXT,          -- encrypted, nullable but required to send
  businessAddress TEXT,       -- encrypted, nullable but required to send
  -- Per-user Resend config (migrations 0003). Both encrypted at rest.
  -- When both are set, invoice/consent emails are sent via the user's own
  -- Resend account. When unset, falls back to the shared RESEND_API_KEY env
  -- var and uses a minimal link-only email body.
  resendApiKey TEXT,          -- encrypted, nullable
  resendFromAddress TEXT,     -- encrypted, nullable
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerkUserId
  ON users(clerkUserId) WHERE clerkUserId IS NOT NULL;

-- =====================
-- schema_migrations  (legacy tracking table; kept for compatibility)
-- =====================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY
);

-- =====================
-- customers  (created before projects so projects.customerId can FK)
-- =====================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,         -- encrypted
  email TEXT NOT NULL,        -- encrypted
  address TEXT,               -- encrypted, nullable but required to send
  consentToEmailInvoices INTEGER NOT NULL DEFAULT 0 CHECK (consentToEmailInvoices IN (0, 1)),
  consentedAt TEXT,
  consentToken TEXT UNIQUE,
  consentRequestedAt TEXT,
  consentIpHash TEXT,         -- salted SHA-256 of confirmer IP
  consentUaHash TEXT,         -- salted SHA-256 of confirmer UA
  -- Single-use token so customers can self-service revoke consent.
  revokeToken TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_userId ON customers(userId);
CREATE INDEX IF NOT EXISTS idx_customers_consentToken ON customers(consentToken);
CREATE INDEX IF NOT EXISTS idx_customers_revokeToken ON customers(revokeToken);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_revokeToken_unique
  ON customers(revokeToken) WHERE revokeToken IS NOT NULL;

-- =====================
-- customer_events  (consent audit log)
-- =====================
CREATE TABLE IF NOT EXISTS customer_events (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'consent_requested', 'consent_granted', 'consent_declined', 'consent_revoked'
  )),
  payload TEXT,               -- encrypted JSON
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_events_customerId ON customer_events(customerId);

-- =====================
-- projects
-- =====================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  name TEXT NOT NULL,
  customerId TEXT REFERENCES customers(id) ON DELETE SET NULL,
  rate_in_cents TEXT NOT NULL DEFAULT '0',  -- encrypted string of integer cents
  description TEXT NOT NULL DEFAULT '',     -- encrypted
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_userId ON projects(userId);
CREATE INDEX IF NOT EXISTS idx_projects_customerId ON projects(customerId);

-- =====================
-- timesheets
-- =====================
CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,           -- encrypted, nullable
  closed INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0, 1)),
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timesheets_projectId ON timesheets(projectId);
CREATE INDEX IF NOT EXISTS idx_timesheets_userId ON timesheets(userId);

-- =====================
-- timesheet_entries
-- =====================
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id TEXT PRIMARY KEY,
  timesheetId TEXT NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  date TEXT NOT NULL
    CHECK (
      length(date) = 10
      AND date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
      AND date(date) IS NOT NULL
    ),
  minutes INTEGER NOT NULL CHECK (minutes >= 0),
  description TEXT NOT NULL,  -- encrypted
  amount TEXT NOT NULL,       -- encrypted string of integer cents
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheetId ON timesheet_entries(timesheetId);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheetId_date ON timesheet_entries(timesheetId, date);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_userId ON timesheet_entries(userId);

-- =====================
-- transactions
-- =====================
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL
    CHECK (
      length(date) = 10
      AND date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
      AND date(date) IS NOT NULL
    ),
  description TEXT NOT NULL,  -- encrypted
  amount TEXT NOT NULL,       -- encrypted string of integer cents (signed)
  filePath TEXT,              -- R2 key, nullable. Mirrors attachments.id when set.
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_projectId ON transactions(projectId);
CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId);

-- =====================
-- attachments  (lifecycle authority for R2 file objects)
--
-- A row exists for every R2 object the user has uploaded. The R2 key IS
-- the attachments.id (UUIDv4), so there is exactly one source of truth
-- for "this file exists and belongs to this user".
--
-- Lifecycle states, by column values:
--   * pending:  attachedAt IS NULL
--               (just uploaded, not yet linked to a transaction)
--   * attached: attachedAt IS NOT NULL AND txId IS NOT NULL
--   * orphaned: attachedAt IS NOT NULL AND txId IS NULL
--               (was attached, then the transaction was deleted, the
--               attachment was replaced, or the linked tx was deleted by
--               cascade)
--
-- The cron sweeper (see api/src/scheduled.ts) deletes pending rows older
-- than PENDING_TTL and orphaned rows older than ORPHAN_GRACE_PERIOD,
-- removing both the DB row and the R2 object in lockstep.
--
-- originalName is encrypted because filenames frequently leak intent or
-- subject matter ("medical_invoice.pdf", "lawsuit_settlement.pdf"). All
-- other columns stay plaintext because they're either non-sensitive
-- (size, content type) or required for sweep predicates / FK joins
-- (userId, txId, createdAt, attachedAt).
-- =====================
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,                -- R2 object key (UUIDv4)
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  originalName TEXT NOT NULL,         -- encrypted
  contentType TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL CHECK (sizeBytes >= 0),
  txId TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  attachedAt TEXT,                    -- NULL while pending; set on first attach
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_userId ON attachments(userId);
CREATE INDEX IF NOT EXISTS idx_attachments_txId ON attachments(txId);
-- Partial index makes the cron's "find pending uploads" scan O(pending) not O(all).
CREATE INDEX IF NOT EXISTS idx_attachments_pending
  ON attachments(createdAt) WHERE attachedAt IS NULL;
-- Partial index for the cron's "find orphaned attachments" scan.
CREATE INDEX IF NOT EXISTS idx_attachments_orphaned
  ON attachments(attachedAt) WHERE txId IS NULL AND attachedAt IS NOT NULL;

-- =====================
-- invoices  (source of truth; the URL on the public hosted page is the id)
-- =====================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customerId TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  timesheetId TEXT REFERENCES timesheets(id) ON DELETE SET NULL,
  number TEXT NOT NULL,                                        -- e.g. INV-2026-0001
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  amount_cents TEXT NOT NULL,                                  -- encrypted
  description TEXT,                                            -- encrypted, nullable
  issuedAt TEXT NOT NULL,                                      -- ISO date
  dueDate TEXT NOT NULL,                                       -- ISO date, >= issuedAt
  snapshot TEXT,                                               -- encrypted JSON; frozen at send time
  sentAt TEXT,
  paidAt TEXT,
  voidedAt TEXT,
  archivedAt TEXT,                                             -- soft-delete; rows are never hard-deleted
  -- Per-invoice access token. Required in the hosted URL query string
  -- (?t=<token>) for sent invoices. Rotated on every send so old
  -- emailed links stop working after a resend.
  accessToken TEXT,
  -- Bounded lifetime for `accessToken`. Stamped at `sentAt + 90 days`
  -- on every send/resend; the public hosted route 404s once the
  -- timestamp is in the past so a forwarded link can't render the
  -- snapshot indefinitely.
  accessTokenExpiresAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (userId, number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_userId ON invoices(userId);
CREATE INDEX IF NOT EXISTS idx_invoices_customerId ON invoices(customerId);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_timesheetId ON invoices(timesheetId);
CREATE INDEX IF NOT EXISTS idx_invoices_accessToken ON invoices(accessToken);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_accessToken_unique
  ON invoices(accessToken) WHERE accessToken IS NOT NULL;

-- =====================
-- invoice_events  (audit log; includes hashed-IP/UA on 'viewed' rows)
-- =====================
CREATE TABLE IF NOT EXISTS invoice_events (
  id TEXT PRIMARY KEY,
  invoiceId TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('created', 'sent', 'paid', 'voided', 'viewed')),
  payload TEXT,               -- encrypted JSON
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_events_invoiceId ON invoice_events(invoiceId);

-- =====================
-- send_rate_log  (30 sends/hour throttle, enforced in api/src/lib/rateLimit.ts)
--
-- recipientHash is the HMAC-SHA-256 of the recipient email keyed by
-- ENCRYPTION_KEY, used by assertWithinSendLimit to also cap the number
-- of unique recipients a single user can spray in a rolling window.
-- Protects shared sending-domain reputation from a single bad-actor
-- account.
-- =====================
CREATE TABLE IF NOT EXISTS send_rate_log (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sentAt TEXT NOT NULL DEFAULT (datetime('now')),
  recipientHash TEXT
);

CREATE INDEX IF NOT EXISTS idx_send_rate_log_userId_sentAt ON send_rate_log(userId, sentAt);
CREATE INDEX IF NOT EXISTS idx_send_rate_log_userId_recipient_sentAt
  ON send_rate_log(userId, recipientHash, sentAt);

-- =====================
-- updatedAt triggers
-- =====================

CREATE TRIGGER IF NOT EXISTS trg_users_set_updatedAt
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_customers_set_updatedAt
AFTER UPDATE ON customers
FOR EACH ROW
BEGIN
  UPDATE customers SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_set_updatedAt
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
  UPDATE projects SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_timesheets_set_updatedAt
AFTER UPDATE ON timesheets
FOR EACH ROW
BEGIN
  UPDATE timesheets SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_timesheet_entries_set_updatedAt
AFTER UPDATE ON timesheet_entries
FOR EACH ROW
BEGIN
  UPDATE timesheet_entries SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_transactions_set_updatedAt
AFTER UPDATE ON transactions
FOR EACH ROW
BEGIN
  UPDATE transactions SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_invoices_set_updatedAt
AFTER UPDATE ON invoices
FOR EACH ROW
BEGIN
  UPDATE invoices SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_attachments_set_updatedAt
AFTER UPDATE ON attachments
FOR EACH ROW
BEGIN
  UPDATE attachments SET updatedAt = datetime('now') WHERE id = OLD.id;
END;
