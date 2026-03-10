-- =====================
-- User Profile (created first — referenced by other tables)
-- =====================
CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================
-- Schema Migrations
-- =====================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY
);

-- =====================
-- Projects
-- =====================
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  name TEXT NOT NULL,
  customerId TEXT NOT NULL,
  rate_in_cents INTEGER NOT NULL DEFAULT 0 CHECK (rate_in_cents >= 0),
  description TEXT NOT NULL DEFAULT '',
  userId INTEGER NOT NULL DEFAULT 0 REFERENCES user_profile(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================
-- Timesheets
-- =====================
CREATE TABLE IF NOT EXISTS timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  invoiceId TEXT,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  userId INTEGER NOT NULL DEFAULT 0 REFERENCES user_profile(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

-- =====================
-- Timesheet Entries
-- =====================
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
  userId INTEGER NOT NULL DEFAULT 0 REFERENCES user_profile(id),
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
  userId INTEGER NOT NULL DEFAULT 0 REFERENCES user_profile(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

-- =====================
-- Indexes
-- =====================
CREATE INDEX IF NOT EXISTS idx_projects_customerId ON projects(customerId);
CREATE INDEX IF NOT EXISTS idx_timesheets_projectId ON timesheets(projectId);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheetId ON timesheet_entries(timesheetId);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheetId_date ON timesheet_entries(timesheetId, date);
CREATE INDEX IF NOT EXISTS idx_transactions_projectId ON transactions(projectId);
CREATE INDEX IF NOT EXISTS idx_projects_userId ON projects(userId);
CREATE INDEX IF NOT EXISTS idx_timesheets_userId ON timesheets(userId);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_userId ON timesheet_entries(userId);
CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId);

-- =====================
-- Auto-update updatedAt triggers
-- =====================

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

CREATE TRIGGER IF NOT EXISTS trg_user_profile_set_updatedAt
AFTER UPDATE ON user_profile
FOR EACH ROW
BEGIN
  UPDATE user_profile SET updatedAt = datetime('now') WHERE id = OLD.id;
END;
