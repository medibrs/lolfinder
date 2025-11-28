# Team Tournament Performances Table

## 📋 Overview
The `team_tournament_performances` table stores comprehensive performance data for teams in each tournament. It captures achievements, statistics, bracket progression, and career-defining moments that form the foundation of team bragging rights and historical records.

## 🏗️ Table Structure

### **Core Fields**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
tournament_id UUID NOT NULL
team_id UUID NOT NULL
performance_data JSONB NOT NULL -- Detailed performance metrics
achievements JSONB -- Notable achievements (perfect run, upset victory, etc.)
statistics JSONB -- Win rates, average game duration, etc.
milestones JSONB -- First tournament win, best placement, etc.
bracket_path JSONB -- Complete journey through bracket
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Constraints**
```sql
UNIQUE(tournament_id, team_id)
FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
```

## 🔗 Relationships

### **Belongs To**
- `tournaments` - The tournament of the performance
- `teams` - The team whose performance is recorded

### **Indirect Relationships**
- `tournament_participants` - Registration and seeding info
- `tournament_matches` - Individual match results
- `tournament_standings` - Final placement and points
- `tournament_milestones` - Notable moments achieved

## 🎯 Performance Data Structure

### **Core Performance Metrics**
```json
{
  "final_placement": 1,
  "final_points": 100,
  "wins": 6,
  "losses": 1,
  "win_rate": 85.71,
  "matches_played": 7,
  "games_played": 15,
  "games_won": 12,
  "games_lost": 3,
  "average_game_duration": 1845,
  "total_eliminations": 245,
  "total_deaths": 156,
  "total_assists": 487,
  "average_kda": 4.73
}
```

### **Achievement Tracking**
```json
{
  "first_place": true,
  "top_three": true,
  "top_eight": true,
  "perfect_run": false,
  "upset_potential": false,
  "undefeated_run": 3,
  "comeback_victories": 2,
  "dominant_victories": 4,
  "close_matches": 1,
  "sweep_victories": 2
}
```

### **Statistical Analysis**
```json
{
  "average_game_time": "30:45",
  "fastest_victory": "22:15",
  "longest_match": "45:32",
  "average_gold_lead": 5432,
  "average_cs_difference": 23.5,
  "objective_control_rate": 78.5,
  "first_blood_rate": 71.4,
  "dragon_control_rate": 85.7,
  "baron_control_rate": 57.1,
  "tower_take_rate": 82.4
}
```

### **Bracket Journey**
```json
[
  {
    "round": 1,
    "opponent": "Team Beta",
    "result": "win",
    "score": "2-1",
    "game_scores": [1, 0, 1],
    "duration": "68:45",
    "was_upset": false,
    "was_comeback": false
  },
  {
    "round": 2,
    "opponent": "Team Gamma",
    "result": "win", 
    "score": "2-0",
    "game_scores": [1, 1],
    "duration": "52:12",
    "was_upset": true,
    "was_comeback": false
  },
  {
    "round": 3,
    "opponent": "Team Delta",
    "result": "win",
    "score": "3-2",
    "game_scores": [1, 0, 0, 1, 1],
    "duration": "145:23",
    "was_upset": false,
    "was_comeback": true
  }
]
```

## 🎯 Usage Patterns

### **Basic Performance Recording**
```sql
INSERT INTO team_tournament_performances (
    tournament_id, team_id, performance_data, achievements, bracket_path
) VALUES (
    tournament_uuid, team_uuid,
    '{
      "final_placement": 1,
      "final_points": 100,
      "wins": 6,
      "losses": 1,
      "win_rate": 85.71,
      "matches_played": 7
    }',
    '{
      "first_place": true,
      "top_three": true,
      "perfect_run": false,
      "undefeated_run": 3
    }',
    '[
      {"round": 1, "opponent": "Team Beta", "result": "win", "score": "2-1"},
      {"round": 2, "opponent": "Team Gamma", "result": "win", "score": "2-0"},
      {"round": 3, "opponent": "Team Delta", "result": "win", "score": "3-2"}
    ]'
);
```

