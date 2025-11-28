-- Add auto-incrementing tournament number for clean URLs
-- This gives us URLs like /tournaments/1/tournament-name instead of UUIDs

-- Add the tournament_number column
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS tournament_number SERIAL;

-- Create a unique index on tournament_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_number ON tournaments(tournament_number);

-- Update existing tournaments to have sequential numbers based on creation date
-- This ensures older tournaments get lower numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM tournaments
)
UPDATE tournaments t
SET tournament_number = n.rn
FROM numbered n
WHERE t.id = n.id;

-- Reset the sequence to continue from the highest number
SELECT setval(
  pg_get_serial_sequence('tournaments', 'tournament_number'),
  COALESCE((SELECT MAX(tournament_number) FROM tournaments), 0)
);
