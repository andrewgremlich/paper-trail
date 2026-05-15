-- Migration 0002 — Clerk user identity
--
-- The auth provider has been swapped from Cloudflare Access (which identifies
-- users by email only) to Clerk (which issues a stable `sub` claim, e.g.
-- `user_2abcDEF...`, that survives email changes and re-signups).
--
-- We add `clerkUserId` as the new primary identity column. The Clerk auth
-- middleware looks up the local users row by clerkUserId first, then falls
-- back to a one-time email match for any pre-Clerk rows so existing data
-- carries over cleanly (the row is then patched with the clerkUserId so the
-- lookup is fast on every subsequent request).
--
-- email stays NOT NULL and continues to mirror the verified Clerk email — it
-- powers the existing "From" address fallback, the invoice snapshot seller
-- block, and the export bundle. Display name now also comes from Clerk on
-- first login when the local row is created empty.

ALTER TABLE users ADD COLUMN clerkUserId TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerkUserId
  ON users(clerkUserId) WHERE clerkUserId IS NOT NULL;
