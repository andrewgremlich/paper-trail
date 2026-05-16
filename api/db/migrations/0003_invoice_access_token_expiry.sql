-- INV1: bound the lifetime of a hosted-invoice access token.
--
-- `accessToken` was previously open-ended — a forwarded "View invoice"
-- link from two years ago still rendered the snapshot to anyone with
-- the URL. Adding an explicit expiry lets the public route 404 stale
-- links without the operator having to resend or void the invoice.
--
-- The column is nullable so older sent invoices (which have no expiry)
-- keep working until they are resent. The send handler stamps the new
-- expiry every time an invoice is sent or resent.

ALTER TABLE invoices ADD COLUMN accessTokenExpiresAt TEXT;
