-- Rollback for 003_add_stripe_events.sql.
-- Note: without this table the webhook recreates it on the next event, and any event
-- Stripe re-delivers after the drop would be processed again.
DROP TABLE IF EXISTS stripe_events;
