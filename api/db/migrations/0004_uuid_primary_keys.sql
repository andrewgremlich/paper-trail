-- Migration number: 0004   Convert primary keys to TEXT UUIDs
--
-- All user-owned entities (projects, timesheets, timesheet_entries, transactions,
-- customers, invoices, customer_events, invoice_events) get a TEXT UUID primary key
-- and the FKs that point at them switch to TEXT.
--
-- The users table is intentionally left alone (its id is referenced by every
-- userId FK and the cfAccessAuth middleware already keeps a separate uuid column
-- for cross-device identity).
--
-- DESTRUCTIVE: this migration drops every existing row in the user-owned tables.
-- It is safe to run locally and safe to run remotely while there is no real
-- customer/invoice data in production. R2 file objects referenced by the dropped
-- transactions are NOT cleaned up — they become orphans that can be deleted by hand
-- with `wrangler r2 object delete` if needed.

PRAGMA foreign_keys = OFF;

-- =====================
-- Drop old triggers, indexes, and tables
-- =====================
DROP TRIGGER IF EXISTS trg_invoices_set_updatedAt;
DROP TRIGGER IF EXISTS trg_customers_set_updatedAt;
DROP TRIGGER IF EXISTS trg_transactions_set_updatedAt;
DROP TRIGGER IF EXISTS trg_timesheet_entries_set_updatedAt;
DROP TRIGGER IF EXISTS trg_timesheets_set_updatedAt;
DROP TRIGGER IF EXISTS trg_projects_set_updatedAt;

DROP INDEX IF EXISTS idx_invoice_events_invoiceId;
DROP INDEX IF EXISTS idx_invoices_userId;
DROP INDEX IF EXISTS idx_invoices_uuid;
DROP INDEX IF EXISTS idx_invoices_customerId;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_invoices_timesheetId;
DROP INDEX IF EXISTS idx_customer_events_customerId;
DROP INDEX IF EXISTS idx_customers_userId;
DROP INDEX IF EXISTS idx_customers_consentToken;
DROP INDEX IF EXISTS idx_transactions_projectId;
DROP INDEX IF EXISTS idx_transactions_userId;
DROP INDEX IF EXISTS idx_timesheet_entries_timesheetId;
DROP INDEX IF EXISTS idx_timesheet_entries_timesheetId_date;
DROP INDEX IF EXISTS idx_timesheet_entries_userId;
DROP INDEX IF EXISTS idx_timesheets_projectId;
DROP INDEX IF EXISTS idx_timesheets_userId;
DROP INDEX IF EXISTS idx_projects_customerId;
DROP INDEX IF EXISTS idx_projects_userId;
DROP INDEX IF EXISTS idx_send_rate_log_userId_sentAt;

DROP TABLE IF EXISTS invoice_events;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS customer_events;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS timesheet_entries;
DROP TABLE IF EXISTS timesheets;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS send_rate_log;

-- =====================
-- Recreate with TEXT UUID primary keys
-- =====================

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  name TEXT NOT NULL,
  customerId TEXT REFERENCES customers(id) ON DELETE SET NULL,
  rate_in_cents TEXT NOT NULL DEFAULT '0',
  description TEXT NOT NULL DEFAULT '',
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE timesheets (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE timesheet_entries (
  id TEXT PRIMARY KEY,
  timesheetId TEXT NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  date TEXT NOT NULL
    CHECK (
      length(date) = 10
      AND date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
      AND date(date) IS NOT NULL
    ),
  minutes INTEGER NOT NULL CHECK (minutes >= 0),
  description TEXT NOT NULL,
  amount TEXT NOT NULL,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL
    CHECK (
      length(date) = 10
      AND date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
      AND date(date) IS NOT NULL
    ),
  description TEXT NOT NULL,
  amount TEXT NOT NULL,
  filePath TEXT,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  consentToEmailInvoices INTEGER NOT NULL DEFAULT 0 CHECK (consentToEmailInvoices IN (0, 1)),
  consentedAt TEXT,
  consentToken TEXT UNIQUE,
  consentRequestedAt TEXT,
  consentIpHash TEXT,
  consentUaHash TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE customer_events (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('consent_requested', 'consent_granted', 'consent_declined', 'consent_revoked')),
  payload TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invoices (
  -- id IS the UUID (the redundant `uuid` column from migration 0003 is gone).
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customerId TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  timesheetId TEXT REFERENCES timesheets(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  amount_cents TEXT NOT NULL,
  description TEXT,
  issuedAt TEXT NOT NULL,
  dueDate TEXT NOT NULL,
  snapshot TEXT,
  sentAt TEXT,
  paidAt TEXT,
  voidedAt TEXT,
  archivedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (userId, number)
);

CREATE TABLE invoice_events (
  id TEXT PRIMARY KEY,
  invoiceId TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('created', 'sent', 'paid', 'voided', 'viewed')),
  payload TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE send_rate_log (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sentAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================
-- Indexes
-- =====================
CREATE INDEX idx_projects_userId ON projects(userId);
CREATE INDEX idx_projects_customerId ON projects(customerId);
CREATE INDEX idx_timesheets_projectId ON timesheets(projectId);
CREATE INDEX idx_timesheets_userId ON timesheets(userId);
CREATE INDEX idx_timesheet_entries_timesheetId ON timesheet_entries(timesheetId);
CREATE INDEX idx_timesheet_entries_timesheetId_date ON timesheet_entries(timesheetId, date);
CREATE INDEX idx_timesheet_entries_userId ON timesheet_entries(userId);
CREATE INDEX idx_transactions_projectId ON transactions(projectId);
CREATE INDEX idx_transactions_userId ON transactions(userId);
CREATE INDEX idx_customers_userId ON customers(userId);
CREATE INDEX idx_customers_consentToken ON customers(consentToken);
CREATE INDEX idx_customer_events_customerId ON customer_events(customerId);
CREATE INDEX idx_invoices_userId ON invoices(userId);
CREATE INDEX idx_invoices_customerId ON invoices(customerId);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_timesheetId ON invoices(timesheetId);
CREATE INDEX idx_invoice_events_invoiceId ON invoice_events(invoiceId);
CREATE INDEX idx_send_rate_log_userId_sentAt ON send_rate_log(userId, sentAt);

-- =====================
-- Triggers
-- =====================

CREATE TRIGGER trg_projects_set_updatedAt
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
  UPDATE projects SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_timesheets_set_updatedAt
AFTER UPDATE ON timesheets
FOR EACH ROW
BEGIN
  UPDATE timesheets SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_timesheet_entries_set_updatedAt
AFTER UPDATE ON timesheet_entries
FOR EACH ROW
BEGIN
  UPDATE timesheet_entries SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_transactions_set_updatedAt
AFTER UPDATE ON transactions
FOR EACH ROW
BEGIN
  UPDATE transactions SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_customers_set_updatedAt
AFTER UPDATE ON customers
FOR EACH ROW
BEGIN
  UPDATE customers SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_invoices_set_updatedAt
AFTER UPDATE ON invoices
FOR EACH ROW
BEGIN
  UPDATE invoices SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

PRAGMA foreign_keys = ON;
