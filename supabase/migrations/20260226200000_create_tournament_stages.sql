-- Migration: Create tournament_stages table
-- Description: Adds a dedicated table for multi-stage tournaments to resolve overloading in the tournaments table.

-- Create tournament_stages table
CREATE TABLE IF NOT EXISTS public.tournament_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    name TEXT NOT NULL,
    format tournament_format_type NOT NULL DEFAULT 'Single_Elimination',
    stage_order INTEGER NOT NULL DEFAULT 0,
    advancement_rules JSONB DEFAULT '{}'::jsonb,
    status tournament_status_type NOT NULL DEFAULT 'Registration',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournament_stages_tournament_id ON public.tournament_stages(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_stages_stage_order ON public.tournament_stages(stage_order);

-- Add updated_at trigger
CREATE TRIGGER update_tournament_stages_updated_at 
BEFORE UPDATE ON public.tournament_stages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.tournament_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view tournament stages
CREATE POLICY "Anyone can view tournament stages" ON public.tournament_stages
    FOR SELECT USING (true);

-- Tournament admins can manage stages
CREATE POLICY "Tournament admins can manage stages" ON public.tournament_stages
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_stages.tournament_id
        )
    );

-- Comment for documentation
COMMENT ON TABLE public.tournament_stages IS 'Stores individual stages for multi-stage tournaments (e.g., Groups, Playoffs).';
