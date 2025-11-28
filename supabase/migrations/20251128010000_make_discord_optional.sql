-- Make discord column nullable in players table
-- This allows users to create profiles without providing Discord username

ALTER TABLE players 
ALTER COLUMN discord DROP NOT NULL,
DROP CONSTRAINT IF EXISTS players_discord_key;

-- Add comment to document the change
COMMENT ON COLUMN players.discord IS 'Discord username (optional) - no longer required for player profiles';
