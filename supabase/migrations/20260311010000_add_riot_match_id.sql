-- Add riot_match_id column to tournament_match_games
-- Stores the Riot API match ID (e.g. EUW1_1234567890) for fetching post-game stats
ALTER TABLE public.tournament_match_games
  ADD COLUMN IF NOT EXISTS riot_match_id text;
