-- Migration 0002 — UNIQUE constraints on revokeToken / accessToken
--
-- §12 from docs/SECURITY_REMAINING.md. customers.consentToken is already
-- declared UNIQUE inline; the two single-use tokens added in later
-- migrations (customers.revokeToken, invoices.accessToken) are not.
-- Collisions are cryptographically improbable from 32 random bytes, but a
-- future RNG regression would silently misroute lookups instead of
-- erroring out. Partial-unique indexes preserve the existing behaviour of
-- many NULL rows (tokens are cleared on use).

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_revokeToken_unique
  ON customers(revokeToken) WHERE revokeToken IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_accessToken_unique
  ON invoices(accessToken) WHERE accessToken IS NOT NULL;
