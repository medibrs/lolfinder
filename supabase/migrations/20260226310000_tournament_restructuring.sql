-- Migration: Tournament Swiss & Bracket Flexibility Upgrade
-- Spec: "Generation = Suggestion, Database = Authority"
-- Implements: pairing lifecycle, version tracking, audit trail, match traceability.

-- ============================================================
-- 1. SWISS PAIRINGS — Lifecycle & Version Tracking
-- ============================================================

-- 1a. Pairing status lifecycle: draft → approved/modified → locked
ALTER TABLE public.swiss_pairings
  ADD COLUMN IF NOT EXISTS pairing_status character varying NOT NULL DEFAULT 'draft'
    CHECK (pairing_status IN ('draft', 'approved', 'modified', 'locked'));

-- 1b. Version tracking — allows regenerating while keeping history
ALTER TABLE public.swiss_pairings
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- 1c. Self-referencing parent for version chains
ALTER TABLE public.swiss_pairings
  ADD COLUMN IF NOT EXISTS parent_pairing_id uuid REFERENCES public.swiss_pairings(id);

-- 1d. Ensure is_locked, generation_source, modified_by, override_reason exist
--     (These were in a previously deleted migration; using IF NOT EXISTS for safety)
ALTER TABLE public.swiss_pairings
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;
ALTER TABLE public.swiss_pairings
  ADD COLUMN IF NOT EXISTS generation_source character varying DEFAULT 'auto'
    CHECK (generation_source IN ('auto', 'manual', 'ai'));
ALTER TABLE public.swiss_pairings
  ADD COLUMN IF NOT EXISTS modified_by uuid REFERENCES auth.users(id);
ALTER TABLE public.swiss_pairings
  ADD COLUMN IF NOT EXISTS override_reason text;

-- ============================================================
-- 2. SWISS PAIRING AUDIT — Full change traceability
-- ============================================================

CREATE TABLE IF NOT EXISTS public.swiss_pairing_audit (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  pairing_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  old_state jsonb NOT NULL,
  new_state jsonb NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT swiss_pairing_audit_pkey PRIMARY KEY (id),
  CONSTRAINT swiss_pairing_audit_pairing_id_fkey FOREIGN KEY (pairing_id) REFERENCES public.swiss_pairings(id) ON DELETE CASCADE,
  CONSTRAINT swiss_pairing_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_swiss_pairing_audit_pairing_id ON public.swiss_pairing_audit(pairing_id);
CREATE INDEX IF NOT EXISTS idx_swiss_pairing_audit_changed_by ON public.swiss_pairing_audit(changed_by);

-- ============================================================
-- 3. TOURNAMENT MATCHES — Link back to source pairing
-- ============================================================

-- 3a. source_pairing_id: which swiss pairing produced this match?
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS source_pairing_id uuid REFERENCES public.swiss_pairings(id);

-- 3b. Ensure is_locked, modified_by, override_reason exist
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS modified_by uuid REFERENCES auth.users(id);
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS override_reason text;

-- ============================================================
-- 4. STRUCTURAL HARDENING (from previously deleted migrations)
-- ============================================================

-- 4a. Remove duplicate FK on players (safe — no-op if already gone)
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS fk_team;

-- 4b. Unique constraints to prevent logical duplicates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_participants_unique_team') THEN
    ALTER TABLE public.tournament_participants ADD CONSTRAINT tournament_participants_unique_team UNIQUE (tournament_id, team_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_registrations_unique_team') THEN
    ALTER TABLE public.tournament_registrations ADD CONSTRAINT tournament_registrations_unique_team UNIQUE (tournament_id, team_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_standings_unique_team') THEN
    ALTER TABLE public.tournament_standings ADD CONSTRAINT tournament_standings_unique_team UNIQUE (tournament_id, team_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'swiss_round_results_unique_round') THEN
    ALTER TABLE public.swiss_round_results ADD CONSTRAINT swiss_round_results_unique_round UNIQUE (tournament_id, team_id, round_number);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_rosters_unique_player') THEN
    ALTER TABLE public.tournament_rosters ADD CONSTRAINT tournament_rosters_unique_player UNIQUE (tournament_id, team_id, player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_opponents_history_unique_pairing') THEN
    ALTER TABLE public.tournament_opponents_history ADD CONSTRAINT tournament_opponents_history_unique_pairing UNIQUE (tournament_id, team_id, opponent_id);
  END IF;
END $$;

-- 4c. Check constraints to prevent self-play
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_different_teams') THEN
    ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_different_teams CHECK (team1_id IS NULL OR team2_id IS NULL OR team1_id != team2_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'swiss_pairings_different_teams') THEN
    ALTER TABLE public.swiss_pairings ADD CONSTRAINT swiss_pairings_different_teams CHECK (team1_id != team2_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'swiss_match_history_different_teams') THEN
    ALTER TABLE public.swiss_match_history ADD CONSTRAINT swiss_match_history_different_teams CHECK (team1_id != team2_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_opponents_history_different_teams') THEN
    ALTER TABLE public.tournament_opponents_history ADD CONSTRAINT tournament_opponents_history_different_teams CHECK (team_id != opponent_id);
  END IF;
END $$;

-- ============================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON public.tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team1_id ON public.tournament_matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team2_id ON public.tournament_matches(team2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_source_pairing ON public.tournament_matches(source_pairing_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_id ON public.tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_team_id ON public.tournament_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_swiss_match_history_tournament_id ON public.swiss_match_history(tournament_id);
CREATE INDEX IF NOT EXISTS idx_swiss_pairings_tournament_id ON public.swiss_pairings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_swiss_pairings_status ON public.swiss_pairings(pairing_status);
CREATE INDEX IF NOT EXISTS idx_swiss_pairings_is_locked ON public.swiss_pairings(is_locked);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_is_locked ON public.tournament_matches(is_locked);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_tournament_id ON public.tournament_logs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_match_details_match_id ON public.tournament_match_details(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_match_games_match_id ON public.tournament_match_games(match_id);
CREATE INDEX IF NOT EXISTS idx_match_disputes_match_id ON public.match_disputes(match_id);
CREATE INDEX IF NOT EXISTS idx_match_result_audit_match_id ON public.match_result_audit(match_id);
CREATE INDEX IF NOT EXISTS idx_player_tournament_histories_player_id ON public.player_tournament_histories(player_id);
CREATE INDEX IF NOT EXISTS idx_player_tournament_histories_tournament_id ON public.player_tournament_histories(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_opponents_history_tournament_id ON public.tournament_opponents_history(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_opponents_history_team_id ON public.tournament_opponents_history(team_id);
