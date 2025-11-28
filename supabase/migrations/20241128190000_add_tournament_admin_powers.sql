-- Tournament Admin Emergency Powers
-- For real-life tournament management and unexpected issues
-- Run this in your Supabase SQL editor

-- Enhanced tournament admin permissions
ALTER TABLE tournament_admins
ADD COLUMN IF NOT EXISTS can_override_matches BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_disqualify_teams BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_edit_bracket BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_reschedule_matches BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_replace_teams BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_force_advance BOOLEAN DEFAULT false;

-- Tournament issues tracking (for admin decisions)
CREATE TABLE IF NOT EXISTS tournament_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    issue_type VARCHAR(50) NOT NULL, -- 'disqualification', 'no_show', 'replacement', 'schedule_conflict', 'other'
    description TEXT NOT NULL,
    affected_team_id UUID,
    affected_match_id UUID,
    resolution TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (affected_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (affected_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Manual bracket adjustments (for emergency changes)
CREATE TABLE IF NOT EXISTS tournament_bracket_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    original_match_id UUID,
    adjustment_type VARCHAR(50) NOT NULL, -- 'team_replacement', 'winner_override', 'bracket_restructure', 'match_reschedule'
    original_data TEXT, -- JSON of original state
    new_data TEXT, -- JSON of new state
    reason TEXT NOT NULL,
    admin_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (original_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL,
    FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enhanced admin functions

-- Function to override match result (emergency admin power)
CREATE OR REPLACE FUNCTION admin_override_match_result(
    match_id_param UUID,
    new_winner_id UUID,
    new_result match_result_type,
    new_team1_score INTEGER DEFAULT NULL,
    new_team2_score INTEGER DEFAULT NULL,
    reason_param TEXT DEFAULT 'Admin override'
)
RETURNS BOOLEAN AS $$
DECLARE
    admin_permissions RECORD;
    match_record RECORD;
    original_winner UUID;
BEGIN
    -- Check admin permissions
    SELECT ta.* INTO admin_permissions
    FROM tournament_admins ta
    WHERE ta.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id_param)
    AND ta.user_id = auth.uid()
    AND ta.can_override_matches = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admin does not have override permissions';
    END IF;
    
    -- Get original match data
    SELECT * INTO match_record
    FROM tournament_matches
    WHERE id = match_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;
    
    original_winner := match_record.winner_id;
    
    -- Record the adjustment
    INSERT INTO tournament_bracket_adjustments (
        tournament_id, original_match_id, adjustment_type,
        original_data, new_data, reason, admin_id
    ) VALUES (
        match_record.tournament_id,
        match_id_param,
        'winner_override',
        JSON_BUILD_OBJECT(
            'winner_id', match_record.winner_id,
            'result', match_record.result,
            'team1_score', match_record.team1_score,
            'team2_score', match_record.team2_score
        )::text,
        JSON_BUILD_OBJECT(
            'winner_id', new_winner_id,
            'result', new_result,
            'team1_score', new_team1_score,
            'team2_score', new_team2_score
        )::text,
        reason_param,
        auth.uid()
    );
    
    -- Update match with new result
    UPDATE tournament_matches
    SET 
        winner_id = new_winner_id,
        result = new_result,
        team1_score = COALESCE(new_team1_score, team1_score),
        team2_score = COALESCE(new_team2_score, team2_score),
        status = 'Completed',
        completed_at = NOW()
    WHERE id = match_id_param;
    
    -- Log the override
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        match_record.tournament_id,
        'MATCH_RESULT_OVERRIDDEN',
        JSON_BUILD_OBJECT(
            'match_id', match_id_param,
            'original_winner', original_winner,
            'new_winner', new_winner_id,
            'reason', reason_param
        )::text,
        auth.uid()
    );
    
    -- Handle bracket advancement if needed
    IF original_winner != new_winner_id THEN
        -- Need to update next round matches
        UPDATE tournament_matches
        SET team1_id = CASE 
            WHEN team1_id = original_winner THEN new_winner_id
            ELSE team1_id
        END,
        team2_id = CASE 
            WHEN team2_id = original_winner THEN new_winner_id
            ELSE team2_id
        END
        WHERE tournament_id = match_record.tournament_id
        AND (team1_id = original_winner OR team2_id = original_winner)
        AND id != match_id_param;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to disqualify team from tournament
CREATE OR REPLACE FUNCTION admin_disqualify_team(
    tournament_id_param UUID,
    team_id_param UUID,
    reason_param TEXT DEFAULT 'Team disqualified'
)
RETURNS BOOLEAN AS $$
DECLARE
    admin_permissions RECORD;
    team_matches RECORD;
BEGIN
    -- Check admin permissions
    SELECT ta.* INTO admin_permissions
    FROM tournament_admins ta
    WHERE ta.tournament_id = tournament_id_param
    AND ta.user_id = auth.uid()
    AND ta.can_disqualify_teams = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admin does not have disqualification permissions';
    END IF;
    
    -- Record the disqualification issue
    INSERT INTO tournament_issues (
        tournament_id, issue_type, description, affected_team_id, resolved_by, resolved_at
    ) VALUES (
        tournament_id_param,
        'disqualification',
        reason_param,
        team_id_param,
        auth.uid(),
        NOW()
    );
    
    -- Mark team as inactive in participants
    UPDATE tournament_participants
    SET is_active = false
    WHERE tournament_id = tournament_id_param
    AND team_id = team_id_param;
    
    -- Handle upcoming matches (set as cancelled/forfeit)
    FOR team_matches IN 
        SELECT id, team1_id, team2_id
        FROM tournament_matches
        WHERE tournament_id = tournament_id_param
        AND status = 'Scheduled'
        AND (team1_id = team_id_param OR team2_id = team_id_param)
    LOOP
        -- Award forfeit win to opponent
        UPDATE tournament_matches
        SET 
            winner_id = CASE 
                WHEN team1_id = team_id_param THEN team2_id
                ELSE team1_id
            END,
            result = 'Team2_Win', -- Will be updated below
            status = 'Completed',
            completed_at = NOW()
        WHERE id = team_matches.id;
        
        -- Update result to reflect actual winner
        UPDATE tournament_matches
        SET result = CASE 
            WHEN team_matches.team1_id = team_id_param THEN 'Team2_Win'
            ELSE 'Team1_Win'
        END
        WHERE id = team_matches.id;
        
        -- Advance the winner
        PERFORM update_match_result(team_matches.id, 
            CASE 
                WHEN team_matches.team1_id = team_id_param THEN team_matches.team2_id
                ELSE team_matches.team1_id
            END,
            CASE 
                WHEN team_matches.team1_id = team_id_param THEN 'Team2_Win'
                ELSE 'Team1_Win'
            END
        );
    END LOOP;
    
    -- Log the disqualification
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        tournament_id_param,
        'TEAM_DISQUALIFIED',
        JSON_BUILD_OBJECT(
            'team_id', team_id_param,
            'reason', reason_param
        )::text,
        auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to replace team in tournament
CREATE OR REPLACE FUNCTION admin_replace_team(
    tournament_id_param UUID,
    old_team_id UUID,
    new_team_id UUID,
    reason_param TEXT DEFAULT 'Team replacement'
)
RETURNS BOOLEAN AS $$
DECLARE
    admin_permissions RECORD;
BEGIN
    -- Check admin permissions
    SELECT ta.* INTO admin_permissions
    FROM tournament_admins ta
    WHERE ta.tournament_id = tournament_id_param
    AND ta.user_id = auth.uid()
    AND ta.can_replace_teams = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admin does not have team replacement permissions';
    END IF;
    
    -- Record the replacement issue
    INSERT INTO tournament_issues (
        tournament_id, issue_type, description, affected_team_id, resolved_by, resolved_at
    ) VALUES (
        tournament_id_param,
        'replacement',
        reason_param,
        old_team_id,
        auth.uid(),
        NOW()
    );
    
    -- Update participant record
    UPDATE tournament_participants
    SET team_id = new_team_id
    WHERE tournament_id = tournament_id_param
    AND team_id = old_team_id;
    
    -- Update all match references
    UPDATE tournament_matches
    SET team1_id = new_team_id
    WHERE tournament_id = tournament_id_param
    AND team1_id = old_team_id;
    
    UPDATE tournament_matches
    SET team2_id = new_team_id
    WHERE tournament_id = tournament_id_param
    AND team2_id = old_team_id;
    
    UPDATE tournament_matches
    SET winner_id = new_team_id
    WHERE tournament_id = tournament_id_param
    AND winner_id = old_team_id;
    
    -- Update standings
    UPDATE tournament_standings
    SET team_id = new_team_id
    WHERE tournament_id = tournament_id_param
    AND team_id = old_team_id;
    
    -- Log the replacement
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        tournament_id_param,
        'TEAM_REPLACED',
        JSON_BUILD_OBJECT(
            'old_team_id', old_team_id,
            'new_team_id', new_team_id,
            'reason', reason_param
        )::text,
        auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to force advance team (skip matches)
CREATE OR REPLACE FUNCTION admin_force_advance_team(
    tournament_id_param UUID,
    team_id_param UUID,
    target_round INTEGER,
    reason_param TEXT DEFAULT 'Admin force advance'
)
RETURNS BOOLEAN AS $$
DECLARE
    admin_permissions RECORD;
    next_match RECORD;
BEGIN
    -- Check admin permissions
    SELECT ta.* INTO admin_permissions
    FROM tournament_admins ta
    WHERE ta.tournament_id = tournament_id_param
    AND ta.user_id = auth.uid()
    AND ta.can_force_advance = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admin does not have force advance permissions';
    END IF;
    
    -- Find target match in specified round
    SELECT * INTO next_match
    FROM tournament_matches tm
    JOIN tournament_brackets tb ON tm.bracket_id = tb.id
    WHERE tm.tournament_id = tournament_id_param
    AND tb.round_number = target_round
    AND (tm.team1_id IS NULL OR tm.team2_id IS NULL)
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No available slot found in target round';
    END IF;
    
    -- Place team in target match
    UPDATE tournament_matches
    SET team1_id = COALESCE(team1_id, team_id_param),
        team2_id = CASE 
            WHEN team1_id IS NULL THEN team_id_param
            ELSE team2_id
        END
    WHERE id = next_match.id;
    
    -- Cancel any previous matches for this team
    UPDATE tournament_matches
    SET status = 'Cancelled'
    WHERE tournament_id = tournament_id_param
    AND (team1_id = team_id_param OR team2_id = team_id_param)
    AND status = 'Scheduled'
    AND id != next_match.id;
    
    -- Log the force advance
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        tournament_id_param,
        'TEAM_FORCE_ADVANCED',
        JSON_BUILD_OBJECT(
            'team_id', team_id_param,
            'target_round', target_round,
            'reason', reason_param
        )::text,
        auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reschedule match
CREATE OR REPLACE FUNCTION admin_reschedule_match(
    match_id_param UUID,
    new_time TIMESTAMP WITH TIME ZONE,
    reason_param TEXT DEFAULT 'Schedule change'
)
RETURNS BOOLEAN AS $$
DECLARE
    admin_permissions RECORD;
BEGIN
    -- Check admin permissions
    SELECT ta.* INTO admin_permissions
    FROM tournament_admins ta
    WHERE ta.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id_param)
    AND ta.user_id = auth.uid()
    AND ta.can_reschedule_matches = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admin does not have rescheduling permissions';
    END IF;
    
    -- Update match time
    UPDATE tournament_matches
    SET scheduled_at = new_time
    WHERE id = match_id_param;
    
    -- Log the reschedule
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        (SELECT tournament_id FROM tournament_matches WHERE id = match_id_param),
        'MATCH_RESCHEDULED',
        JSON_BUILD_OBJECT(
            'match_id', match_id_param,
            'new_time', new_time,
            'reason', reason_param
        )::text,
        auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for admin activity tracking
