-- Add is_bot column to players and teams tables
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;

-- Index for better performance when filtering bots
CREATE INDEX IF NOT EXISTS idx_players_is_bot ON players(is_bot);
CREATE INDEX IF NOT EXISTS idx_teams_is_bot ON teams(is_bot);
