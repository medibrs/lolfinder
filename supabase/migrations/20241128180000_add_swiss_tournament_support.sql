-- Swiss Tournament Enhancement - The Final 10%
-- Run this in your Supabase SQL editor

-- Enhanced tournament participants for Swiss scoring
ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS swiss_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tiebreaker_points DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS buchholz_score DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dropped_out_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS opponents_played UUID[] DEFAULT '{}';

-- Add Swiss-specific settings to tournaments
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS swiss_rounds INTEGER DEFAULT 5, -- Number of Swiss rounds
ADD COLUMN IF NOT EXISTS swiss_points_per_win INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS swiss_points_per_draw INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS swiss_points_per_loss INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS top_cut_size INTEGER DEFAULT 8, -- Top cut to elimination bracket
ADD COLUMN IF NOT EXISTS enable_top_cut BOOLEAN DEFAULT false;

-- Swiss pairings table (tracks pairing history and constraints)
CREATE TABLE IF NOT EXISTS swiss_pairings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    round_number INTEGER NOT NULL,
    player1_id UUID NOT NULL,
    player2_id UUID NOT NULL,
    cannot_pair_again BOOLEAN DEFAULT true, -- Players shouldn't meet again in Swiss
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (player1_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, round_number, player1_id, player2_id),
    CHECK (player1_id != player2_id)
);

-- Swiss round results table (for quick standings calculation)
CREATE TABLE IF NOT EXISTS swiss_round_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    team_id UUID NOT NULL,
    round_number INTEGER NOT NULL,
    opponent_id UUID NOT NULL,
    result VARCHAR(20) NOT NULL, -- 'win', 'draw', 'loss', 'bye'
    points_earned INTEGER DEFAULT 0,
    tiebreaker_earned DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (opponent_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, team_id, round_number)
);

-- Indexes for Swiss performance
CREATE INDEX IF NOT EXISTS idx_swiss_pairings_tournament ON swiss_pairings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_swiss_pairings_players ON swiss_pairings(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_swiss_round_results_tournament ON swiss_round_results(tournament_id);
CREATE INDEX IF NOT EXISTS idx_swiss_round_results_standings ON swiss_round_results(tournament_id, round_number, points_earned DESC);

-- RLS for Swiss tables
ALTER TABLE swiss_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE swiss_round_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view Swiss pairings" ON swiss_pairings
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage Swiss pairings" ON swiss_pairings
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = swiss_pairings.tournament_id
        )
    );

CREATE POLICY "Anyone can view Swiss results" ON swiss_round_results
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage Swiss results" ON swiss_round_results
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = swiss_round_results.tournament_id
        )
    );

-- Core Swiss Functions

-- Function to generate Swiss round pairings
CREATE OR REPLACE FUNCTION generate_swiss_round_pairings(
    tournament_id_param UUID,
    round_number_param INTEGER
)
RETURNS TABLE (
    match_id UUID,
    team1_id UUID,
    team2_id UUID,
    table_number INTEGER
) AS $$
DECLARE
    tournament_record RECORD;
    participants RECORD;
    pairing_possible BOOLEAN := true;
    table_counter INTEGER := 1;
    bye_team UUID;
