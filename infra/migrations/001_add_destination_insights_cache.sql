-- Migration: Add destination_insights_cache table with composite key support
-- Allows caching destination insights per date range
-- Old date ranges expire after 30 days, but destination entries themselves persist

CREATE TABLE IF NOT EXISTS destination_insights_cache (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  destination           VARCHAR(255) NOT NULL,
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  travel_styles         JSONB DEFAULT '[]',
  insights              JSONB NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  UNIQUE(destination, start_date, end_date, travel_styles)
);

CREATE INDEX IF NOT EXISTS idx_dest_insights_destination ON destination_insights_cache(destination);
CREATE INDEX IF NOT EXISTS idx_dest_insights_dates ON destination_insights_cache(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_dest_insights_expires ON destination_insights_cache(expires_at);

-- Cleanup job hint: periodically DELETE FROM destination_insights_cache WHERE expires_at < NOW()
-- This can be run as a scheduled CloudWatch event (e.g., weekly) for maintenance
