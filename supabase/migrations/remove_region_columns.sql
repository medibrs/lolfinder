-- Remove region columns from players and teams tables

-- Drop region indexes
DROP INDEX IF EXISTS idx_players_region;
DROP INDEX IF EXISTS idx_teams_region;

-- Remove region column from players table
ALTER TABLE players DROP COLUMN IF EXISTS region;

-- Remove region column from teams table  
ALTER TABLE teams DROP COLUMN IF EXISTS region;

-- Optionally, we can drop the region_type enum if it's no longer used anywhere
DROP TYPE IF EXISTS region_type CASCADE;
