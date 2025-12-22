CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  customerId TEXT,
  rate INTEGER,
  description TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  invoiceId TEXT,
  name TEXT NOT NULL,
  description TEXT,
  closed BOOLEAN NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id TEXT PRIMARY KEY,
  timesheetId TEXT NOT NULL,
  date DATETIME NOT NULL,
  hours INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (timesheetId) REFERENCES timesheets(id) ON DELETE CASCADE
);
-- Indexes for performance (optional)
CREATE INDEX IF NOT EXISTS idx_projects_customerId ON projects(customerId);
CREATE INDEX IF NOT EXISTS idx_timesheets_projectId ON timesheets(projectId);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheetId ON timesheet_entries(timesheetId);