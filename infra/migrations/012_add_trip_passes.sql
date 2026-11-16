-- 012: Trip Pass (pricing design D, Nov 16 2026). N trips to use within valid_days, bought once.
-- Created automatically on first use by layers/shared/nodejs/trip-pass.js (ensureTripPasses).
CREATE TABLE IF NOT EXISTS trip_passes (
  id                SERIAL PRIMARY KEY,
  email             VARCHAR(255) NOT NULL,
  trips_total       INTEGER NOT NULL CHECK (trips_total > 0),
  trips_left        INTEGER NOT NULL CHECK (trips_left >= 0),
  expires_at        TIMESTAMPTZ NOT NULL,
  stripe_session_id VARCHAR(255) UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trip_passes_email ON trip_passes (email, expires_at);
