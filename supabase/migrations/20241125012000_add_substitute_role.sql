-- Add is_substitute column to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN players.is_substitute IS 'Whether this player is designated as the substitute for their team';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_players_team_substitute ON players(team_id, is_substitute) WHERE team_id IS NOT NULL;
