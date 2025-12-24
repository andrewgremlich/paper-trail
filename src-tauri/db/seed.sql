-- Enable foreign keys and set write-ahead logging for better concurrency
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  name TEXT NOT NULL,
  customerId TEXT, -- external id provided by stripe
  rate INTEGER,
  description TEXT,
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER))
);
CREATE TABLE IF NOT EXISTS timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  invoiceId TEXT, -- external id provided by stripe
  name TEXT NOT NULL,
  description TEXT,
  closed INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0, 1)),
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (projectId, name)
);
-- amount is stored in integer cents to avoid floating point errors
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timesheetId INTEGER NOT NULL,
  date INTEGER NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes >= 0),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
  FOREIGN KEY (timesheetId) REFERENCES timesheets(id) ON DELETE CASCADE
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_customerId ON projects(customerId);
CREATE INDEX IF NOT EXISTS idx_timesheets_projectId ON timesheets(projectId);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheetId ON timesheet_entries(timesheetId);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheetId_date ON timesheet_entries(timesheetId, date);

-- Transactions table (original schema requested)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  date INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  filePath TEXT,
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_projectId ON transactions(projectId);

-- Auto-update updatedAt on row updates (non-recursive)
-- Projects
CREATE TRIGGER IF NOT EXISTS trg_projects_set_updatedAt
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
  UPDATE projects SET updatedAt = CAST(strftime('%s','now') AS INTEGER) WHERE id = OLD.id;
END;

-- Timesheets
CREATE TRIGGER IF NOT EXISTS trg_timesheets_set_updatedAt
AFTER UPDATE ON timesheets
FOR EACH ROW
BEGIN
  UPDATE timesheets SET updatedAt = CAST(strftime('%s','now') AS INTEGER) WHERE id = OLD.id;
END;

-- Timesheet Entries
CREATE TRIGGER IF NOT EXISTS trg_timesheet_entries_set_updatedAt
AFTER UPDATE ON timesheet_entries
FOR EACH ROW
BEGIN
  UPDATE timesheet_entries SET updatedAt = CAST(strftime('%s','now') AS INTEGER) WHERE id = OLD.id;
END;

-- Transactions
CREATE TRIGGER IF NOT EXISTS trg_transactions_set_updatedAt
AFTER UPDATE ON transactions
FOR EACH ROW
BEGIN
  UPDATE transactions SET updatedAt = CAST(strftime('%s','now') AS INTEGER) WHERE id = OLD.id;
END;

-- Set createdAt/updatedAt on insert when not provided
-- Projects
CREATE TRIGGER IF NOT EXISTS trg_projects_set_timestamps_on_insert
AFTER INSERT ON projects
FOR EACH ROW
BEGIN
  UPDATE projects
  SET createdAt = CAST(strftime('%s','now') AS INTEGER)
  WHERE id = NEW.id AND NEW.createdAt IS NULL;
  UPDATE projects
  SET updatedAt = CAST(strftime('%s','now') AS INTEGER)
  WHERE id = NEW.id AND NEW.updatedAt IS NULL;
END;

-- Timesheets
CREATE TRIGGER IF NOT EXISTS trg_timesheets_set_timestamps_on_insert
AFTER INSERT ON timesheets
FOR EACH ROW
BEGIN
  UPDATE timesheets
  SET createdAt = CAST(strftime('%s','now') AS INTEGER)
  WHERE id = NEW.id AND NEW.createdAt IS NULL;
  UPDATE timesheets
  SET updatedAt = CAST(strftime('%s','now') AS INTEGER)
  WHERE id = NEW.id AND NEW.updatedAt IS NULL;
END;

-- Timesheet Entries
CREATE TRIGGER IF NOT EXISTS trg_timesheet_entries_set_timestamps_on_insert
AFTER INSERT ON timesheet_entries
FOR EACH ROW
BEGIN
  UPDATE timesheet_entries
  SET createdAt = CAST(strftime('%s','now') AS INTEGER)
  WHERE id = NEW.id AND NEW.createdAt IS NULL;
  UPDATE timesheet_entries
  SET updatedAt = CAST(strftime('%s','now') AS INTEGER)
  WHERE id = NEW.id AND NEW.updatedAt IS NULL;
END;

-- Transactions
CREATE TRIGGER IF NOT EXISTS trg_transactions_set_timestamps_on_insert
AFTER INSERT ON transactions
FOR EACH ROW
BEGIN
  UPDATE transactions
  SET createdAt = CAST(strftime('%s','now') AS INTEGER)
  WHERE id = NEW.id AND NEW.createdAt IS NULL;
  UPDATE transactions
  SET updatedAt = CAST(strftime('%s','now') AS INTEGER)
  WHERE id = NEW.id AND NEW.updatedAt IS NULL;
END;
