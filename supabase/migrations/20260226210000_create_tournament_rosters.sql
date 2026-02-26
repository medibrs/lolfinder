-- Migration: Create tournament_rosters table
-- Description: Adds a dedicated table for locking team rosters during a tournament to maintain historical integrity.

-- Create tournament_rosters table
CREATE TABLE IF NOT EXISTS public.tournament_rosters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    team_id UUID NOT NULL,
    player_id UUID NOT NULL,
    role role_type NOT NULL,
    is_sub BOOLEAN DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE,
    -- A player can only be on one roster per tournament
    CONSTRAINT unique_tournament_player UNIQUE (tournament_id, player_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournament_rosters_tournament_id ON public.tournament_rosters(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_rosters_team_id ON public.tournament_rosters(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_rosters_player_id ON public.tournament_rosters(player_id);

-- Add updated_at trigger
CREATE TRIGGER update_tournament_rosters_updated_at 
BEFORE UPDATE ON public.tournament_rosters
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.tournament_rosters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view rosters
CREATE POLICY "Anyone can view tournament rosters" ON public.tournament_rosters
    FOR SELECT USING (true);

-- Tournament admins and Team captains can manage rosters
CREATE POLICY "Tournament admins and captains can manage rosters" ON public.tournament_rosters
    FOR ALL USING (
        auth.uid() IN (
            -- Tournament admins
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_rosters.tournament_id
        ) OR auth.uid() IN (
            -- Team captains
            SELECT captain_id FROM teams 
            WHERE teams.id = tournament_rosters.team_id
        )
    );

-- Comment for documentation
COMMENT ON TABLE public.tournament_rosters IS 'Tracks and locks the official rosters for each team in a tournament.';