### **Performance Update Function**
```sql
CREATE OR REPLACE FUNCTION record_team_performance(
    tournament_id UUID, team_id UUID, final_placement INTEGER,
    final_points INTEGER, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    performance_data JSONB;
    achievements JSONB;
    bracket_path JSONB;
    total_teams INTEGER;
BEGIN
    -- Get total teams for upset potential calculation
    SELECT COUNT(*) INTO total_teams
    FROM tournament_participants
    WHERE tournament_id = tournament_id;
    
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
        'upset_potential', final_placement < total_teams / 2,
        'undefeated_run', CASE 
            WHEN wins > 0 AND losses = 0 THEN wins
            ELSE 0
        END
    );
    
    -- Build bracket path
    SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'round', tb.round_number,
            'opponent', CASE 
                WHEN tm.team1_id = team_id THEN (SELECT name FROM teams WHERE id = tm.team2_id)
                ELSE (SELECT name FROM teams WHERE id = tm.team1_id)
            END,
            'result', CASE 
                WHEN tm.winner_id = team_id THEN 'win'
                ELSE 'loss'
            END,
            'score', JSONB_BUILD_OBJECT(tm.team1_score, tm.team2_score),
            'best_of', tm.best_of
        )
    ) INTO bracket_path
    FROM tournament_matches tm
    JOIN tournament_brackets tb ON tm.bracket_id = tb.id
    WHERE tm.tournament_id = tournament_id
    AND (tm.team1_id = team_id OR tm.team2_id = team_id)
    AND tm.status = 'Completed'
    ORDER BY tb.round_number;
    
    -- Insert or update performance record
    INSERT INTO team_tournament_performances (
        tournament_id, team_id, performance_data, achievements, bracket_path
    ) VALUES (
        tournament_id, team_id, performance_data, achievements, bracket_path
    )
    ON CONFLICT (tournament_id, team_id) DO UPDATE SET 
        performance_data = EXCLUDED.performance_data,
        achievements = EXCLUDED.achievements,
        bracket_path = EXCLUDED.bracket_path,
        updated_at = NOW();
    
    -- Log the performance recording
    INSERT INTO tournament_logs (
        tournament_id, action, details, team_id, user_id
    ) VALUES (
        tournament_id, 'TEAM_PERFORMANCE_RECORDED',
        'Team performance finalized: ' || final_placement || 'th place',
        team_id, auth.uid()
    );
END;
$$ LANGUAGE plpgsql;
```

## 📈 Performance Analytics

### **Team Career Statistics**
```sql
-- Complete team performance history
SELECT 
    t.name as team_name,
    COUNT(DISTINCT tperf.tournament_id) as tournaments_played,
    COUNT(CASE WHEN tperf.achievements->>'first_place' = 'true' THEN 1 END) as tournaments_won,
    COUNT(CASE WHEN tperf.achievements->>'top_three' = 'true' THEN 1 END) as top_three_finishes,
    COUNT(CASE WHEN tperf.achievements->>'perfect_run' = 'true' THEN 1 END) as perfect_runs,
    SUM((tperf.performance_data->>'wins')::INTEGER) as total_wins,
    SUM((tperf.performance_data->>'losses')::INTEGER) as total_losses,
    ROUND(AVG((tperf.performance_data->>'win_rate')::NUMERIC), 2) as average_win_rate,
    MIN((tperf.performance_data->>'final_placement')::INTEGER) as best_placement,
    MAX(CASE WHEN ts.placement = 1 THEN tournament.name END) as latest_win,
    STRING_AGG(DISTINCT 
        CASE 
            WHEN ts.placement = 1 THEN '🏆 ' || tournament.name
            WHEN ts.placement <= 3 THEN '🥈 ' || tournament.name
            WHEN ts.placement <= 8 THEN '🥉 ' || tournament.name
        END, ', '
    ) FILTER (WHERE ts.placement IS NOT NULL) as achievements_summary
FROM teams t
LEFT JOIN team_tournament_performances tperf ON t.id = tperf.team_id
LEFT JOIN tournament_standings ts ON t.id = ts.team_id AND tperf.tournament_id = ts.tournament_id
LEFT JOIN tournaments tournament ON tperf.tournament_id = tournament.id
GROUP BY t.id, t.name
ORDER BY tournaments_won DESC, top_three_finishes DESC;
```

### **Performance Comparison**
```sql
-- Compare two teams' head-to-head tournament history
SELECT 
    'Team 1' as team_label,
    t1.name as team_name,
    COUNT(tperf1.tournament_id) as tournaments_played,
    COUNT(CASE WHEN tperf1.achievements->>'first_place' = 'true' THEN 1 END) as wins,
    ROUND(AVG((tperf1.performance_data->>'win_rate')::NUMERIC), 2) as avg_win_rate
FROM teams t1
JOIN team_tournament_performances tperf1 ON t1.id = tperf1.team_id
WHERE t1.id = team1_uuid
GROUP BY t1.name

UNION ALL

SELECT 
    'Team 2' as team_label,
    t2.name as team_name,
    COUNT(tperf2.tournament_id) as tournaments_played,
    COUNT(CASE WHEN tperf2.achievements->>'first_place' = 'true' THEN 1 END) as wins,
    ROUND(AVG((tperf2.performance_data->>'win_rate')::NUMERIC), 2) as avg_win_rate
FROM teams t2
JOIN team_tournament_performances tperf2 ON t2.id = tperf2.team_id
WHERE t2.id = team2_uuid
GROUP BY t2.name;
```

