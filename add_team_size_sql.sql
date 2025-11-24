-- SQL code to add team_size column to teams table
-- Run this in your Supabase SQL editor

-- Drop the type if it exists first, then create it
DROP TYPE IF EXISTS team_size_type CASCADE;

-- Create team_size enum type
CREATE TYPE team_size_type AS ENUM ('5', '6');

-- Add team_size column to teams table
ALTER TABLE teams ADD COLUMN team_size team_size_type NOT NULL DEFAULT '5';

-- Create index for team_size for better query performance
CREATE INDEX idx_teams_team_size ON teams(team_size);

-- Verify the column was added
\d teams
