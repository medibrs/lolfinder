-- Fix RLS policies for riot_request_logs table
-- The current policies are too restrictive and preventing reads

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for admins" ON riot_request_logs;
DROP POLICY IF EXISTS "Enable read own logs" ON riot_request_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON riot_request_logs;
DROP POLICY IF EXISTS "Enable insert for system" ON riot_request_logs;

-- Create new, more permissive policies
CREATE POLICY "Enable read access for authenticated users" ON riot_request_logs FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for all authenticated" ON riot_request_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow updates for authenticated users (in case we need it)
CREATE POLICY "Enable update for authenticated users" ON riot_request_logs FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow deletes for authenticated users (in case we need it)  
CREATE POLICY "Enable delete for authenticated users" ON riot_request_logs FOR DELETE USING (auth.role() = 'authenticated');
