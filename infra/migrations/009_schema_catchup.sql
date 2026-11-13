-- 009_schema_catchup.sql (Nov 2026)
-- Production has these, the code depends on them, but no earlier migration created them
-- (they were added by hand). Found when the e2e suites started building their database
-- from schema.sql + migrations in CI. Everything is IF NOT EXISTS: safe to run on RDS,
-- where it changes nothing.
--
-- Rollback: not needed (no-op on production). To undo on a fresh database:
--   DROP TABLE test_accounts; ALTER TABLE users DROP COLUMN referral_code,
--   DROP COLUMN referred_by, DROP COLUMN referral_rewarded;

-- Accounts that skip the paywall (form-handler decideEntitlement / peekEntitlement).
CREATE TABLE IF NOT EXISTS test_accounts (
  email VARCHAR(255) PRIMARY KEY
);

-- Referrals (profile handler issues the code; stripe-webhook rewards the referrer once).
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code     VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by       VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_rewarded BOOLEAN DEFAULT FALSE;
