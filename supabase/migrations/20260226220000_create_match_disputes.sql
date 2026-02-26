-- Migration: Create match_disputes table
-- Description: Adds a system to handle contested match results with an audit trail of rulings.

-- Create Dispute Status Enum
CREATE TYPE public.dispute_status_type AS ENUM ('open', 'resolved', 'rejected');

-- Create match_disputes table
CREATE TABLE IF NOT EXISTS public.match_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL,
    raised_by UUID NOT NULL,
    reason TEXT NOT NULL,
    evidence_url TEXT,
    status dispute_status_type DEFAULT 'open',
    resolved_by UUID, -- Admin who resolved it
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    FOREIGN KEY (raised_by) REFERENCES public.players(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES public.players(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_disputes_match_id ON public.match_disputes(match_id);
CREATE INDEX IF NOT EXISTS idx_match_disputes_status ON public.match_disputes(status);

-- Add updated_at trigger
CREATE TRIGGER update_match_disputes_updated_at 
BEFORE UPDATE ON public.match_disputes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.match_disputes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view disputes
CREATE POLICY "Anyone can view match disputes" ON public.match_disputes
    FOR SELECT USING (true);

-- Players can create disputes for their matches
CREATE POLICY "Players can raise disputes" ON public.match_disputes
    FOR INSERT WITH CHECK (
        auth.uid() = raised_by
    );

-- Tournament admins can manage disputes
CREATE POLICY "Tournament admins can manage disputes" ON public.match_disputes
    FOR ALL USING (
        auth.uid() IN (
            SELECT ta.user_id 
            FROM tournament_admins ta
            JOIN tournament_matches tm ON ta.tournament_id = tm.tournament_id
            WHERE tm.id = match_disputes.match_id
        )
    );

-- Comment for documentation
COMMENT ON TABLE public.match_disputes IS 'Structured storage for contested match results and administrative rulings.';
