-- Rollback for 004_add_monthly_remaining.sql.
-- Deploy code that no longer reads users.monthly_remaining FIRST — the current
-- form-handler would re-create the column on its next submission.

ALTER TABLE users DROP COLUMN IF EXISTS monthly_remaining;
