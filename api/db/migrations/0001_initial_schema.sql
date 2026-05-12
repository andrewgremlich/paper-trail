-- Migration 0001 — Initial schema
--
-- Single-source-of-truth for Paper Trail. Earlier migrations
-- (initial, stripe-replacement, uuid-primary-keys) were squashed into
-- this file before any production data existed.
--
-- Conventions:
-- * users.id stays INTEGER (autoincrement). Cloudflare Access auth
--   creates rows here via INSERT OR IGNORE; cross-device identity is
--   carried by the separate users.uuid column.
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
-- users  (auto-created on first login by cfAccessAuth middleware)
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  venmoHandle TEXT,           -- encrypted, nullable
  paypalHandle TEXT,          -- encrypted, nullable
  businessName TEXT,          -- encrypted, nullable but required to send
  businessAddress TEXT,       -- encrypted, nullable but required to send
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

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
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_userId ON customers(userId);
CREATE INDEX IF NOT EXISTS idx_customers_consentToken ON customers(consentToken);

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
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
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
  filePath TEXT,              -- R2 key, nullable
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_projectId ON transactions(projectId);
CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId);

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
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (userId, number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_userId ON invoices(userId);
CREATE INDEX IF NOT EXISTS idx_invoices_customerId ON invoices(customerId);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_timesheetId ON invoices(timesheetId);

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
-- =====================
CREATE TABLE IF NOT EXISTS send_rate_log (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sentAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_send_rate_log_userId_sentAt ON send_rate_log(userId, sentAt);

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
