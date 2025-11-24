-- SQL code to remove region columns from database
-- Run this in your Supabase SQL editor

-- Drop region indexes first
DROP INDEX IF EXISTS idx_players_region;
DROP INDEX IF EXISTS idx_teams_region;

-- Remove region column from players table
ALTER TABLE players DROP COLUMN IF EXISTS region;

-- Remove region column from teams table  
ALTER TABLE teams DROP COLUMN IF EXISTS region;

-- Optionally drop the region_type enum if no longer used
DROP TYPE IF EXISTS region_type CASCADE;

-- Verify the columns are removed
\d players
\d teams
