# Tournament Matches Table

## 📋 Overview
The `tournament_matches` table stores individual match data within tournament brackets. It tracks teams, results, timing, scoring, and match progression throughout the tournament.

## 🏗️ Table Structure

### **Core Fields**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
bracket_id UUID NOT NULL
tournament_id UUID NOT NULL
team1_id UUID
team2_id UUID
winner_id UUID
status match_status_type DEFAULT 'Scheduled'
result match_result_type
scheduled_at TIMESTAMP WITH TIME ZONE
started_at TIMESTAMP WITH TIME ZONE
completed_at TIMESTAMP WITH TIME ZONE
match_number INTEGER NOT NULL -- Order within the round
best_of INTEGER DEFAULT 1 -- Best of 1, 3, 5, etc.
team1_score INTEGER DEFAULT 0
team2_score INTEGER DEFAULT 0
match_room TEXT -- Custom game room info
stream_url TEXT
notes TEXT
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Constraints**
```sql
FOREIGN KEY (bracket_id) REFERENCES tournament_brackets(id) ON DELETE CASCADE
FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE SET NULL
FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE SET NULL
FOREIGN KEY (winner_id) REFERENCES teams(id) ON DELETE SET NULL
CHECK (team1_id IS NULL OR team2_id IS NULL OR team1_id != team2_id)
CHECK (status != 'Completed' OR winner_id IS NOT NULL)
CHECK (team1_score >= 0 AND team2_score >= 0)
```

## 📊 Enums

### **match_status_type**
```sql
'Scheduled' → 'In_Progress' → 'Completed' / 'Cancelled'
```

### **match_result_type**
```sql
'Team1_Win', 'Team2_Win', 'Draw', 'No_Show'
```

## 🔗 Relationships

### **Belongs To**
- `tournament_brackets` - The bracket position this match occupies
- `tournaments` - The tournament this match belongs to

### **References**
- `teams` (team1_id) - First team in match
- `teams` (team2_id) - Second team in match
- `teams` (winner_id) - Winning team

### **Has Many**
- `tournament_match_games` - Individual games within this match (for BO3/BO5)

## 🎯 Usage Patterns

### **Creating a Match**
```sql
INSERT INTO tournament_matches (
    bracket_id, tournament_id, team1_id, team2_id,
    match_number, scheduled_at, best_of, status
) VALUES (
    bracket_uuid, tournament_uuid, team1_uuid, team2_uuid,
    1, '2024-06-01 14:00:00', 3, 'Scheduled'
);
```

### **Starting a Match**
```sql
UPDATE tournament_matches
SET status = 'In_Progress', started_at = NOW()
WHERE id = match_uuid;
```

### **Completing a Match**
```sql
UPDATE tournament_matches
SET 
    status = 'Completed',
    winner_id = team1_uuid,
    result = 'Team1_Win',
    team1_score = 2,
    team2_score = 1,
    completed_at = NOW()
WHERE id = match_uuid;
```

### **Best of Series (BO3/BO5)**
```sql
-- BO3 Match
INSERT INTO tournament_matches (
    bracket_id, tournament_id, team1_id, team2_id,
    match_number, scheduled_at, best_of
) VALUES (
    bracket_uuid, tournament_uuid, team1_uuid, team2_uuid,
    1, '2024-06-01 14:00:00', 3
);

-- Record individual games
INSERT INTO tournament_match_games (
    match_id, game_number, winner_id, duration
) VALUES
(match_uuid, 1, team1_uuid, 1845), -- Game 1: 30:45
(match_uuid, 2, team2_uuid, 2156), -- Game 2: 35:56
(match_uuid, 3, team1_uuid, 1923); -- Game 3: 32:03
```

## 🔄 Match Lifecycle

### **1. Scheduled**
```sql
-- Initial state
status = 'Scheduled'
scheduled_at = future_timestamp
started_at = NULL
completed_at = NULL
winner_id = NULL
```

### **2. In Progress**
```sql
-- Match starts
status = 'In_Progress'
started_at = NOW()
```

### **3. Completed**
```sql
-- Match finishes
status = 'Completed'
completed_at = NOW()
winner_id = determined
team1_score = final_score
team2_score = final_score
```

## 📈 Match Management Functions

