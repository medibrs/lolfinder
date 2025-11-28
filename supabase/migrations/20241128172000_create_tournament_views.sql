-- Tournament Views for Easy Data Retrieval
-- Run this in your Supabase SQL editor

-- Tournament Details View (with participant count and status)
CREATE VIEW tournament_details AS
SELECT 
    t.*,
    COUNT(tp.id) as participant_count,
    COUNT(CASE WHEN tp.is_active = true THEN 1 END) as active_participants,
    COUNT(tm.id) as total_matches,
    COUNT(CASE WHEN tm.status = 'Completed' THEN 1 END) as completed_matches,
    CASE 
        WHEN t.status = 'Registration' AND NOW() > t.registration_deadline THEN 'Registration_Closed'
        WHEN t.status = 'Registration' AND COUNT(tp.id) >= t.max_teams THEN 'Registration_Closed'
        ELSE t.status
    END as effective_status,
    ta.user_id as created_by
FROM tournaments t
LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
LEFT JOIN tournament_matches tm ON t.id = tm.tournament_id
LEFT JOIN tournament_admins ta ON t.id = ta.tournament_id AND ta.role = 'admin'
GROUP BY t.id, ta.user_id;

-- Tournament Bracket View (complete bracket with matches)
CREATE VIEW tournament_bracket_view AS
SELECT 
    t.id as tournament_id,
    t.name as tournament_name,
    t.status as tournament_status,
    tb.round_number,
    tb.bracket_position,
    tb.is_final,
    tb.is_third_place,
    tm.id as match_id,
    tm.match_number,
    tm.team1_id,
    tm.team2_id,
    tm.winner_id,
    tm.status as match_status,
    tm.result,
    tm.scheduled_at,
    tm.started_at,
    tm.completed_at,
    tm.best_of,
    tm.team1_score,
    tm.team2_score,
    t1.name as team1_name,
    t2.name as team2_name,
    tw.name as winner_name,
    t1.captain_id as team1_captain_id,
    t2.captain_id as team2_captain_id,
    tw.captain_id as winner_captain_id,
    -- Calculate match progress
    CASE 
        WHEN tm.status = 'Completed' THEN 100
        WHEN tm.status = 'In_Progress' THEN 50
        WHEN tm.status = 'Scheduled' AND tm.scheduled_at <= NOW() THEN 25
        ELSE 0
    END as progress_percentage
FROM tournaments t
LEFT JOIN tournament_brackets tb ON t.id = tb.tournament_id
LEFT JOIN tournament_matches tm ON tb.id = tm.bracket_id
LEFT JOIN teams t1 ON tm.team1_id = t1.id
LEFT JOIN teams t2 ON tm.team2_id = t2.id
LEFT JOIN teams tw ON tm.winner_id = tw.id
ORDER BY t.id, tb.round_number, tb.bracket_position;

-- Tournament Participants View (with seed and team info)
CREATE VIEW tournament_participants_view AS
SELECT 
    tp.*,
    t.name as team_name,
    t.description as team_description,
    t.captain_id as team_captain_id,
    captain.summoner_name as captain_name,
    -- Calculate team stats
    COUNT(tm.id) as matches_played,
    COUNT(CASE WHEN tm.winner_id = tp.team_id THEN 1 END) as matches_won,
    COUNT(CASE WHEN tm.status = 'Completed' AND tm.winner_id != tp.team_id THEN 1 END) as matches_lost,
    -- Get current standing
    ts.placement as current_placement,
    ts.points as current_points,
    ts.prize_awarded
FROM tournament_participants tp
JOIN teams t ON tp.team_id = t.id
LEFT JOIN players captain ON t.captain_id = captain.id
LEFT JOIN tournament_matches tm ON (tm.team1_id = tp.team_id OR tm.team2_id = tp.team_id) AND tm.status = 'Completed'
LEFT JOIN tournament_standings ts ON tp.tournament_id = ts.tournament_id AND tp.team_id = ts.team_id
GROUP BY tp.id, t.id, captain.id, ts.placement, ts.points, ts.prize_awarded
ORDER BY tp.tournament_id, tp.seed_number;

-- Tournament Standings View (with rank calculations)
CREATE VIEW tournament_standings_view AS
SELECT 
    ts.*,
    t.name as team_name,
    t.captain_id,
    captain.summoner_name as captain_name,
    tournament.name as tournament_name,
    tournament.format as tournament_format,
    -- Calculate win rate
    CASE 
        WHEN (ts.wins + ts.losses) > 0 
        THEN ROUND((ts.wins::NUMERIC / (ts.wins + ts.losses)::NUMERIC) * 100, 2)
        ELSE 0
    END as win_rate_percentage,
    -- Rank within tournament
    RANK() OVER (PARTITION BY ts.tournament_id ORDER BY ts.placement ASC) as rank_in_tournament
