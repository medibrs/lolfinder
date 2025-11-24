-- Add opgg_url column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS opgg_url TEXT;

-- Add comment
COMMENT ON COLUMN players.opgg_url IS 'OP.GG profile URL for the player';
