-- Add additional Riot API fields to players table
-- profile_icon_id: Player's profile icon ID from Riot API
-- rank: Player's rank within tier (e.g., I, II, III, IV)
-- league_points: LP in ranked (0-100)
-- wins: Number of ranked wins
-- losses: Number of ranked losses

ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_icon_id INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rank VARCHAR(10); -- I, II, III, IV
ALTER TABLE players ADD COLUMN IF NOT EXISTS league_points INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_players_rank ON players(rank);
CREATE INDEX IF NOT EXISTS idx_players_league_points ON players(league_points);
CREATE INDEX IF NOT EXISTS idx_players_wins ON players(wins);
