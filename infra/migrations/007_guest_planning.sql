-- 007_guest_planning.sql (Nov 2026)
-- Guests can plan a whole trip before signing up; sign-in is asked at Submit.
-- Both tables create themselves on first use (CI cannot reach RDS); running this is harmless.
--
-- route_plan_cache: Claude route ideas per trip shape (sha256 of destination, days, styles,
--   pace, interests, month, travellers), reused for 7 days by form-handler /route-plan.
--   Rollback: DROP TABLE route_plan_cache;  (only a cache)
-- plan_drafts: one in-progress plan per account (profile /profile/draft), shown on the
--   dashboard as "Continue planning". Deleted when the trip is submitted or discarded.
--   Rollback: DROP TABLE plan_drafts;  (users lose unsent drafts only)

CREATE TABLE IF NOT EXISTS route_plan_cache (
  cache_key  CHAR(64)    PRIMARY KEY,
  result     JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_drafts (
  email      VARCHAR(255) PRIMARY KEY,
  draft      JSONB        NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