FROM tournament_standings ts
JOIN teams t ON ts.team_id = t.id
LEFT JOIN players captain ON t.captain_id = captain.id
JOIN tournaments tournament ON ts.tournament_id = tournament.id
ORDER BY ts.tournament_id, ts.placement;

-- Upcoming Matches View (for dashboard)
CREATE VIEW upcoming_matches_view AS
SELECT 
    tm.id,
    tm.scheduled_at,
    tm.best_of,
    t.name as tournament_name,
    t1.name as team1_name,
    t2.name as team2_name,
    tb.round_number,
    tb.is_final,
    CASE 
        WHEN tb.is_final THEN 'Final'
        WHEN tb.is_third_place THEN '3rd Place Match'
        ELSE 'Round ' || tb.round_number
    END as match_stage,
    -- Time until match
    EXTRACT(EPOCH FROM (tm.scheduled_at - NOW())) / 3600 as hours_until_match
FROM tournament_matches tm
JOIN tournaments t ON tm.tournament_id = t.id
JOIN tournament_brackets tb ON tm.bracket_id = tb.id
LEFT JOIN teams t1 ON tm.team1_id = t1.id
LEFT JOIN teams t2 ON tm.team2_id = t2.id
WHERE tm.status = 'Scheduled'
AND tm.scheduled_at > NOW()
AND t.status IN ('In_Progress', 'Seeding')
ORDER BY tm.scheduled_at ASC;

-- Tournament Admin View (with user info)
CREATE VIEW tournament_admins_view AS
SELECT 
    ta.*,
    u.email as admin_email,
    u.raw_user_meta_data->>'full_name' as admin_full_name,
    t.name as tournament_name,
    t.status as tournament_status
FROM tournament_admins ta
JOIN auth.users u ON ta.user_id = u.id
JOIN tournaments t ON ta.tournament_id = t.id
ORDER BY t.name, ta.role;

-- Tournament Activity Log View (enhanced)
CREATE VIEW tournament_activity_view AS
SELECT 
    tl.*,
    t.name as tournament_name,
    u.email as user_email,
    u.raw_user_meta_data->>'full_name' as user_full_name,
    CASE 
        WHEN tl.action = 'TOURNAMENT_CREATED' THEN '🏆'
        WHEN tl.action = 'BRACKET_GENERATED' THEN '📊'
        WHEN tl.action = 'MATCH_COMPLETED' THEN '✅'
        WHEN tl.action = 'TEAMS_SEEDED' THEN '🎲'
        ELSE '📝'
    END as action_icon
FROM tournament_logs tl
JOIN tournaments t ON tl.tournament_id = t.id
LEFT JOIN auth.users u ON tl.user_id = u.id
ORDER BY tl.created_at DESC;

-- Team Tournament History View
CREATE VIEW team_tournament_history AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    tour.id as tournament_id,
    tour.name as tournament_name,
    tour.format as tournament_format,
    tour.start_date,
    tour.end_date,
    tp.seed_number,
    ts.placement as final_placement,
    ts.points as points_earned,
    ts.prize_awarded,
    CASE 
        WHEN ts.placement = 1 THEN '🥇'
        WHEN ts.placement = 2 THEN '🥈'
        WHEN ts.placement = 3 THEN '🥉'
        WHEN ts.placement <= 8 THEN '🏆'
        ELSE '📊'
    END as achievement_icon
FROM teams t
JOIN tournament_participants tp ON t.id = tp.team_id
JOIN tournaments tour ON tp.tournament_id = tour.id
LEFT JOIN tournament_standings ts ON t.id = ts.team_id AND tour.id = ts.tournament_id
WHERE tour.status = 'Completed'
ORDER BY tour.start_date DESC, ts.placement ASC;

-- Player Tournament Statistics View
CREATE VIEW player_tournament_stats AS
SELECT 
    p.id as player_id,
    p.summoner_name,
    t.id as team_id,
    t.name as team_name,
    COUNT(tour.id) as tournaments_played,
    COUNT(CASE WHEN ts.placement = 1 THEN 1 END) as tournaments_won,
    COUNT(CASE WHEN ts.placement <= 3 THEN 1 END) as top_3_finishes,
    COUNT(CASE WHEN ts.placement <= 8 THEN 1 END) as top_8_finishes,
    AVG(ts.placement) as avg_placement,
    SUM(ts.points) as total_points_earned,
    MAX(tour.start_date) as last_tournament_date
FROM players p
JOIN teams t ON p.team_id = t.id OR (SELECT COUNT(*) FROM tournament_participants tp WHERE tp.team_id = t.id) > 0
JOIN tournament_participants tp ON t.id = tp.team_id
JOIN tournaments tour ON tp.tournament_id = tour.id
LEFT JOIN tournament_standings ts ON t.id = ts.team_id AND tour.id = ts.tournament_id
WHERE tour.status = 'Completed'
GROUP BY p.id, t.id, t.name
ORDER BY tournaments_played DESC, avg_placement ASC;
