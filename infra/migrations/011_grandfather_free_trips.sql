-- 011: free trips made before the Day-1 lock (Nov 16 2026, 00:40 UTC) stay fully open.
-- Also runs automatically with the unlocked_at column check (layers/shared/nodejs/trip-access.js).
UPDATE submissions SET unlocked_at = created_at
  WHERE plan = 'free' AND unlocked_at IS NULL AND created_at < '2026-11-16T00:40:00Z';
