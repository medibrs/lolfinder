-- Round Robin Tournament Format Migration
-- Adds support for Round Robin group stage format

-- 1. Add 'Round_Robin' to the tournament_format_type enum (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'Round_Robin'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tournament_format_type')
    ) THEN
        ALTER TYPE tournament_format_type ADD VALUE 'Round_Robin';
    END IF;
END$$;

-- 2. Add rr_group_count column to tournaments table
ALTER TABLE public.tournaments
    ADD COLUMN IF NOT EXISTS rr_group_count integer DEFAULT 4;

-- 3. Add group_id and group_name columns to tournament_participants table
ALTER TABLE public.tournament_participants
    ADD COLUMN IF NOT EXISTS group_id integer,
    ADD COLUMN IF NOT EXISTS group_name text;
