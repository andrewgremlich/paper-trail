-- Migration number: 0002 	 2026-05-13T19:42:13.326Z
-- Add a single-use revocation token so customers can self-service revoke
-- consent via a link included in every invoice email.
ALTER TABLE customers ADD COLUMN revokeToken TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_revokeToken ON customers(revokeToken);
