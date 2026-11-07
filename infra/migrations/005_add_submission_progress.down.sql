-- Rollback for 005_add_submission_progress.sql.
-- Deploy code that no longer writes submissions.progress FIRST — the current generator and
-- progress endpoint would re-create the column on their next use.

ALTER TABLE submissions DROP COLUMN IF EXISTS progress;