### **Update Match Result**
```sql
CREATE OR REPLACE FUNCTION update_match_result(
    match_id UUID, winner_id UUID, result match_result_type,
    team1_score INTEGER DEFAULT NULL, team2_score INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tournament_matches
    SET 
        winner_id = winner_id,
        result = result,
        team1_score = COALESCE(team1_score, team1_score),
        team2_score = COALESCE(team2_score, team2_score),
        status = 'Completed',
        completed_at = NOW()
    WHERE id = match_id;
    
    -- Auto-advance winner to next round
    PERFORM advance_winner_to_next_round(match_id, winner_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### **Reschedule Match**
```sql
CREATE OR REPLACE FUNCTION reschedule_match(
    match_id UUID, new_time TIMESTAMP WITH TIME ZONE, reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tournament_matches
    SET scheduled_at = new_time
    WHERE id = match_id;
    
    -- Log the reschedule
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        (SELECT tournament_id FROM tournament_matches WHERE id = match_id),
        'MATCH_RESCHEDULED',
        'Match rescheduled: ' || reason,
        auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

## 📊 Match Analytics

### **Match Duration Analysis**
```sql
-- Average match duration by tournament
SELECT 
    t.name as tournament_name,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) as avg_duration_minutes,
    COUNT(*) as total_matches,
    COUNT(CASE WHEN best_of > 1 THEN 1 END) as bo3_bo5_matches
FROM tournament_matches tm
JOIN tournaments t ON tm.tournament_id = t.id
WHERE tm.status = 'Completed'
AND tm.started_at IS NOT NULL
AND tm.completed_at IS NOT NULL
GROUP BY t.name;
```

### **Upcoming Matches Dashboard**
```sql
-- Next 24 hours of matches
SELECT 
    tm.id,
    tm.scheduled_at,
    t.name as tournament_name,
    t1.name as team1_name,
    t2.name as team2_name,
    tb.round_number,
    tm.best_of,
    EXTRACT(EPOCH FROM (tm.scheduled_at - NOW()))/3600 as hours_until_match
FROM tournament_matches tm
JOIN tournaments t ON tm.tournament_id = t.id
JOIN tournament_brackets tb ON tm.bracket_id = tb.id
LEFT JOIN teams t1 ON tm.team1_id = t1.id
LEFT JOIN teams t2 ON tm.team2_id = t2.id
WHERE tm.status = 'Scheduled'
AND tm.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
ORDER BY tm.scheduled_at;
```

### **Team Match History**
```sql
-- Complete match history for a team
SELECT 
    tm.id,
    tm.scheduled_at,
    t.name as tournament_name,
    CASE 
        WHEN tm.team1_id = $team_id THEN t2.name
        ELSE t1.name
    END as opponent,
    tm.result,
    CASE 
        WHEN tm.winner_id = $team_id THEN 'Win'
        WHEN tm.status = 'Completed' THEN 'Loss'
        ELSE 'Pending'
    END as outcome,
    tm.team1_score,
    tm.team2_score,
    tm.best_of
FROM tournament_matches tm
JOIN tournaments t ON tm.tournament_id = t.id
JOIN tournament_brackets tb ON tm.bracket_id = tb.id
LEFT JOIN teams t1 ON tm.team1_id = t1.id
LEFT JOIN teams t2 ON tm.team2_id = t2.id
WHERE (tm.team1_id = $team_id OR tm.team2_id = $team_id)
ORDER BY tm.scheduled_at DESC;
```

## 🎯 Special Match Types

### **No Show Handling**
```sql
-- Handle team no-show
UPDATE tournament_matches
SET 
    status = 'Completed',
    result = CASE 
        WHEN team1_id IS NULL THEN 'Team2_Win'
        WHEN team2_id IS NULL THEN 'Team1_Win'
        ELSE 'No_Show'
    END,
    winner_id = COALESCE(team1_id, team2_id),
    completed_at = NOW(),
    notes = 'Match awarded by forfeit (no-show)'
WHERE id = match_id;
```

### **Third Place Match**
```sql
-- Special third place match setup
INSERT INTO tournament_matches (
    bracket_id, tournament_id, team1_id, team2_id,
    match_number, scheduled_at, best_of
) SELECT 
    tb.id, tb.tournament_id, 
    -- Losers of semifinals become teams in third place match
    (SELECT loser FROM semifinal1),
    (SELECT loser FROM semifinal2),
    1, NOW() + INTERVAL '1 hour', 1
FROM tournament_brackets tb
WHERE tb.is_third_place = true;
```

## 🛡️ Data Integrity

### **Validation Rules**
- Team IDs must be valid teams
- Winner must be one of the participants
- Scores must be non-negative
- Completed matches must have winner
- Best of series must be odd numbers (1, 3, 5, 7)

### **Consistency Checks**
```sql
-- Find matches with invalid data
SELECT 
    id,
    CASE 
        WHEN team1_id = team2_id THEN 'Same team vs itself'
        WHEN winner_id NOT IN (team1_id, team2_id) THEN 'Winner not participant'
        WHEN status = 'Completed' AND winner_id IS NULL THEN 'Completed without winner'
        WHEN team1_score < 0 OR team2_score < 0 THEN 'Negative score'
    END as issue
FROM tournament_matches
WHERE status = 'Completed'
AND (
    team1_id = team2_id
    OR winner_id NOT IN (team1_id, team2_id)
    OR winner_id IS NULL
    OR team1_score < 0 OR team2_score < 0
);
```

## 📝 Best Practices

### **Match Scheduling**
1. Allow adequate time between matches
2. Consider time zones for international tournaments
3. Build in buffer time for overruns
4. Schedule higher-stakes matches for prime times

### **Score Tracking**
1. Use consistent scoring systems
2. Validate scores against best_of format
3. Record individual games for series matches
4. Track match duration analytics

### **Result Management**
1. Always validate winner is a participant
2. Log all result changes for audit trail
3. Auto-advance winners to next round
4. Handle edge cases (no-shows, disputes)

## 🔄 Migration Notes

### **Version History**
- **v1.0**: Basic match structure and results
- **v2.0**: Added best of series support
- **v3.0**: Enhanced timing and streaming fields
- **v4.0**: Added match room and notes functionality

### **Backward Compatibility**
- All new fields have sensible defaults
- Existing matches continue to work
- Enhanced features are optional

This table is the workhorse of tournament management, tracking every individual contest from scheduling to completion, with rich data for analytics and historical records.
