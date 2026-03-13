-- Make winner_id nullable in tournament_match_games
-- So we can store riot_match_id before knowing the winner
ALTER TABLE public.tournament_match_games
  ALTER COLUMN winner_id DROP NOT NULL;
