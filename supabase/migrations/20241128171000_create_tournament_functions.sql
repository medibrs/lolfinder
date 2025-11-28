-- Tournament Management Functions
-- Run this in your Supabase SQL editor

-- Function to calculate next power of 2 (for bracket sizing)
CREATE OR REPLACE FUNCTION calculate_next_power_of_two(n INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN 1 << CEIL(LOG(2, GREATEST(n, 2)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate single elimination bracket
CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(
    tournament_id_param UUID,
    num_teams INTEGER
)
RETURNS VOID AS $$
DECLARE
    bracket_size INTEGER;
    num_rounds INTEGER;
    current_round INTEGER;
    matches_in_round INTEGER;
    total_matches INTEGER;
    match_counter INTEGER;
    parent_match_id UUID;
BEGIN
    -- Calculate bracket size (next power of 2)
    bracket_size := calculate_next_power_of_two(num_teams);
    num_rounds := CEIL(LOG(2, bracket_size));
    
    -- Update tournament info
    UPDATE tournaments 
    SET 
        total_rounds = num_rounds,
        current_round = 0,
        status = 'Seeding'
    WHERE id = tournament_id_param;
    
    -- Generate brackets from final round backwards
    FOR current_round IN REVERSE num_rounds..1 LOOP
        matches_in_round := POWER(2, current_round - 1);
        
        -- Create matches for this round
        FOR i IN 1..matches_in_round LOOP
            INSERT INTO tournament_matches (
                tournament_id,
                bracket_id,
                match_number,
                scheduled_at,
                status
            ) VALUES (
                tournament_id_param,
                (SELECT id FROM tournament_brackets 
                 WHERE tournament_id = tournament_id_param 
                 AND round_number = current_round 
                 AND bracket_position = i),
                i,
                NOW() + (current_round * INTERVAL '1 day'),
                'Scheduled'
            );
        END LOOP;
    END LOOP;
    
    -- Log bracket generation
    INSERT INTO tournament_logs (
        tournament_id,
        action,
        details,
        user_id
    ) VALUES (
        tournament_id_param,
        'BRACKET_GENERATED',
        JSON_BUILD_OBJECT(
            'format', 'Single Elimination',
            'teams', num_teams,
            'rounds', num_rounds,
            'bracket_size', bracket_size
        )::text,
        auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

-- Function to advance tournament to next round
CREATE OR REPLACE FUNCTION advance_tournament_round(tournament_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_status tournament_status_type;
    current_round INTEGER;
    total_rounds INTEGER;
    next_round INTEGER;
    pending_matches INTEGER;
BEGIN
    -- Get tournament status
    SELECT status, current_round, total_rounds 
    INTO current_status, current_round, total_rounds
    FROM tournaments 
    WHERE id = tournament_id_param;
    
    -- Check if all current round matches are completed
    SELECT COUNT(*)
    INTO pending_matches
    FROM tournament_matches
    WHERE tournament_id = tournament_id_param
    AND round_number = current_round
    AND status != 'Completed';
    
    IF pending_matches > 0 THEN
        RETURN FALSE; -- Can't advance, matches still pending
    END IF;
    
    -- Advance to next round
    next_round := current_round + 1;
    
    IF next_round > total_rounds THEN
        -- Tournament completed
        UPDATE tournaments 
        SET status = 'Completed', current_round = total_rounds
        WHERE id = tournament_id_param;
    ELSE
        -- Move to next round
        UPDATE tournaments 
        SET status = 'In_Progress', current_round = next_round
        WHERE id = tournament_id_param;
        
        -- Schedule next round matches
        UPDATE tournament_matches
        SET scheduled_at = NOW() + (next_round * INTERVAL '1 day')
        WHERE tournament_id = tournament_id_param
        AND round_number = next_round;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically seed teams
CREATE OR REPLACE FUNCTION seed_tournament_teams(tournament_id_param UUID)
RETURNS VOID AS $$
DECLARE
    team_record RECORD;
    seed_counter INTEGER := 1;
    total_teams INTEGER;
    bracket_size INTEGER;
    byes_needed INTEGER;
BEGIN
    -- Count registered teams
    SELECT COUNT(*)
    INTO total_teams
    FROM tournament_participants
    WHERE tournament_id = tournament_id_param
    AND is_active = true;
    
    -- Calculate bracket size and byes
    bracket_size := calculate_next_power_of_two(total_teams);
    byes_needed := bracket_size - total_teams;
    
    -- Seed teams (simple random seeding for now)
    FOR team_record IN 
        SELECT tp.id, tp.team_id, t.name
        FROM tournament_participants tp
        JOIN teams t ON tp.team_id = t.id
        WHERE tp.tournament_id = tournament_id_param
        AND tp.is_active = true
        ORDER BY RANDOM()
    LOOP
        UPDATE tournament_participants
        SET seed_number = seed_counter
        WHERE id = team_record.id;
        
        seed_counter := seed_counter + 1;
    END LOOP;
    
    -- Update tournament status
    UPDATE tournaments
    SET status = 'In_Progress'
    WHERE id = tournament_id_param;
    
    -- Log seeding
    INSERT INTO tournament_logs (
        tournament_id,
        action,
        details,
        user_id
    ) VALUES (
        tournament_id_param,
        'TEAMS_SEEDED',
        JSON_BUILD_OBJECT(
            'total_teams', total_teams,
            'bracket_size', bracket_size,
            'byes_needed', byes_needed
        )::text,
        auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update match result and advance winner
CREATE OR REPLACE FUNCTION update_match_result(
    match_id_param UUID,
    winner_id_param UUID,
    result_param match_result_type,
    team1_score_param INTEGER DEFAULT NULL,
    team2_score_param INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    match_record RECORD;
    tournament_id UUID;
    next_round INTEGER;
    next_bracket_position INTEGER;
    next_match_id UUID;
BEGIN
    -- Get match info
    SELECT * INTO match_record
    FROM tournament_matches
    WHERE id = match_id_param;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update match result
    UPDATE tournament_matches
    SET 
        winner_id = winner_id_param,
        result = result_param,
        team1_score = COALESCE(team1_score_param, team1_score),
        team2_score = COALESCE(team2_score_param, team2_score),
        status = 'Completed',
        completed_at = NOW()
    WHERE id = match_id_param;
    
    tournament_id := match_record.tournament_id;
    
    -- Find next match (winner advances)
    SELECT round_number + 1, CEIL(bracket_position / 2.0)
    INTO next_round, next_bracket_position
    FROM tournament_brackets
    WHERE id = match_record.bracket_id;
    
    -- Update next match with advancing team
    UPDATE tournament_matches
    SET 
        team1_id = CASE 
            WHEN bracket_position % 2 = 1 THEN winner_id_param
            ELSE team1_id
        END,
        team2_id = CASE 
            WHEN bracket_position % 2 = 0 THEN winner_id_param
            ELSE team2_id
        END
    WHERE tournament_id = tournament_id
    AND round_number = next_round
    AND bracket_position = next_bracket_position;
    
    -- Check if round is complete and advance tournament
    PERFORM advance_tournament_round(tournament_id);
    
    -- Log match result
    INSERT INTO tournament_logs (
        tournament_id,
        action,
        details,
        user_id
    ) VALUES (
        tournament_id,
        'MATCH_COMPLETED',
        JSON_BUILD_OBJECT(
            'match_id', match_id_param,
            'winner_id', winner_id_param,
            'result', result_param,
            'score', JSON_BUILD_OBJECT(
                'team1', team1_score_param,
                'team2', team2_score_param
            )
        )::text,
        auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get tournament bracket data (for UI)
CREATE OR REPLACE FUNCTION get_tournament_bracket(tournament_id_param UUID)
RETURNS TABLE (
    round_number INTEGER,
    bracket_position INTEGER,
    match_id UUID,
    team1_id UUID,
    team2_id UUID,
    winner_id UUID,
    team1_name TEXT,
    team2_name TEXT,
    winner_name TEXT,
    status match_status_type,
    scheduled_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tb.round_number,
        tb.bracket_position,
        tm.id,
        tm.team1_id,
        tm.team2_id,
        tm.winner_id,
        t1.name,
        t2.name,
        tw.name,
        tm.status,
        tm.scheduled_at
    FROM tournament_brackets tb
    LEFT JOIN tournament_matches tm ON tb.id = tm.bracket_id
    LEFT JOIN teams t1 ON tm.team1_id = t1.id
    LEFT JOIN teams t2 ON tm.team2_id = t2.id
    LEFT JOIN teams tw ON tm.winner_id = tw.id
    WHERE tb.tournament_id = tournament_id_param
    ORDER BY tb.round_number, tb.bracket_position;
END;
$$ LANGUAGE plpgsql;

-- Function to create tournament with admin
CREATE OR REPLACE FUNCTION create_tournament_with_admin(
    name_param TEXT,
    description_param TEXT,
    start_date_param TIMESTAMP WITH TIME ZONE,
    end_date_param TIMESTAMP WITH TIME ZONE,
    max_teams_param INTEGER,
    format_param tournament_format_type DEFAULT 'Single_Elimination',
    registration_deadline_param TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    tournament_id UUID;
BEGIN
    -- Create tournament
    INSERT INTO tournaments (
        name,
        description,
        start_date,
        end_date,
        max_teams,
        format,
        registration_deadline,
        status
    ) VALUES (
        name_param,
        description_param,
        start_date_param,
        end_date_param,
        max_teams_param,
        format_param,
        registration_deadline_param,
        'Registration'
    ) RETURNING id INTO tournament_id;
    
    -- Add creator as admin
    INSERT INTO tournament_admins (
        tournament_id,
        user_id,
        role,
        permissions
    ) VALUES (
        tournament_id,
        auth.uid(),
        'admin',
        '["manage_all"]'::jsonb::text
    );
    
    -- Log creation
    INSERT INTO tournament_logs (
        tournament_id,
        action,
        details,
        user_id
    ) VALUES (
        tournament_id,
        'TOURNAMENT_CREATED',
        JSON_BUILD_OBJECT(
            'name', name_param,
            'format', format_param,
            'max_teams', max_teams_param
        )::text,
        auth.uid()
    );
    
    RETURN tournament_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
