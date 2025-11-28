-- Enhanced Tournament Logging System
-- Complete tournament state tracking for stats, bragging rights, and admin oversight
-- Run this in your Supabase SQL editor

-- Enhanced tournament logs with more detailed tracking
ALTER TABLE tournament_logs
ADD COLUMN IF NOT EXISTS event_category VARCHAR(50) DEFAULT 'general',
ADD COLUMN IF NOT EXISTS impact_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
ADD COLUMN IF NOT EXISTS team_id UUID,
ADD COLUMN IF NOT EXISTS match_id UUID,
ADD COLUMN IF NOT EXISTS round_number INTEGER,
ADD COLUMN IF NOT EXISTS previous_state TEXT, -- JSON of state before change
ADD COLUMN IF NOT EXISTS new_state TEXT, -- JSON of state after change
ADD COLUMN IF NOT EXISTS public_visible BOOLEAN DEFAULT false, -- Show to public?
ADD COLUMN IF NOT EXISTS stat_impact BOOLEAN DEFAULT false; -- Affects player/team stats?

-- Tournament state snapshots (for historical analysis)
CREATE TABLE IF NOT EXISTS tournament_state_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    snapshot_type VARCHAR(50) NOT NULL, -- 'round_start', 'round_end', 'tournament_start', 'tournament_end', 'milestone'
    round_number INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_teams INTEGER,
    active_teams INTEGER,
    completed_matches INTEGER,
    total_matches INTEGER,
    current_leaderboard JSONB, -- Top 10 teams at this moment
    notable_events JSONB, -- Important events since last snapshot
    metadata JSONB, -- Additional context
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- Team performance history (for bragging rights)
CREATE TABLE IF NOT EXISTS team_tournament_performances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    team_id UUID NOT NULL,
    performance_data JSONB NOT NULL, -- Detailed performance metrics
    achievements JSONB, -- Notable achievements (perfect run, upset victory, etc.)
    statistics JSONB, -- Win rates, average game duration, etc.
    milestones JSONB, -- First tournament win, best placement, etc.
    bracket_path JSONB, -- Complete journey through bracket
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, team_id)
);

-- Match detail logs (for game-by-game analysis)
CREATE TABLE IF NOT EXISTS tournament_match_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL,
    game_number INTEGER NOT NULL,
    game_duration INTEGER, -- Seconds
    winning_team UUID NOT NULL,
    losing_team UUID,
    game_data JSONB, -- Kills, objectives, etc.
    player_performances JSONB, -- Individual player stats
    notable_events JSONB, -- First blood, baron steals, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (match_id) REFERENCES tournament_matches(id) ON DELETE CASCADE,
    FOREIGN KEY (winning_team) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (losing_team) REFERENCES teams(id) ON DELETE SET NULL,
    UNIQUE(match_id, game_number)
);

-- Tournament milestones (for achievement tracking)
CREATE TABLE IF NOT EXISTS tournament_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    milestone_type VARCHAR(50) NOT NULL, -- 'first_blood', 'perfect_game', 'upset_victory', 'comeback', 'record_breaking'
    description TEXT NOT NULL,
    team_id UUID,
    player_id UUID,
    match_id UUID,
    round_number INTEGER,
    significance_score INTEGER DEFAULT 1, -- 1-10 how significant
    public_story TEXT, -- Human-readable story
    metadata JSONB, -- Additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL
);

-- Player tournament histories (individual career tracking)
CREATE TABLE IF NOT EXISTS player_tournament_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL,
    tournament_id UUID NOT NULL,
    team_id UUID NOT NULL,
    role_in_team VARCHAR(20), -- 'captain', 'member', 'substitute'
    performance_data JSONB, -- KDA, win rate, etc.
    achievements JSONB, -- Individual achievements
    career_impact JSONB, -- How this affected their career
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(player_id, tournament_id)
);

-- Tournament analytics data (for insights)
CREATE TABLE IF NOT EXISTS tournament_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    analytics_type VARCHAR(50) NOT NULL, -- 'viewership', 'engagement', 'performance', 'predictions'
    data_point TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metrics JSONB NOT NULL, -- The actual analytics data
    comparisons JSONB, -- Historical comparisons
    insights TEXT, -- AI-generated insights
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- Enhanced logging functions

