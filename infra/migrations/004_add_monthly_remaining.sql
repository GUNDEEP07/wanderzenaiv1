-- 004_add_monthly_remaining.sql
-- Wanderer subscription = 5 itineraries per billing month (no rollover).
-- users.monthly_remaining is set to 5 at checkout and reset to 5 on each renewal
-- (Stripe invoice.paid, billing_reason = 'subscription_cycle'); /submit spends it before
-- purchased credits (itineraries_remaining), which never expire.
--
-- backend/functions/form-handler (index.js and stripe-webhook.js, via subscription.js)
-- adds this column on first use if it is missing (CI cannot reach RDS); running this by
-- hand is harmless.
--
-- Rollback: infra/migrations/004_add_monthly_remaining.down.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_remaining INTEGER NOT NULL DEFAULT 0;
