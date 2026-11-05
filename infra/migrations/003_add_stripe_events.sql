-- 003_add_stripe_events.sql
-- Processed Stripe webhook event ids, so a retried or duplicated delivery can't grant
-- credits twice. backend/functions/form-handler/stripe-webhook.js creates this table on
-- first use if it is missing (CI cannot reach RDS); running this by hand is harmless.
--
-- Rollback: infra/migrations/003_add_stripe_events.down.sql

CREATE TABLE IF NOT EXISTS stripe_events (
  id          VARCHAR(255) PRIMARY KEY,
  type        VARCHAR(100) NOT NULL,
  received_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
