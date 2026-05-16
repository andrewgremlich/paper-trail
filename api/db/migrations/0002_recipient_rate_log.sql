-- Per-recipient send throttle column. Pairs with assertWithinSendLimit:
-- when a per-recipient hash is supplied, the recipient hash is recorded
-- alongside the per-user row so we can also cap the number of unique
-- recipients a single user can spray in a rolling window. Protects
-- shared sending-domain reputation from a single bad-actor account.

ALTER TABLE send_rate_log ADD COLUMN recipientHash TEXT;

CREATE INDEX IF NOT EXISTS idx_send_rate_log_userId_recipient_sentAt
  ON send_rate_log(userId, recipientHash, sentAt);
