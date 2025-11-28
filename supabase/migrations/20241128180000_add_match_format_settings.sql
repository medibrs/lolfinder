-- Add match format settings to tournaments table
-- These control the best-of format for different match types in Swiss/bracket tournaments

-- Opening matches: Standard round matches (e.g., rounds 1-2 in Swiss)
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS opening_best_of integer DEFAULT 1;

-- Progression matches: Win to advance/qualify (e.g., 2-0 teams playing for 3-0)
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS progression_best_of integer DEFAULT 3;

-- Elimination matches: Lose to be eliminated (e.g., 0-2 teams playing to avoid 0-3)
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS elimination_best_of integer DEFAULT 3;

-- Finals match: Grand finals / championship match
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS finals_best_of integer DEFAULT 5;

-- Add comments for documentation
COMMENT ON COLUMN public.tournaments.opening_best_of IS 'Best-of format for standard opening round matches (default: Bo1)';
COMMENT ON COLUMN public.tournaments.progression_best_of IS 'Best-of format for progression/qualification matches (default: Bo3)';
COMMENT ON COLUMN public.tournaments.elimination_best_of IS 'Best-of format for elimination matches (default: Bo3)';
COMMENT ON COLUMN public.tournaments.finals_best_of IS 'Best-of format for grand finals/championship match (default: Bo5)';
