-- 002_add_rate_limits.sql
-- Per-identity request counters for backend/layers/shared/nodejs/rate-limit.js.
--
-- Optional to run by hand: backend/layers/shared/nodejs/rate-limit.js creates this table
-- on first use if it is missing (CI cannot reach RDS). Running it manually is harmless:
--   psql "$DATABASE_URL" -f infra/migrations/002_add_rate_limits.sql
--
-- Rollback: infra/migrations/002_add_rate_limits.down.sql
--
-- bucket_key format: <bucket>:<windowSeconds>:<subject>
--   subject = u:<firebase uid>  or  ip:<sha256(ip) truncated>   (raw IPs are never stored)
-- Rows older than 2 days are pruned opportunistically by the limiter.

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key   VARCHAR(200) NOT NULL,
  window_start TIMESTAMPTZ  NOT NULL,
  count        INTEGER      NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits (window_start);
