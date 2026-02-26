-- Migration: Schema Hardening
-- Description: Adding composite unique constraints and check constraints for data integrity.

-- 1. Composite Unique Constraints (preventing logical duplicates)
-- Prevent teams from having multiple results for the same round
ALTER TABLE public.swiss_round_results ADD CONSTRAINT swiss_round_results_unique_round UNIQUE (tournament_id, team_id, round_number);

-- Prevent duplicating a player in the same roster
ALTER TABLE public.tournament_rosters ADD CONSTRAINT tournament_rosters_unique_player UNIQUE (tournament_id, team_id, player_id);

-- 2. Add Check Constraints (preventing self-play)
-- Prevent a team from playing against itself
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_different_teams CHECK (team1_id IS NULL OR team2_id IS NULL OR team1_id != team2_id);
ALTER TABLE public.swiss_pairings ADD CONSTRAINT swiss_pairings_different_teams CHECK (team1_id != team2_id);
ALTER TABLE public.swiss_match_history ADD CONSTRAINT swiss_match_history_different_teams CHECK (team1_id != team2_id);
ALTER TABLE public.tournament_opponents_history ADD CONSTRAINT tournament_opponents_history_different_teams CHECK (team_id != opponent_id);
