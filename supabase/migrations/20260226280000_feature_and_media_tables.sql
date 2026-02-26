-- Migration: Feature and media enhancements
-- Description: Adds tables for Elo rating tracking and broadcast assignments.

-- 1. Create team_ratings table
CREATE TABLE IF NOT EXISTS public.team_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    rating NUMERIC NOT NULL DEFAULT 1200, -- Initial Elo
    rating_type VARCHAR(20) DEFAULT 'Elo', -- 'Elo', 'Glicko'
    matches_played INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    CONSTRAINT uq_team_rating UNIQUE (team_id, rating_type)
);

-- 2. Create broadcast_assignments table
CREATE TABLE IF NOT EXISTS public.broadcast_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL,
    caster_name TEXT,
    observer_name TEXT,
    stream_platform TEXT DEFAULT 'Twitch',
    stream_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    CONSTRAINT uq_match_broadcast UNIQUE (match_id) -- One main stream per match
);

-- 3. Add updated_at triggers
CREATE TRIGGER update_team_ratings_updated_at 
BEFORE UPDATE ON public.team_ratings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_broadcast_assignments_updated_at 
BEFORE UPDATE ON public.broadcast_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.team_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings" ON public.team_ratings
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view broadcasts" ON public.broadcast_assignments
    FOR SELECT USING (true);

-- Comment for documentation
COMMENT ON TABLE public.team_ratings IS 'Long-term ranking and performance rating history for teams.';
COMMENT ON TABLE public.broadcast_assignments IS 'Media and stream details for individual tournament matches.';
