-- Update teams table structure
-- Remove tier column and add team_size column

-- First, create the team_size enum type
CREATE TYPE team_size_type AS ENUM ('5', '6');

-- Add the team_size column
ALTER TABLE teams ADD COLUMN team_size team_size_type DEFAULT '5';

-- Update existing teams to have team_size = '5' (default for existing data)
UPDATE teams SET team_size = '5' WHERE team_size IS NULL;

-- Make team_size NOT NULL (after setting defaults)
ALTER TABLE teams ALTER COLUMN team_size SET NOT NULL;

-- Drop the tier column
ALTER TABLE teams DROP COLUMN tier;

-- Update the index for teams (remove tier index, add team_size index)
DROP INDEX IF EXISTS idx_teams_tier;
CREATE INDEX idx_teams_team_size ON teams(team_size);

-- Update the recruiting_status_type enum if needed (ensure it has the right values)
DROP TYPE IF EXISTS recruiting_status_type CASCADE;
CREATE TYPE recruiting_status_type AS ENUM ('Open', 'Closed', 'Full');

-- Ensure the recruiting_status column uses the right type
ALTER TABLE teams ALTER COLUMN recruiting_status TYPE recruiting_status_type USING recruiting_status::recruiting_status_type;
