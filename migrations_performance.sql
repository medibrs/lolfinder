-- Additional indexes for RLS performance bottlenecks
-- The main bottleneck for logged-in users viewing lists is checking auth scopes.

-- This helps when Supabase checks if a user is the captain of a team
CREATE INDEX IF NOT EXISTS idx_teams_captain_id ON teams(captain_id);

-- This helps when Supabase checks pending join requests
CREATE INDEX IF NOT EXISTS idx_team_join_requests_lookups ON team_join_requests(team_id, player_id, status);

-- This helps when Supabase checks team invites
CREATE INDEX IF NOT EXISTS idx_team_invitations_lookups ON team_invitations(team_id, invited_player_id, status);
