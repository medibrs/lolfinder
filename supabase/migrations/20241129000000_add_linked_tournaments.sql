-- Add support for Linked Tournaments (Stages)
-- This allows creating a structure like: 
-- Main Tournament (Parent)
--   -> Group A (Stage 1, Child)
--   -> Group B (Stage 1, Child)
--   -> Playoffs (Stage 2, Child)

-- 1. Add linking columns to tournaments table
ALTER TABLE tournaments 
ADD COLUMN parent_tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
ADD COLUMN stage_order INTEGER DEFAULT 0, -- 0=Main/Standalone, 1=Stage 1, 2=Stage 2, etc.
ADD COLUMN stage_type VARCHAR(50) DEFAULT 'Main'; -- 'Group_Stage', 'Playoffs', 'Qualifier', etc.

-- 2. Create index for performance
CREATE INDEX idx_tournaments_parent_id ON tournaments(parent_tournament_id);

-- 3. Helper function to get full tournament chain
CREATE OR REPLACE FUNCTION get_tournament_stages(root_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    stage_order INTEGER,
    stage_type VARCHAR,
    status tournament_status_type,
    participant_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE tournament_tree AS (
        -- Base case: the requested tournament
        SELECT t.id, t.name, t.stage_order, t.stage_type, t.status, t.parent_tournament_id
        FROM tournaments t
        WHERE t.id = root_id
        
        UNION
        
        -- Recursive case: children
        SELECT t.id, t.name, t.stage_order, t.stage_type, t.status, t.parent_tournament_id
        FROM tournaments t
        JOIN tournament_tree tt ON t.parent_tournament_id = tt.id
    )
    SELECT 
        tt.id, 
        tt.name, 
        tt.stage_order, 
        tt.stage_type, 
        tt.status,
        (SELECT COUNT(*) FROM tournament_participants tp WHERE tp.tournament_id = tt.id AND tp.is_active = true) as participant_count
    FROM tournament_tree tt
    ORDER BY tt.stage_order, tt.name;
END;
$$ LANGUAGE plpgsql;

-- 4. Function to Promote Teams (Move top N teams from one tournament to another)
CREATE OR REPLACE FUNCTION promote_teams(
    source_tournament_id UUID,
    target_tournament_id UUID,
    teams_to_promote INTEGER
) RETURNS INTEGER AS $$
DECLARE
    promoted_count INTEGER;
BEGIN
    -- Insert top N teams from source to target
    -- Logic depends on format (Swiss vs Brackets), here using standings/rank
    WITH top_teams AS (
        -- Get teams from standings or calculate rank dynamically
        SELECT tp.team_id
        FROM tournament_participants tp
        WHERE tp.tournament_id = source_tournament_id
        AND tp.is_active = true
        ORDER BY 
            tp.swiss_score DESC NULLS LAST, 
            tp.tiebreaker_points DESC NULLS LAST,
            tp.seed_number ASC
        LIMIT teams_to_promote
    )
    INSERT INTO tournament_participants (tournament_id, team_id, seed_number, is_active)
    SELECT 
        target_tournament_id,
        team_id,
        -- Generate new seed based on previous rank (row number)
        (SELECT COUNT(*) + 1 FROM tournament_participants WHERE tournament_id = target_tournament_id),
        true
    FROM top_teams
    ON CONFLICT (tournament_id, team_id) DO NOTHING;

    GET DIAGNOSTICS promoted_count = ROW_COUNT;
    
    -- Log the promotion
    IF promoted_count > 0 THEN
        INSERT INTO tournament_logs (
            tournament_id, action, details, event_category, impact_level
        ) VALUES (
            target_tournament_id, 
            'TEAMS_PROMOTED', 
            format('%s teams promoted from tournament %s', promoted_count, source_tournament_id),
            'admin',
            'high'
        );
    END IF;

    RETURN promoted_count;
END;
$$ LANGUAGE plpgsql;
