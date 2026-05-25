-- Migration: Add selected_venues column to submissions table
-- Date: 2026-05-26
-- Description: Store user-selected Foursquare venue IDs per submission

ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS selected_venues JSONB DEFAULT '{}';

-- Index for queries that filter by submission creation + status
CREATE INDEX IF NOT EXISTS idx_submissions_selected_venues
ON submissions USING GIN (selected_venues);

-- Verify migration
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'submissions'
AND column_name = 'selected_venues';