### **Achievement Rarity Analysis**
```sql
-- How rare are different achievements
SELECT 
    'First Place' as achievement,
    COUNT(CASE WHEN achievements->>'first_place' = 'true' THEN 1 END) as count,
    ROUND(COUNT(CASE WHEN achievements->>'first_place' = 'true' THEN 1 END) * 100.0 / COUNT(*), 2) as percentage
FROM team_tournament_performances

UNION ALL

SELECT 
    'Perfect Run' as achievement,
    COUNT(CASE WHEN achievements->>'perfect_run' = 'true' THEN 1 END) as count,
    ROUND(COUNT(CASE WHEN achievements->>'perfect_run' = 'true' THEN 1 END) * 100.0 / COUNT(*), 2) as percentage
FROM team_tournament_performances

UNION ALL

SELECT 
    'Top Three' as achievement,
    COUNT(CASE WHEN achievements->>'top_three' = 'true' THEN 1 END) as count,
    ROUND(COUNT(CASE WHEN achievements->>'top_three' = 'true' THEN 1 END) * 100.0 / COUNT(*), 2) as percentage
FROM team_tournament_performances;
```

## 🎯 Advanced Performance Metrics

### **Performance Trend Analysis**
```sql
-- Track team performance over time
SELECT 
    t.name as tournament_name,
    t.start_date,
    (tperf.performance_data->>'final_placement')::INTEGER as placement,
    (tperf.performance_data->>'win_rate')::NUMERIC as win_rate,
    (tperf.performance_data->>'wins')::INTEGER as wins,
    (tperf.performance_data->>'losses')::INTEGER as losses,
    CASE 
        WHEN tperf.achievements->>'first_place' = 'true' THEN '🏆'
        WHEN tperf.achievements->>'top_three' = 'true' THEN '🥈'
        WHEN tperf.achievements->>'top_eight' = 'true' THEN '🥉'
        ELSE '📝'
    END as achievement_icon
FROM team_tournament_performances tperf
JOIN tournaments t ON tperf.tournament_id = t.id
WHERE tperf.team_id = team_uuid
ORDER BY t.start_date DESC;
```

### **Bracket Path Analysis**
```sql
-- Analyze team's journey through brackets
SELECT 
    tournament_name,
    bracket_element->>'round' as round_number,
    bracket_element->>'opponent' as opponent,
    bracket_element->>'result' as result,
    bracket_element->>'score' as score,
    (bracket_element->>'best_of')::INTEGER as best_of
FROM (
    SELECT 
        t.name as tournament_name,
        jsonb_array_elements(tperf.bracket_path) as bracket_element
    FROM team_tournament_performances tperf
    JOIN tournaments t ON tperf.tournament_id = t.id
    WHERE tperf.team_id = team_uuid
) bracket_analysis
ORDER BY tournament_name, (bracket_element->>'round')::INTEGER;
```

## 🛡️ Data Integrity

### **Validation Rules**
- Performance data must include placement and basic stats
- Achievement flags must be boolean values
- Bracket path must be valid JSON array
- Win rate must be calculated correctly from wins/losses

### **Consistency Checks**
```sql
-- Find performance records with inconsistent data
SELECT 
    id,
    CASE 
        WHEN performance_data->>'final_placement' IS NULL THEN 'Missing placement'
        WHEN performance_data->>'wins' IS NULL THEN 'Missing wins'
        WHEN performance_data->>'losses' IS NULL THEN 'Missing losses'
        WHEN (performance_data->>'win_rate')::NUMERIC < 0 OR (performance_data->>'win_rate')::NUMERIC > 100 THEN 'Invalid win rate'
        WHEN jsonb_typeof(bracket_path) != 'array' THEN 'Invalid bracket path'
    END as issue
FROM team_tournament_performances
WHERE performance_data->>'final_placement' IS NULL
OR performance_data->>'wins' IS NULL
OR performance_data->>'losses' IS NULL
OR (performance_data->>'win_rate')::NUMERIC < 0 
OR (performance_data->>'win_rate')::NUMERIC > 100
OR jsonb_typeof(bracket_path) != 'array';
```

## 📝 Best Practices

### **Performance Recording**
1. Record performance immediately after tournament completion
2. Include comprehensive statistics and context
3. Calculate achievements automatically
4. Build complete bracket journey
5. Validate data consistency

### **Achievement Tracking**
1. Use standardized achievement criteria
2. Track both positive and notable negative achievements
3. Include streak and momentum metrics
4. Consider tournament significance
5. Update achievements as tournament progresses

### **Data Analysis**
1. Use JSONB for flexible performance metrics
2. Index key performance fields for queries
3. Calculate derived statistics on the fly
4. Maintain historical consistency
5. Provide multiple analysis perspectives

## 🔄 Migration Notes

### **Version History**
- **v1.0**: Basic performance metrics and placement tracking
- **v2.0**: Added achievements and statistics JSONB fields
- **v3.0**: Enhanced with bracket path and milestone tracking
- **v4.0**: Advanced analytics and trend analysis capabilities

### **Backward Compatibility**
- Existing performance records continue to work
- New JSONB fields are optional and have defaults
- Enhanced features build on existing structure

This table serves as the definitive record of team tournament performances, providing the data foundation for bragging rights, historical analysis, and career tracking in competitive gaming.
