-- SQL code to remove tier column from teams table
-- Run this in your Supabase SQL editor

-- Drop tier index if it exists
DROP INDEX IF EXISTS idx_teams_tier;

-- Remove tier column from teams table
ALTER TABLE teams DROP COLUMN IF EXISTS tier;

-- Verify the column was removed
\d teams