-- Function to log comprehensive tournament events
CREATE OR REPLACE FUNCTION log_tournament_event(
    tournament_id_param UUID,
    event_type_param VARCHAR(100),
    category_param VARCHAR(50) DEFAULT 'general',
    impact_param VARCHAR(20) DEFAULT 'low',
    details_param TEXT DEFAULT NULL,
    team_id_param UUID DEFAULT NULL,
    match_id_param UUID DEFAULT NULL,
    round_param INTEGER DEFAULT NULL,
    previous_state_param TEXT DEFAULT NULL,
    new_state_param TEXT DEFAULT NULL,
    public_param BOOLEAN DEFAULT false,
    stat_impact_param BOOLEAN DEFAULT false
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO tournament_logs (
        tournament_id, action, event_category, impact_level,
        details, team_id, match_id, round_number,
        previous_state, new_state, public_visible, stat_impact, user_id
    ) VALUES (
        tournament_id_param, event_type_param, category_param, impact_param,
        details_param, team_id_param, match_id_param, round_param,
        previous_state_param, new_state_param, public_param, stat_impact_param, auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

-- Function to create tournament state snapshot
CREATE OR REPLACE FUNCTION create_tournament_snapshot(
    tournament_id_param UUID,
    snapshot_type_param VARCHAR(50),
    round_param INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    snapshot_data JSONB;
    leaderboard_data JSONB;
    notable_events JSONB;
BEGIN
    -- Build leaderboard data
    SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'team_name', t.name,
            'team_id', tp.team_id,
            'placement', COALESCE(ts.placement, 0),
            'wins', COALESCE(ts.wins, 0),
            'losses', COALESCE(ts.losses, 0),
            'points', COALESCE(ts.points, 0)
        )
    ) INTO leaderboard_data
    FROM tournament_participants tp
    JOIN teams t ON tp.team_id = t.id
    LEFT JOIN tournament_standings ts ON tp.team_id = ts.team_id AND tp.tournament_id = ts.tournament_id
    WHERE tp.tournament_id = tournament_id_param
    ORDER BY COALESCE(ts.placement, 999)
    LIMIT 10;
    
    -- Get notable events since last snapshot
    SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'action', tl.action,
            'details', tl.details,
            'impact', tl.impact_level,
            'timestamp', tl.created_at
        )
    ) INTO notable_events
    FROM tournament_logs tl
    WHERE tl.tournament_id = tournament_id_param
    AND tl.impact_level IN ('high', 'critical')
    AND tl.created_at > COALESCE(
        (SELECT MAX(timestamp) FROM tournament_state_snapshots 
         WHERE tournament_id = tournament_id_param), 
        '1970-01-01'::TIMESTAMP
    );
    
    -- Create snapshot
    INSERT INTO tournament_state_snapshots (
        tournament_id, snapshot_type, round_number,
        total_teams, active_teams, completed_matches, total_matches,
        current_leaderboard, notable_events
    ) VALUES (
        tournament_id_param,
        snapshot_type_param,
        round_param,
        (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = tournament_id_param),
        (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = tournament_id_param AND is_active = true),
        (SELECT COUNT(*) FROM tournament_matches WHERE tournament_id = tournament_id_param AND status = 'Completed'),
        (SELECT COUNT(*) FROM tournament_matches WHERE tournament_id = tournament_id_param),
        leaderboard_data,
        notable_events
    );
    
    -- Log the snapshot creation
    PERFORM log_tournament_event(
        tournament_id_param,
        'SNAPSHOT_CREATED',
        'system',
        'low',
        'Tournament snapshot created: ' || snapshot_type_param,
        NULL, NULL, round_param,
        NULL, NULL, false, false
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record team performance
CREATE OR REPLACE FUNCTION record_team_performance(
    tournament_id_param UUID,
    team_id_param UUID,
    final_placement INTEGER,
    final_points INTEGER,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
    performance_data JSONB;
    achievements JSONB;
    bracket_path JSONB;
BEGIN
    -- Build performance data
    performance_data := JSONB_BUILD_OBJECT(
        'final_placement', final_placement,
        'final_points', final_points,
        'wins', wins,
        'losses', losses,
        'win_rate', CASE 
            WHEN (wins + losses) > 0 
            THEN ROUND((wins::NUMERIC / (wins + losses)::NUMERIC) * 100, 2)
            ELSE 0
        END,
        'matches_played', wins + losses
    );
    
    -- Determine achievements
    achievements := JSONB_BUILD_OBJECT(
        'first_place', final_placement = 1,
        'top_three', final_placement <= 3,
        'top_eight', final_placement <= 8,
        'perfect_run', wins > 0 AND losses = 0,
        'upset_potential', final_placement < (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = tournament_id_param) / 2
    );
    
    -- Build bracket path
    SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'round', tb.round_number,
            'opponent', CASE 
                WHEN tm.team1_id = team_id_param THEN (SELECT name FROM teams WHERE id = tm.team2_id)
                ELSE (SELECT name FROM teams WHERE id = tm.team1_id)
            END,
            'result', CASE 
                WHEN tm.winner_id = team_id_param THEN 'win'
                ELSE 'loss'
            END,
            'score', JSONB_BUILD_OBJECT(tm.team1_score, tm.team2_score)
        )
    ) INTO bracket_path
    FROM tournament_matches tm
    JOIN tournament_brackets tb ON tm.bracket_id = tb.id
    WHERE tm.tournament_id = tournament_id_param
    AND (tm.team1_id = team_id_param OR tm.team2_id = team_id_param)
    AND tm.status = 'Completed'
    ORDER BY tb.round_number;
    
    -- Insert or update performance record
    INSERT INTO team_tournament_performances (
        tournament_id, team_id, performance_data, achievements, bracket_path
    ) VALUES (
        tournament_id_param, team_id_param, performance_data, achievements, bracket_path
    )
    ON CONFLICT (tournament_id, team_id) DO UPDATE SET 
        performance_data = EXCLUDED.performance_data,
        achievements = EXCLUDED.achievements,
        bracket_path = EXCLUDED.bracket_path,
        updated_at = NOW();
    
    -- Log the performance recording
    PERFORM log_tournament_event(
        tournament_id_param,
        'TEAM_PERFORMANCE_RECORDED',
        'performance',
        'medium',
        'Team performance finalized: ' || final_placement || 'th place',
        team_id_param, NULL, NULL,
        NULL, NULL, true, true
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record tournament milestone
CREATE OR REPLACE FUNCTION record_tournament_milestone(
    tournament_id_param UUID,
    milestone_type_param VARCHAR(50),
    description_param TEXT,
    team_id_param UUID DEFAULT NULL,
    match_id_param UUID DEFAULT NULL,
    significance_param INTEGER DEFAULT 5,
    story_param TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO tournament_milestones (
        tournament_id, milestone_type, description,
        team_id, match_id, significance_score, public_story
    ) VALUES (
        tournament_id_param, milestone_type_param, description_param,
        team_id_param, match_id_param, significance_param, story_param
    );
    
    -- Log the milestone
    PERFORM log_tournament_event(
        tournament_id_param,
        'MILESTONE_ACHIEVED',
        'milestone',
        CASE 
            WHEN significance_param >= 8 THEN 'critical'
            WHEN significance_param >= 5 THEN 'high'
            WHEN significance_param >= 3 THEN 'medium'
            ELSE 'low'
        END,
        description_param,
        team_id_param, match_id_param, NULL,
        NULL, NULL, true, true
    );
END;
$$ LANGUAGE plpgsql;

-- Views for comprehensive analytics

-- Tournament timeline view (complete story)
CREATE VIEW tournament_timeline_view AS
SELECT 
    tl.tournament_id,
    t.name as tournament_name,
    tl.created_at as event_time,
    tl.action as event_type,
    tl.event_category,
    tl.impact_level,
    tl.details,
    tl.public_visible,
    tl.stat_impact,
    team.name as team_name,
    tm.match_number,
    tl.round_number,
    u.email as admin_email,
    u.raw_user_meta_data->>'full_name' as admin_name,
    CASE 
        WHEN tl.impact_level = 'critical' THEN '🔴'
        WHEN tl.impact_level = 'high' THEN '🟠'
        WHEN tl.impact_level = 'medium' THEN '🟡'
        ELSE '⚪'
    END as impact_icon
FROM tournament_logs tl
JOIN tournaments t ON tl.tournament_id = t.id
LEFT JOIN teams team ON tl.team_id = team.id
LEFT JOIN tournament_matches tm ON tl.match_id = tm.id
LEFT JOIN auth.users u ON tl.user_id = u.id
ORDER BY tl.tournament_id, tl.created_at DESC;

-- Team career highlights view
CREATE VIEW team_career_highlights AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(DISTINCT tp.tournament_id) as tournaments_played,
    COUNT(CASE WHEN tperf.achievements->>'first_place' = 'true' THEN 1 END) as tournaments_won,
    COUNT(CASE WHEN tperf.achievements->>'top_three' = 'true' THEN 1 END) as top_three_finishes,
    COUNT(CASE WHEN tperf.achievements->>'perfect_run' = 'true' THEN 1 END) as perfect_runs,
    MAX(CASE WHEN ts.placement = 1 THEN tournament.name END) as latest_win,
    STRING_AGG(DISTINCT 
        CASE 
            WHEN ts.placement = 1 THEN '🏆 ' || tournament.name
            WHEN ts.placement <= 3 THEN '🥈 ' || tournament.name
            WHEN ts.placement <= 8 THEN '🥉 ' || tournament.name
        END, ', '
    ) FILTER (WHERE ts.placement IS NOT NULL) as achievements_summary,
    JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'tournament', tournament.name,
            'placement', ts.placement,
            'achievements', tperf.achievements,
            'performance', tperf.performance_data
        )
    ) as full_history
