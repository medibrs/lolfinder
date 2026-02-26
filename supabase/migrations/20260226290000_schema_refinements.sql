-- Migration: Schema Refinements based on Production Review
-- Description: Addressing structural risks, normalization leaks, and performance optimizations.

-- 1. Remove duplicate Foreign Key in players
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS fk_team;

-- 2. Normalize feature_requests.category
-- Add the new column first
ALTER TABLE public.feature_requests ADD COLUMN category_id uuid REFERENCES public.feature_categories(id);

-- Migrate data from string category to ID if names match
UPDATE public.feature_requests fr
SET category_id = fc.id
FROM public.feature_categories fc
WHERE fr.category = fc.name;

-- Drop the old category column
ALTER TABLE public.feature_requests DROP COLUMN category;

-- 3. Rename swiss_pairings columns for consistency (Teams instead of Players)
ALTER TABLE public.swiss_pairings RENAME COLUMN player1_id TO team1_id;
ALTER TABLE public.swiss_pairings RENAME COLUMN player2_id TO team2_id;

-- 4. Replace opponents_played array with relational table
CREATE TABLE public.tournament_opponents_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  opponent_id uuid NOT NULL REFERENCES public.teams(id),
  match_id uuid REFERENCES public.tournament_matches(id),
  round_number integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_opponents_history_pkey PRIMARY KEY (id),
  UNIQUE (tournament_id, team_id, opponent_id)
);

-- Migrate existing array data to the new table
INSERT INTO public.tournament_opponents_history (tournament_id, team_id, opponent_id)
SELECT tournament_id, team_id, unnest(opponents_played)
FROM public.tournament_participants
WHERE opponents_played IS NOT NULL AND array_length(opponents_played, 1) > 0;

-- Drop the array column from participants
ALTER TABLE public.tournament_participants DROP COLUMN opponents_played;

-- 5. Add unique constraints for tournament entities
-- Ensure a team can only be in a tournament once
ALTER TABLE public.tournament_participants ADD CONSTRAINT tournament_participants_unique_team UNIQUE (tournament_id, team_id);
ALTER TABLE public.tournament_registrations ADD CONSTRAINT tournament_registrations_unique_team UNIQUE (tournament_id, team_id);
ALTER TABLE public.tournament_standings ADD CONSTRAINT tournament_standings_unique_team UNIQUE (tournament_id, team_id);

-- 6. Add performance indexes on FKs and common query fields
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON public.tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team1_id ON public.tournament_matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team2_id ON public.tournament_matches(team2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_id ON public.tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_team_id ON public.tournament_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_swiss_match_history_tournament_id ON public.swiss_match_history(tournament_id);
CREATE INDEX IF NOT EXISTS idx_swiss_pairings_tournament_id ON public.swiss_pairings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_tournament_id ON public.tournament_logs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_match_details_match_id ON public.tournament_match_details(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_match_games_match_id ON public.tournament_match_games(match_id);
CREATE INDEX IF NOT EXISTS idx_match_disputes_match_id ON public.match_disputes(match_id);
CREATE INDEX IF NOT EXISTS idx_match_result_audit_match_id ON public.match_result_audit(match_id);
CREATE INDEX IF NOT EXISTS idx_player_tournament_histories_player_id ON public.player_tournament_histories(player_id);
CREATE INDEX IF NOT EXISTS idx_player_tournament_histories_tournament_id ON public.player_tournament_histories(tournament_id);
