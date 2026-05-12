-- Migration number: 0003   Replace Stripe with custom invoicing (Resend + Venmo/PayPal)
--
-- This migration:
--   1. Drops the Stripe Connect connections table
--   2. Adds payment-handle + business-info columns to users
--   3. Creates customers table (with double-opt-in consent tracking)
--   4. Creates customer_events audit log
--   5. Creates invoices table (source of truth, replaces Stripe)
--   6. Creates invoice_events audit log
--   7. Creates send_rate_log for rate limiting
--   8. Rewrites projects.customerId from Stripe TEXT to nullable INTEGER FK -> customers(id)
--   9. Drops timesheets.invoiceId (now lives on invoices.timesheetId)
--
-- Existing projects will have their customerId set to NULL and must be re-linked
-- to a customer record post-migration.

-- =====================
-- 1. Drop Stripe table
-- =====================
DROP TRIGGER IF EXISTS trg_stripe_connections_set_updatedAt;
DROP INDEX IF EXISTS idx_stripe_connections_userId;
DROP TABLE IF EXISTS stripe_connections;

-- =====================
-- 2. Extend users with payment handles and business identity
-- =====================
ALTER TABLE users ADD COLUMN venmoHandle TEXT;
ALTER TABLE users ADD COLUMN paypalHandle TEXT;
ALTER TABLE users ADD COLUMN businessName TEXT;
ALTER TABLE users ADD COLUMN businessAddress TEXT;

-- =====================
-- 3. Customers
-- =====================
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE INDEX IF NOT EXISTS idx_customers_userId ON customers(userId);
CREATE INDEX IF NOT EXISTS idx_customers_consentToken ON customers(consentToken);

CREATE TRIGGER IF NOT EXISTS trg_customers_set_updatedAt
AFTER UPDATE ON customers
FOR EACH ROW
BEGIN
  UPDATE customers SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

-- =====================
-- 4. Customer events (consent audit log)
-- =====================
CREATE TABLE IF NOT EXISTS customer_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('consent_requested', 'consent_granted', 'consent_declined', 'consent_revoked')),
  payload TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_events_customerId ON customer_events(customerId);

-- =====================
-- 5. Invoices
-- =====================
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customerId INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  timesheetId INTEGER REFERENCES timesheets(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_invoices_userId ON invoices(userId);
CREATE INDEX IF NOT EXISTS idx_invoices_uuid ON invoices(uuid);
CREATE INDEX IF NOT EXISTS idx_invoices_customerId ON invoices(customerId);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_timesheetId ON invoices(timesheetId);

CREATE TRIGGER IF NOT EXISTS trg_invoices_set_updatedAt
AFTER UPDATE ON invoices
FOR EACH ROW
BEGIN
  UPDATE invoices SET updatedAt = datetime('now') WHERE id = OLD.id;
END;

-- =====================
-- 6. Invoice events (audit log)
-- =====================
CREATE TABLE IF NOT EXISTS invoice_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoiceId INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('created', 'sent', 'paid', 'voided', 'viewed')),
  payload TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_events_invoiceId ON invoice_events(invoiceId);

-- =====================
-- 7. Send rate log
-- =====================
CREATE TABLE IF NOT EXISTS send_rate_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sentAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_send_rate_log_userId_sentAt ON send_rate_log(userId, sentAt);

-- =====================
-- 8. Rewrite projects.customerId from Stripe TEXT to nullable INTEGER FK
--    (existing projects will have NULL customerId and must be re-linked)
-- =====================
DROP INDEX IF EXISTS idx_projects_customerId;
ALTER TABLE projects DROP COLUMN customerId;
ALTER TABLE projects ADD COLUMN customerId INTEGER REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_customerId ON projects(customerId);

-- =====================
-- 9. Drop timesheets.invoiceId (now lives on invoices.timesheetId)
-- =====================
ALTER TABLE timesheets DROP COLUMN invoiceId;