CREATE VIEW admin_tournament_activity AS
SELECT 
    t.id as tournament_id,
    t.name as tournament_name,
    ta.user_id as admin_id,
    u.email as admin_email,
    u.raw_user_meta_data->>'full_name' as admin_name,
    COUNT(tl.id) as actions_taken,
    MAX(tl.created_at) as last_action,
    STRING_AGG(DISTINCT tl.action, ', ') as action_types
FROM tournaments t
JOIN tournament_admins ta ON t.id = ta.tournament_id
JOIN auth.users u ON ta.user_id = u.id
LEFT JOIN tournament_logs tl ON t.id = tl.tournament_id AND tl.user_id = ta.user_id
GROUP BY t.id, t.name, ta.user_id, u.email, u.raw_user_meta_data->>'full_name'
ORDER BY last_action DESC NULLS LAST;

-- View for tournament issues
CREATE VIEW tournament_issues_dashboard AS
SELECT 
    ti.*,
    t.name as tournament_name,
    team.name as affected_team_name,
    tm.match_number as affected_match_number,
    resolver.email as resolved_by_email,
    resolver.raw_user_meta_data->>'full_name' as resolved_by_name
FROM tournament_issues ti
JOIN tournaments t ON ti.tournament_id = t.id
LEFT JOIN teams team ON ti.affected_team_id = team.id
LEFT JOIN tournament_matches tm ON ti.affected_match_id = tm.id
LEFT JOIN auth.users resolver ON ti.resolved_by = resolver.id
ORDER BY ti.created_at DESC;

-- Indexes for admin performance
CREATE INDEX IF NOT EXISTS idx_tournament_issues_tournament ON tournament_issues(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_issues_type ON tournament_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_tournament_bracket_adjustments_tournament ON tournament_bracket_adjustments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_bracket_adjustments_type ON tournament_bracket_adjustments(adjustment_type);

-- RLS for new admin tables
ALTER TABLE tournament_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_bracket_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view tournament issues" ON tournament_issues
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage issues" ON tournament_issues
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_issues.tournament_id
        )
    );

CREATE POLICY "Anyone can view bracket adjustments" ON tournament_bracket_adjustments
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage adjustments" ON tournament_bracket_adjustments
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = bracket_adjustments.tournament_id
        )
    );
