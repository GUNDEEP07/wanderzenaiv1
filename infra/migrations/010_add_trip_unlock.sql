-- 010: free trips show Day 1 until unlocked (Nov 16 2026).
-- submissions.unlocked_at is set when the owner unlocks a free trip with a paid itinerary
-- (POST /itinerary/{id}/unlock). The column also creates itself on first use
-- (layers/shared/nodejs/trip-access.js) because CI cannot reach RDS.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
