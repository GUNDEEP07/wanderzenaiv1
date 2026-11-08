-- 008_day_adjustments.sql (Nov 2026) — "Adjust this day" (option A)
-- The trip's owner asks for one day to be rewritten with a short note; up to 3 per trip,
-- failed attempts don't count, one at a time (partial unique index). Created on first use by
-- backend/layers/shared/nodejs/day-adjust.js (CI cannot reach RDS); running this is harmless.
-- The rewritten day replaces itineraries.itinerary_data.days[n] (marked adjusted.at); the
-- note is kept only here (owner-only), never in the shared itinerary.
--
-- Rollback: DROP TABLE day_adjustments;  (adjusted days stay in the itineraries)

CREATE TABLE IF NOT EXISTS day_adjustments (
  id            BIGSERIAL    PRIMARY KEY,
  submission_id VARCHAR(50)  NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  day_number    INTEGER      NOT NULL CHECK (day_number BETWEEN 1 AND 30),
  note          TEXT         NOT NULL,
  status        VARCHAR(10)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
  error         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_day_adjustments_submission ON day_adjustments(submission_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_day_adjustments_one_pending
  ON day_adjustments(submission_id) WHERE status = 'pending';
