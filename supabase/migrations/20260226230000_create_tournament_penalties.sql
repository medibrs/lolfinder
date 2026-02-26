-- Migration: Create tournament_penalties table
-- Description: Adds a system for structured penalties and sanctions during tournaments.

-- Create Penalty Type Enum
CREATE TYPE public.penalty_type AS ENUM ('warning', 'game_loss', 'match_loss', 'dq');

-- Create tournament_penalties table
CREATE TABLE IF NOT EXISTS public.tournament_penalties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    team_id UUID NOT NULL,
    player_id UUID, -- Nullable if penalty is against the whole team
    type penalty_type NOT NULL,
    reason TEXT NOT NULL,
    issued_by UUID NOT NULL, -- Admin who issued the penalty
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL,
    FOREIGN KEY (issued_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournament_penalties_tournament_id ON public.tournament_penalties(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_penalties_team_id ON public.tournament_penalties(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_penalties_player_id ON public.tournament_penalties(player_id);

-- Add updated_at trigger
CREATE TRIGGER update_tournament_penalties_updated_at 
BEFORE UPDATE ON public.tournament_penalties
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.tournament_penalties ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view penalties
CREATE POLICY "Anyone can view tournament penalties" ON public.tournament_penalties
    FOR SELECT USING (true);

-- Tournament admins can manage penalties
CREATE POLICY "Tournament admins can manage penalties" ON public.tournament_penalties
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_penalties.tournament_id
        )
    );

-- Comment for documentation
COMMENT ON TABLE public.tournament_penalties IS 'Stores structured penalties and sanctions issued during competitive play.';
