-- 005_add_submission_progress.sql
-- Live generation progress for the confirmation page ("watch your trip being written").
-- The itinerary generator writes the route and a short summary of each finished day into
-- submissions.progress; GET /itinerary/{id}/progress returns it to the signed-in owner.
--
-- backend/layers/shared/nodejs/progress.js adds this column on first use if it is missing
-- (CI cannot reach RDS); running this by hand is harmless.
--
-- Rollback: infra/migrations/005_add_submission_progress.down.sql

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS progress JSONB;
