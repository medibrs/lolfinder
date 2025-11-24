-- SQL code to add team foreign key to players table
-- Run this in your Supabase SQL editor

-- Add team_id column to players table if it doesn't exist
ALTER TABLE players ADD COLUMN IF NOT EXISTS team_id UUID;

-- Add foreign key constraint to players.team_id referencing teams.id
ALTER TABLE players 
ADD CONSTRAINT fk_players_team_id 
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- Create index for team_id for better query performance
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);

-- Verify the column was added
\d players
