-- SQL code to add average_rank column to teams table
-- Run this in your Supabase SQL editor

-- 1. Add the column
ALTER TABLE teams ADD COLUMN IF NOT EXISTS average_rank TEXT DEFAULT 'Unranked';

-- 2. Create an index for performance (optional but recommended for sorting)
CREATE INDEX IF NOT EXISTS idx_teams_average_rank ON teams(average_rank);

-- 3. (Optional) Initial population of average_rank
-- This requires a subquery to calculate averages. 
-- Since rank names are strings, a complex SQL mapping would be needed.
-- It's often easier to let the application update this on the next team change
-- or run a one-time migration script in the app.

COMMENT ON COLUMN teams.average_rank IS 'The pre-calculated average rank of the team based on its members.';