BEGIN
    -- Get tournament settings
    SELECT * INTO tournament_record
    FROM tournaments 
    WHERE id = tournament_id_param 
    AND format = 'Swiss';
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Get active participants sorted by Swiss score (for pairing)
    CREATE TEMPORARY TABLE active_participants AS
    SELECT 
        tp.team_id,
        tp.swiss_score,
        tp.tiebreaker_points,
        tp.dropped_out_at IS NULL as is_active
    FROM tournament_participants tp
    WHERE tp.tournament_id = tournament_id_param
    AND tp.dropped_out_at IS NULL
    ORDER BY tp.swiss_score DESC, tp.tiebreaker_points DESC;
    
    -- Handle odd number of participants (assign bye)
    IF (SELECT COUNT(*) FROM active_participants WHERE is_active = true) % 2 = 1 THEN
        -- Assign bye to lowest-scored participant without previous bye
        SELECT team_id INTO bye_team
        FROM active_participants 
        WHERE is_active = true
        AND team_id NOT IN (
            SELECT DISTINCT team_id FROM swiss_round_results 
            WHERE tournament_id = tournament_id_param 
            AND result = 'bye'
        )
        ORDER BY swiss_score ASC, tiebreaker_points ASC
        LIMIT 1;
        
        -- Create bye result record
        INSERT INTO swiss_round_results (
            tournament_id, team_id, round_number, opponent_id, 
            result, points_earned, tiebreaker_earned
        ) VALUES (
            tournament_id_param, bye_team, round_number_param, 
            bye_team, 'bye', 
            tournament_record.swiss_points_per_win, -- Bye gets win points
            tournament_record.swiss_points_per_win::DECIMAL -- Tiebreaker points
        );
        
        -- Update participant score
        UPDATE tournament_participants
        SET swiss_score = swiss_score + tournament_record.swiss_points_per_win,
            tiebreaker_points = tiebreaker_points + tournament_record.swiss_points_per_win
        WHERE tournament_id = tournament_id_param AND team_id = bye_team;
    END IF;
    
    -- Generate pairings using Swiss system
    FOR participants IN 
        SELECT team_id, swiss_score, tiebreaker_points
        FROM active_participants 
        WHERE is_active = true 
        AND team_id != bye_team
        ORDER BY swiss_score DESC, tiebreaker_points DESC
    LOOP
        -- Find opponent with same score (or closest)
        DECLARE
            opponent_id UUID;
        BEGIN
            SELECT p2.team_id INTO opponent_id
            FROM active_participants p2
            WHERE p2.is_active = true 
            AND p2.team_id != participants.team_id
            AND p2.team_id != bye_team
            AND p2.team_id NOT IN (
                -- Avoid rematches
                SELECT opponent_id FROM swiss_round_results 
                WHERE tournament_id = tournament_id_param 
                AND team_id = participants.team_id
            )
            AND participants.team_id NOT IN (
                -- Avoid rematches (other direction)
                SELECT team_id FROM swiss_round_results 
                WHERE tournament_id = tournament_id_param 
                AND opponent_id = p2.team_id
            )
            ORDER BY 
                ABS(p2.swiss_score - participants.swiss_score) ASC,
                ABS(p2.tiebreaker_points - participants.tiebreaker_points) ASC,
                p2.swiss_score DESC
            LIMIT 1;
            
            IF opponent_id IS NOT NULL THEN
                -- Create match
                INSERT INTO tournament_matches (
                    tournament_id, bracket_id, team1_id, team2_id,
                    match_number, scheduled_at, status
                ) VALUES (
                    tournament_id_param,
                    (SELECT id FROM tournament_brackets 
                     WHERE tournament_id = tournament_id_param 
                     AND round_number = round_number_param 
                     AND bracket_position = table_counter),
                    participants.team_id,
                    opponent_id,
                    table_counter,
                    NOW() + (round_number_param * INTERVAL '1 day'),
                    'Scheduled'
                ) RETURNING id INTO match_id;
                
                -- Record pairing to prevent rematches
                INSERT INTO swiss_pairings (
                    tournament_id, round_number, player1_id, player2_id
                ) VALUES (
                    tournament_id_param, round_number_param, 
                    participants.team_id, opponent_id
                );
                
                -- Update opponents list
                UPDATE tournament_participants
                SET opponents_played = array_append(opponents_played, opponent_id)
                WHERE tournament_id = tournament_id_param AND team_id = participants.team_id;
                
                UPDATE tournament_participants
                SET opponents_played = array_append(opponents_played, participants.team_id)
                WHERE tournament_id = tournament_id_param AND team_id = opponent_id;
                
                -- Return result
                match_id := match_id;
                team1_id := participants.team_id;
                team2_id := opponent_id;
                table_number := table_counter;
                
                table_counter := table_counter + 1;
                
                RETURN NEXT;
            END IF;
        END;
    END LOOP;
    
    -- Clean up temp table
    DROP TABLE IF EXISTS active_participants;
    
    -- Log pairing generation
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        tournament_id_param,
        'SWISS_PAIRINGS_GENERATED',
        JSON_BUILD_OBJECT(
            'round', round_number_param,
            'tables_generated', table_counter - 1,
            'bye_team', bye_team
        )::text,
        auth.uid()
    );
    
END;
$$ LANGUAGE plpgsql;

-- Function to update Swiss standings after match results
CREATE OR REPLACE FUNCTION update_swiss_standings(
    tournament_id_param UUID,
    round_number_param INTEGER
)
RETURNS VOID AS $$
DECLARE
    tournament_record RECORD;
    match_record RECORD;
