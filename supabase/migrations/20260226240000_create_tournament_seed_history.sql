-- Migration: Create tournament_seed_history table
-- Description: Adds a system to track the history of seed assignments to ensure deterministic seeding and prevent bracket corruption accusations.

-- Create Seeding Method Enum
CREATE TYPE public.seeding_method_type AS ENUM ('manual', 'algorithmic');

-- Create tournament_seed_history table
CREATE TABLE IF NOT EXISTS public.tournament_seed_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    team_id UUID NOT NULL,
    seed INTEGER NOT NULL,
    method seeding_method_type NOT NULL,
    assigned_by UUID, -- Admin who assigned the seed
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournament_seed_history_tournament_id ON public.tournament_seed_history(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_seed_history_team_id ON public.tournament_seed_history(team_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.tournament_seed_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view seeding history
CREATE POLICY "Anyone can view seeding history" ON public.tournament_seed_history
    FOR SELECT USING (true);

-- Tournament admins can manage seeding history
CREATE POLICY "Tournament admins can manage seeding history" ON public.tournament_seed_history
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_seed_history.tournament_id
        )
    );

-- Comment for documentation
COMMENT ON TABLE public.tournament_seed_history IS 'Audit trail for seed assignments to ensure transparency and prevent corruption accusations.';
