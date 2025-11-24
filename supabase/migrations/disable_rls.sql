-- Disable Row Level Security completely
-- Run this in your Supabase SQL editor

-- Disable RLS on all tables
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies (optional cleanup)
DROP POLICY IF EXISTS "Users can view all player profiles" ON players;
DROP POLICY IF EXISTS "Users can insert their own profile" ON players;
DROP POLICY IF EXISTS "Users can update their own profile" ON players;
DROP POLICY IF EXISTS "Users can delete their own profile" ON players;

DROP POLICY IF EXISTS "Enable read access for all users" ON teams;
DROP POLICY IF EXISTS "Enable insert access for all users" ON teams;
DROP POLICY IF EXISTS "Enable update access for all users" ON teams;
DROP POLICY IF EXISTS "Enable delete access for all users" ON teams;

DROP POLICY IF EXISTS "Enable read access for all users" ON tournaments;
DROP POLICY IF EXISTS "Enable insert access for all users" ON tournaments;
DROP POLICY IF EXISTS "Enable update access for all users" ON tournaments;
DROP POLICY IF EXISTS "Enable delete access for all users" ON tournaments;

DROP POLICY IF EXISTS "Enable read access for all users" ON tournament_registrations;
DROP POLICY IF EXISTS "Enable insert access for all users" ON tournament_registrations;
DROP POLICY IF EXISTS "Enable update access for all users" ON tournament_registrations;
DROP POLICY IF EXISTS "Enable delete access for all users" ON tournament_registrations;

DROP POLICY IF EXISTS "Enable read access for all users" ON notifications;
DROP POLICY IF EXISTS "Enable insert access for all users" ON notifications;
DROP POLICY IF EXISTS "Enable delete access for all users" ON notifications;

DROP POLICY IF EXISTS "Enable read access for all users" ON team_invitations;
DROP POLICY IF EXISTS "Enable insert access for all users" ON team_invitations;
DROP POLICY IF EXISTS "Enable update access for all users" ON team_invitations;
DROP POLICY IF EXISTS "Enable delete access for all users" ON team_invitations;

-- Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('players', 'teams', 'tournaments', 'tournament_registrations', 'notifications', 'team_invitations');
