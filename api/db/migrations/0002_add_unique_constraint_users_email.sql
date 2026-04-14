-- Migration number: 0002 	 2026-04-14T02:26:16.025Z

-- Remove duplicate users keeping the lowest id per email,
-- then enforce uniqueness so concurrent logins can't race-insert duplicates.

-- Delete duplicates, keeping the earliest row per email
DELETE FROM users
WHERE id NOT IN (
  SELECT MIN(id) FROM users GROUP BY email
);

-- Add unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
