-- Add Riot API fields to players table
-- puuid: Riot's unique player identifier
-- summoner_level: Player's summoner level

ALTER TABLE players ADD COLUMN IF NOT EXISTS puuid TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS summoner_level INTEGER;

-- Create index on puuid for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_puuid ON players(puuid);
