-- Migration: Normalize Swiss system history
-- Description: Replaces the opponents_played array with a structured relational table.

-- 1. Create swiss_match_history table
CREATE TABLE IF NOT EXISTS public.swiss_match_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    round_number INTEGER NOT NULL,
    team1_id UUID NOT NULL,
    team2_id UUID NOT NULL,
    match_id UUID, -- Link to actual match record
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team1_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    FOREIGN KEY (team2_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
    -- Prevent duplicate pairing in same round
    CONSTRAINT uq_swiss_round_pairing UNIQUE (tournament_id, round_number, team1_id),
    CONSTRAINT check_teams_diff_swiss CHECK (team1_id != team2_id)
);

-- 2. Create index for pairing checks
CREATE INDEX IF NOT EXISTS idx_swiss_history_opponents 
ON public.swiss_match_history(tournament_id, team1_id, team2_id);

-- Enable RLS
ALTER TABLE public.swiss_match_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view Swiss history
CREATE POLICY "Anyone can view swiss history" ON public.swiss_match_history
    FOR SELECT USING (true);

-- Comment for documentation
COMMENT ON TABLE public.swiss_match_history IS 'Normalized history of Swiss pairings to replace opponents_played arrays.';
