-- Enable foreign keys and set write-ahead logging for better concurrency
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- =====================
-- Projects
-- =====================
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  name TEXT NOT NULL,
  customerId TEXT NOT NULL, -- external id provided by stripe
  rate_in_cents INTEGER NOT NULL DEFAULT 0 CHECK (rate_in_cents >= 0), -- stored in integer cents to avoid floating point errors
  description TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================
-- Timesheets
-- =====================
CREATE TABLE IF NOT EXISTS timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  invoiceId TEXT, -- external id provided by stripe
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

-- =====================
-- Timesheet Entries
-- =====================
-- amount is stored in integer cents to avoid floating point errors
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timesheetId INTEGER NOT NULL,
  date TEXT NOT NULL
    CHECK (
      length(date) = 10
      AND date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
      AND date(date) IS NOT NULL
    ),
  minutes INTEGER NOT NULL CHECK (minutes >= 0),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (timesheetId) REFERENCES timesheets(id) ON DELETE CASCADE
);


-- =====================
-- Transactions
-- =====================
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  date TEXT NOT NULL
    CHECK (
      length(date) = 10
      AND date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
      AND date(date) IS NOT NULL
    ),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  filePath TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);


-- =====================
-- Indexes
-- =====================
CREATE INDEX IF NOT EXISTS idx_projects_customerId
  ON projects(customerId);

CREATE INDEX IF NOT EXISTS idx_timesheets_projectId
  ON timesheets(projectId);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheetId
  ON timesheet_entries(timesheetId);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheetId_date
  ON timesheet_entries(timesheetId, date);

CREATE INDEX IF NOT EXISTS idx_transactions_projectId
  ON transactions(projectId);

-- =====================
-- Auto-update updatedAt triggers
-- =====================

-- Projects
CREATE TRIGGER IF NOT EXISTS trg_projects_set_updatedAt
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
  UPDATE projects
  SET updatedAt = datetime('now')
  WHERE id = OLD.id;
END;

-- Timesheets
CREATE TRIGGER IF NOT EXISTS trg_timesheets_set_updatedAt
AFTER UPDATE ON timesheets
FOR EACH ROW
BEGIN
  UPDATE timesheets
  SET updatedAt = datetime('now')
  WHERE id = OLD.id;
END;

-- Timesheet Entries
CREATE TRIGGER IF NOT EXISTS trg_timesheet_entries_set_updatedAt
AFTER UPDATE ON timesheet_entries
FOR EACH ROW
BEGIN
  UPDATE timesheet_entries
  SET updatedAt = datetime('now')
  WHERE id = OLD.id;
END;

-- Transactions
CREATE TRIGGER IF NOT EXISTS trg_transactions_set_updatedAt
AFTER UPDATE ON transactions
FOR EACH ROW
BEGIN
  UPDATE transactions
  SET updatedAt = datetime('now')
  WHERE id = OLD.id;
END;
