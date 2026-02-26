-- Migration: Apply critical integrity constraints
-- Description: Enforces data consistency for matches, registrations, and standings.

-- 1. Tournament Match Constraints
ALTER TABLE public.tournament_matches
ADD CONSTRAINT check_teams_different CHECK (team1_id != team2_id),
ADD CONSTRAINT check_positive_scores CHECK (team1_score >= 0 AND team2_score >= 0),
ADD CONSTRAINT check_valid_best_of CHECK (best_of IN (1, 3, 5, 7));

-- 2. Registration Uniqueness
-- Note: UNIQUE(tournament_id, team_id) might already exist, adding IF NOT EXISTS logic
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tournament_registrations_team') THEN
        ALTER TABLE public.tournament_registrations 
        ADD CONSTRAINT uq_tournament_registrations_team UNIQUE (tournament_id, team_id);
    END IF;
END $$;

-- 3. Participant Uniqueness
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tournament_participants_team') THEN
        ALTER TABLE public.tournament_participants 
        ADD CONSTRAINT uq_tournament_participants_team UNIQUE (tournament_id, team_id);
    END IF;
END $$;

-- 4. Standings Uniqueness and Integrity
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tournament_standings_team') THEN
        ALTER TABLE public.tournament_standings 
        ADD CONSTRAINT uq_tournament_standings_team UNIQUE (tournament_id, team_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tournament_standings_placement') THEN
        ALTER TABLE public.tournament_standings 
        ADD CONSTRAINT uq_tournament_standings_placement UNIQUE (tournament_id, placement);
    END IF;
END $$;

-- 5. Match Game Uniqueness (Idempotency)
ALTER TABLE public.tournament_match_games
ADD CONSTRAINT uq_match_game_number UNIQUE (match_id, game_number);

-- Comment for documentation
COMMENT ON TABLE public.tournament_standings IS 'Enforces unique placement per team per tournament.';
