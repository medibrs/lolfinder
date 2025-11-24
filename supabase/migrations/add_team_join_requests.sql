-- Create team_join_requests table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS team_join_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_join_requests_team_id ON team_join_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_player_id ON team_join_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_status ON team_join_requests(status);

-- Add unique constraint to prevent duplicate pending requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_join_requests_unique_pending 
ON team_join_requests(team_id, player_id) 
WHERE status = 'pending';

-- Disable RLS for now (since we disabled it globally)
ALTER TABLE team_join_requests DISABLE ROW LEVEL SECURITY;

-- Verify table creation
SELECT * FROM information_schema.tables WHERE table_name = 'team_join_requests';
