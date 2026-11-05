-- Rollback for 002_add_rate_limits.sql.
-- Safe at any time: the limiter fails open when the table is missing.
DROP INDEX IF EXISTS idx_rate_limits_window_start;
DROP TABLE IF EXISTS rate_limits;
