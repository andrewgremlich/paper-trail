-- Migration number: 0003 	 2026-05-28T00:30:57.305Z
--
-- Adds an optional out-of-band contact channel + handle to customers.
-- contactChannel is a plain enum (phone | sms | whatsapp | telegram |
-- signal | discord) used to drive deep links and icons; left unencrypted
-- so the UI can render channel-specific links without decrypting first.
-- contactValue is the actual handle/number and is encrypted at rest like
-- name/email/address.

ALTER TABLE customers ADD COLUMN contactChannel TEXT
  CHECK (contactChannel IN ('phone', 'sms', 'whatsapp', 'telegram', 'signal', 'discord'));

ALTER TABLE customers ADD COLUMN contactValue TEXT; -- encrypted, nullable
