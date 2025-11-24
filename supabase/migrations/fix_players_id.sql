-- Fix players table to use user ID instead of generated UUID
-- Run this in your Supabase SQL editor

-- First, delete duplicate records (keep the most recent one for each user)
DELETE FROM players 
WHERE id NOT IN (
    SELECT DISTINCT ON (id) id 
    FROM players 
    ORDER BY id, created_at DESC
);

-- Drop the current primary key constraint with CASCADE to remove dependent FK constraints
ALTER TABLE players DROP CONSTRAINT players_pkey CASCADE;

-- Change the id column to NOT have a default value
ALTER TABLE players ALTER COLUMN id DROP DEFAULT;

-- Add a unique constraint to prevent duplicates
ALTER TABLE players ADD CONSTRAINT players_id_unique UNIQUE (id);

-- Recreate the primary key constraint
ALTER TABLE players ADD CONSTRAINT players_pkey PRIMARY KEY (id);

-- Recreate the foreign key constraints that were dropped
ALTER TABLE teams ADD CONSTRAINT teams_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE team_invitations ADD CONSTRAINT team_invitations_invited_player_id_fkey FOREIGN KEY (invited_player_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE team_invitations ADD CONSTRAINT team_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES players(id) ON DELETE CASCADE;

-- Verify the changes
\d players