FROM teams t
LEFT JOIN tournament_participants tp ON t.id = tp.team_id
LEFT JOIN team_tournament_performances tperf ON t.id = tperf.team_id AND tp.tournament_id = tperf.tournament_id
LEFT JOIN tournament_standings ts ON t.id = ts.team_id AND tp.tournament_id = ts.tournament_id
LEFT JOIN tournaments tournament ON tp.tournament_id = tournament.id
GROUP BY t.id, t.name
ORDER BY tournaments_won DESC, top_three_finishes DESC;

-- Tournament milestones dashboard
CREATE VIEW tournament_milestones_dashboard AS
SELECT 
    m.*,
    t.name as tournament_name,
    team.name as team_name,
    tm_match.match_number,
    tb.round_number as match_round_number,
    CASE 
        WHEN m.significance_score >= 8 THEN '🏆 Legendary'
        WHEN m.significance_score >= 5 THEN '⭐ Epic'
        WHEN m.significance_score >= 3 THEN '🎯 Great'
        ELSE '📝 Notable'
    END as significance_level
FROM tournament_milestones m
JOIN tournaments t ON m.tournament_id = t.id
LEFT JOIN teams team ON m.team_id = team.id
LEFT JOIN tournament_matches tm_match ON m.match_id = tm_match.id
LEFT JOIN tournament_brackets tb ON tm_match.bracket_id = tb.id
ORDER BY m.significance_score DESC, m.created_at DESC;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournament_logs_category ON tournament_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_impact ON tournament_logs(impact_level);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_team ON tournament_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_match ON tournament_logs(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_public ON tournament_logs(public_visible);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_stats ON tournament_logs(stat_impact);

CREATE INDEX IF NOT EXISTS idx_tournament_state_snapshots_type ON tournament_state_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_tournament_state_snapshots_timestamp ON tournament_state_snapshots(timestamp);

CREATE INDEX IF NOT EXISTS idx_team_tournament_performances_achievements ON team_tournament_performances USING GIN(achievements);
CREATE INDEX IF NOT EXISTS idx_team_tournament_performances_tournament ON team_tournament_performances(tournament_id, team_id);

CREATE INDEX IF NOT EXISTS idx_tournament_milestones_type ON tournament_milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_tournament_milestones_significance ON tournament_milestones(significance_score);
CREATE INDEX IF NOT EXISTS idx_tournament_milestones_team ON tournament_milestones(team_id);

-- RLS for new tables
ALTER TABLE tournament_state_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_tournament_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_match_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_tournament_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view tournament snapshots" ON tournament_state_snapshots
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage snapshots" ON tournament_state_snapshots
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_state_snapshots.tournament_id
        )
    );

CREATE POLICY "Anyone can view team performances" ON team_tournament_performances
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage performances" ON team_tournament_performances
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = team_tournament_performances.tournament_id
        )
    );

CREATE POLICY "Anyone can view match details" ON tournament_match_details
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage match details" ON tournament_match_details
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = tournament_match_details.match_id)
        )
    );

CREATE POLICY "Anyone can view milestones" ON tournament_milestones
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage milestones" ON tournament_milestones
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_milestones.tournament_id
        )
    );
