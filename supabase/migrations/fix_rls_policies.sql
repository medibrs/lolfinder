-- Fix RLS policies for players table to ensure proper authentication
-- Run this in your Supabase SQL editor

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON players;
DROP POLICY IF EXISTS "Enable insert access for all users" ON players;
DROP POLICY IF EXISTS "Enable update access for all users" ON players;
DROP POLICY IF EXISTS "Enable delete access for all users" ON players;

-- Create new policies that require authentication
CREATE POLICY "Users can view all player profiles" ON players FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own profile" ON players FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  id = auth.uid()
);

CREATE POLICY "Users can update their own profile" ON players FOR UPDATE USING (
  auth.role() = 'authenticated' AND 
  id = auth.uid()
);

CREATE POLICY "Users can delete their own profile" ON players FOR DELETE USING (
  auth.role() = 'authenticated' AND 
  id = auth.uid()
);

-- Verify policies were created
SELECT * FROM pg_policies WHERE tablename = 'players';