BEGIN
    -- Get tournament settings
    SELECT * INTO tournament_record
    FROM tournaments 
    WHERE id = tournament_id_param;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Process completed matches for this round
    FOR match_record IN 
        SELECT tm.id, tm.team1_id, tm.team2_id, tm.winner_id, tm.result
        FROM tournament_matches tm
        WHERE tm.tournament_id = tournament_id_param
        AND tm.status = 'Completed'
        AND tm.id NOT IN (
            SELECT DISTINCT match_id FROM swiss_round_results 
            WHERE tournament_id = tournament_id_param 
            AND round_number = round_number_param
        )
    LOOP
        -- Update results for both teams
        IF match_record.winner_id = match_record.team1_id THEN
            -- Team 1 won
            INSERT INTO swiss_round_results (
                tournament_id, team_id, round_number, opponent_id,
                result, points_earned, tiebreaker_earned
            ) VALUES (
                tournament_id_param, match_record.team1_id, round_number_param,
                match_record.team2_id, 'win',
                tournament_record.swiss_points_per_win,
                tournament_record.swiss_points_per_win::DECIMAL
            ) ON CONFLICT (tournament_id, team_id, round_number) 
            DO UPDATE SET points_earned = EXCLUDED.points_earned;
            
            INSERT INTO swiss_round_results (
                tournament_id, team_id, round_number, opponent_id,
                result, points_earned, tiebreaker_earned
            ) VALUES (
                tournament_id_param, match_record.team2_id, round_number_param,
                match_record.team1_id, 'loss',
                tournament_record.swiss_points_per_loss,
                0
            ) ON CONFLICT (tournament_id, team_id, round_number) 
            DO UPDATE SET points_earned = EXCLUDED.points_earned;
            
        ELSIF match_record.winner_id = match_record.team2_id THEN
            -- Team 2 won
            INSERT INTO swiss_round_results (
                tournament_id, team_id, round_number, opponent_id,
                result, points_earned, tiebreaker_earned
            ) VALUES (
                tournament_id_param, match_record.team2_id, round_number_param,
                match_record.team1_id, 'win',
                tournament_record.swiss_points_per_win,
                tournament_record.swiss_points_per_win::DECIMAL
            ) ON CONFLICT (tournament_id, team_id, round_number) 
            DO UPDATE SET points_earned = EXCLUDED.points_earned;
            
            INSERT INTO swiss_round_results (
                tournament_id, team_id, round_number, opponent_id,
                result, points_earned, tiebreaker_earned
            ) VALUES (
                tournament_id_param, match_record.team1_id, round_number_param,
                match_record.team2_id, 'loss',
                tournament_record.swiss_points_per_loss,
                0
            ) ON CONFLICT (tournament_id, team_id, round_number) 
            DO UPDATE SET points_earned = EXCLUDED.points_earned;
        END IF;
    END LOOP;
    
    -- Calculate Buchholz tiebreakers (sum of opponents' scores)
    UPDATE tournament_participants tp
    SET buchholz_score = COALESCE((
        SELECT SUM(srr.points_earned)
        FROM swiss_round_results srr
        WHERE srr.opponent_id = tp.team_id
        AND srr.tournament_id = tournament_id_param
    ), 0)
    WHERE tp.tournament_id = tournament_id_param;
    
    -- Update final Swiss scores
    UPDATE tournament_participants tp
    SET swiss_score = COALESCE((
        SELECT SUM(srr.points_earned)
        FROM swiss_round_results srr
        WHERE srr.team_id = tp.team_id
        AND srr.tournament_id = tournament_id_param
    ), 0),
    tiebreaker_points = COALESCE(buchholz_score, 0)
    WHERE tp.tournament_id = tournament_id_param;
    
    -- Log standings update
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        tournament_id_param,
        'SWISS_STANDINGS_UPDATED',
        JSON_BUILD_OBJECT('round', round_number_param)::text,
        auth.uid()
    );
    
END;
$$ LANGUAGE plpgsql;

