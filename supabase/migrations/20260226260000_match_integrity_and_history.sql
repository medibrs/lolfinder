-- Migration: Match result integrity and history audit
-- Description: Adds a system to track result changes for transparency and prevents illegal state transitions.

-- 1. Create match_result_audit table
CREATE TABLE IF NOT EXISTS public.match_result_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL,
    changed_by UUID, -- Admin who made the change
    previous_team1_score INTEGER,
    new_team1_score INTEGER,
    previous_team2_score INTEGER,
    new_team2_score INTEGER,
    previous_winner_id UUID,
    new_winner_id UUID,
    previous_status match_status_type,
    new_status match_status_type,
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Audit Trigger Function
CREATE OR REPLACE FUNCTION public.log_match_result_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.team1_score IS DISTINCT FROM NEW.team1_score OR 
        OLD.team2_score IS DISTINCT FROM NEW.team2_score OR 
        OLD.winner_id IS DISTINCT FROM NEW.winner_id OR 
        OLD.status IS DISTINCT FROM NEW.status) THEN
        
        INSERT INTO public.match_result_audit (
            match_id,
            previous_team1_score,
            new_team1_score,
            previous_team2_score,
            new_team2_score,
            previous_winner_id,
            new_winner_id,
            previous_status,
            new_status,
            created_at
        ) VALUES (
            NEW.id,
            OLD.team1_score,
            NEW.team1_score,
            OLD.team2_score,
            NEW.team2_score,
            OLD.winner_id,
            NEW.winner_id,
            OLD.status,
            NEW.status,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Apply trigger to tournament_matches
DROP TRIGGER IF EXISTS tr_log_match_result_change ON public.tournament_matches;
CREATE TRIGGER tr_log_match_result_change
AFTER UPDATE ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.log_match_result_change();

-- Comment for documentation
COMMENT ON TABLE public.match_result_audit IS 'Audit trail for every result change in the tournament matches.';