-- Function to check if Swiss should advance to top cut
CREATE OR REPLACE FUNCTION check_swiss_top_cut(tournament_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tournament_record RECORD;
    rounds_completed INTEGER;
    should_cut BOOLEAN := false;
BEGIN
    -- Get tournament info
    SELECT * INTO tournament_record
    FROM tournaments 
    WHERE id = tournament_id_param 
    AND format = 'Swiss';
    
    IF NOT FOUND OR NOT tournament_record.enable_top_cut THEN
        RETURN FALSE;
    END IF;
    
    -- Check if all Swiss rounds are completed
    SELECT COUNT(DISTINCT round_number)
    INTO rounds_completed
    FROM swiss_round_results
    WHERE tournament_id = tournament_id_param;
    
    IF rounds_completed >= tournament_record.swiss_rounds THEN
        -- Generate elimination bracket for top cut
        PERFORM generate_top_cut_bracket(tournament_id_param);
        should_cut := TRUE;
    END IF;
    
    RETURN should_cut;
END;
$$ LANGUAGE plpgsql;

-- Function to generate top cut elimination bracket
CREATE OR REPLACE FUNCTION generate_top_cut_bracket(tournament_id_param UUID)
RETURNS VOID AS $$
DECLARE
    tournament_record RECORD;
    top_teams RECORD;
    bracket_size INTEGER;
BEGIN
    -- Get tournament info
    SELECT * INTO tournament_record
    FROM tournaments 
    WHERE id = tournament_id_param;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Calculate bracket size for top cut
    bracket_size := calculate_next_power_of_two(tournament_record.top_cut_size);
    
    -- Get top teams by Swiss standings
    CREATE TEMPORARY TABLE top_cut_teams AS
    SELECT 
        tp.team_id,
        ROW_NUMBER() OVER (ORDER BY tp.swiss_score DESC, tp.tiebreaker_points DESC) as seed
    FROM tournament_participants tp
    WHERE tp.tournament_id = tournament_id_param
    AND tp.dropped_out_at IS NULL
    ORDER BY tp.swiss_score DESC, tp.tiebreaker_points DESC
    LIMIT tournament_record.top_cut_size;
    
    -- Update tournament status
    UPDATE tournaments
    SET status = 'In_Progress',
        current_round = 0,
        total_rounds = CEIL(LOG(2, bracket_size))
    WHERE id = tournament_id_param;
    
    -- Create elimination bracket
    INSERT INTO tournament_brackets (tournament_id, round_number, bracket_position)
    SELECT 
        tournament_id_param,
        generate_series(1, CEIL(LOG(2, bracket_size))),
        generate_series(1, POWER(2, CEIL(LOG(2, bracket_size)) - 1));
    
    -- Log top cut generation
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        tournament_id_param,
        'SWISS_TOP_CUT_GENERATED',
        JSON_BUILD_OBJECT(
            'top_cut_size', tournament_record.top_cut_size,
            'bracket_size', bracket_size
        )::text,
        auth.uid()
    );
    
    DROP TABLE IF EXISTS top_cut_teams;
END;
$$ LANGUAGE plpgsql;

-- Enhanced view for Swiss standings
CREATE OR REPLACE VIEW swiss_standings_view AS
SELECT 
    tp.tournament_id,
    t.name as tournament_name,
    tp.team_id,
    team.name as team_name,
    captain.summoner_name as captain_name,
    tp.swiss_score,
    tp.tiebreaker_points,
    tp.buchholz_score,
    ROW_NUMBER() OVER (PARTITION BY tp.tournament_id ORDER BY tp.swiss_score DESC, tp.tiebreaker_points DESC) as current_rank,
    COUNT(srr.id) as rounds_played,
    COUNT(CASE WHEN srr.result = 'win' THEN 1 END) as wins,
    COUNT(CASE WHEN srr.result = 'draw' THEN 1 END) as draws,
    COUNT(CASE WHEN srr.result = 'loss' THEN 1 END) as losses,
    COUNT(CASE WHEN srr.result = 'bye' THEN 1 END) as byes,
    tp.dropped_out_at is not null as dropped_out
FROM tournament_participants tp
JOIN teams team ON tp.team_id = team.id
LEFT JOIN players captain ON team.captain_id = captain.id
LEFT JOIN swiss_round_results srr ON tp.team_id = srr.team_id AND tp.tournament_id = srr.tournament_id
JOIN tournaments t ON tp.tournament_id = t.id
WHERE t.format = 'Swiss'
GROUP BY tp.tournament_id, t.name, tp.team_id, team.name, captain.summoner_name, tp.swiss_score, tp.tiebreaker_points, tp.buchholz_score, tp.dropped_out_at
ORDER BY tp.tournament_id, tp.swiss_score DESC, tp.tiebreaker_points DESC;
