# Tournament Participants Table

## 📋 Overview
The `tournament_participants` table manages team registration for tournaments. It tracks which teams are participating, their seeding, status, and tournament-specific data like Swiss scores and opponent history.

## 🏗️ Table Structure

### **Core Fields**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
tournament_id UUID NOT NULL
team_id UUID NOT NULL
seed_number INTEGER
registration_data TEXT -- JSON string for additional registration info
is_active BOOLEAN DEFAULT true
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Swiss-Specific Fields**
```sql
swiss_score INTEGER DEFAULT 0 -- Total tournament points
tiebreaker_points DECIMAL(10,2) DEFAULT 0 -- Buchholz tiebreaker score
buchholz_score DECIMAL(10,2) DEFAULT 0 -- Sum of opponents' scores
dropped_out_at TIMESTAMP WITH TIME ZONE -- When player left tournament
opponents_played UUID[] DEFAULT '{}' -- Array of previous opponents
```

### **Constraints**
```sql
UNIQUE(tournament_id, team_id)
FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
```

## 🔗 Relationships

### **Belongs To**
- `tournaments` - The tournament being participated in
- `teams` - The team participating

### **Has One**
- `tournament_standings` - Final ranking and results for this participation

### **Indirect Relationships**
- `tournament_matches` - Matches this team plays in
- `team_tournament_performances` - Detailed performance history
- `player_tournament_histories` - Individual player careers

## 🎯 Usage Patterns

### **Basic Registration**
```sql
-- Register a team for a tournament
INSERT INTO tournament_participants (
    tournament_id, team_id, seed_number, registration_data
) VALUES (
    tournament_uuid, team_uuid, 1,
    '{"registration_date": "2024-05-15", "contact_email": "captain@team.com"}'
);
```

### **Swiss Tournament Registration**
```sql
-- Register team for Swiss tournament with initial data
INSERT INTO tournament_participants (
    tournament_id, team_id, seed_number,
    swiss_score, tiebreaker_points, buchholz_score,
    opponents_played
) VALUES (
    tournament_uuid, team_uuid, 1,
    0, 0, 0, '{}'::UUID[]
);
```

### **Team Seeding**
```sql
-- Update team seed after registration
UPDATE tournament_participants
SET seed_number = 1
WHERE tournament_id = tournament_uuid
AND team_id = team_uuid;

-- Seed all teams based on ranking
UPDATE tournament_participants tp
SET seed_number = subquery.rank
FROM (
    SELECT 
        tp.id,
        ROW_NUMBER() OVER (ORDER BY team.average_rank ASC) as rank
    FROM tournament_participants tp
    JOIN teams team ON tp.team_id = team.id
    WHERE tp.tournament_id = tournament_uuid
) subquery
WHERE tp.id = subquery.id;
```

## 🔄 Participant Lifecycle

### **1. Registration**
```sql
-- Initial state
is_active = true
seed_number = assigned
swiss_score = 0 (for Swiss)
opponents_played = {} (empty array)
dropped_out_at = NULL
```

### **2. Tournament Progress**
```sql
-- Swiss tournament updates
UPDATE tournament_participants
SET 
    swiss_score = swiss_score + 3,
    tiebreaker_points = tiebreaker_points + 3,
    opponents_played = array_append(opponents_played, opponent_uuid)
WHERE tournament_id = tournament_uuid
AND team_id = team_uuid;
```

### **3. Dropout/Disqualification**
```sql
-- Mark team as inactive
UPDATE tournament_participants
SET 
    is_active = false,
    dropped_out_at = NOW()
WHERE tournament_id = tournament_uuid
AND team_id = team_uuid;
```

## 📊 Participant Management Functions

### **Register Team for Tournament**
```sql
CREATE OR REPLACE FUNCTION register_team_for_tournament(
    tournament_id UUID, team_id UUID, seed_number INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    participant_count INTEGER;
    max_teams INTEGER;
BEGIN
    -- Check if tournament is still accepting registrations
    SELECT COUNT(*), max_teams 
    INTO participant_count, max_teams
    FROM tournament_participants
    WHERE tournament_id = tournament_id;
    
    IF participant_count >= max_teams THEN
        RAISE EXCEPTION 'Tournament is full';
    END IF;
    
    -- Register the team
    INSERT INTO tournament_participants (
        tournament_id, team_id, seed_number
    ) VALUES (
        tournament_id, team_id, 
        COALESCE(seed_number, participant_count + 1)
    );
    
    -- Log the registration
    INSERT INTO tournament_logs (
        tournament_id, action, details, team_id, user_id
    ) VALUES (
        tournament_id, 'TEAM_REGISTERED',
        'Team registered for tournament', team_id, auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### **Remove Team from Tournament**
```sql
CREATE OR REPLACE FUNCTION remove_team_from_tournament(
    tournament_id UUID, team_id UUID, reason TEXT DEFAULT 'Team withdrew'
) RETURNS BOOLEAN AS $$
BEGIN
    -- Mark as inactive rather than delete (preserve history)
    UPDATE tournament_participants
    SET 
        is_active = false,
        dropped_out_at = NOW()
    WHERE tournament_id = tournament_id
    AND team_id = team_id;
    
    -- Handle upcoming matches (forfeit wins)
    UPDATE tournament_matches
    SET 
        winner_id = CASE 
            WHEN team1_id = team_id THEN team2_id
            ELSE team1_id
        END,
        status = 'Completed',
        completed_at = NOW()
    WHERE tournament_id = tournament_id
    AND status = 'Scheduled'
    AND (team1_id = team_id OR team2_id = team_id);
    
    -- Log the removal
    INSERT INTO tournament_logs (
        tournament_id, action, details, team_id, user_id
    ) VALUES (
        tournament_id, 'TEAM_WITHDREW',
        'Team withdrew: ' || reason, team_id, auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

## 📈 Analytics and Reporting

### **Registration Analytics**
```sql
-- Tournament registration progress
SELECT 
    t.name as tournament_name,
    t.max_teams,
    COUNT(tp.id) as registered_teams,
    COUNT(CASE WHEN tp.is_active = true THEN 1 END) as active_teams,
    ROUND(COUNT(tp.id)::NUMERIC / t.max_teams * 100, 2) as registration_percentage,
    t.registration_deadline,
    CASE 
        WHEN NOW() > t.registration_deadline THEN 'Closed'
        WHEN COUNT(tp.id) >= t.max_teams THEN 'Full'
        ELSE 'Open'
    END as status
FROM tournaments t
LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
GROUP BY t.id, t.name, t.max_teams, t.registration_deadline;
```

### **Swiss Tournament Standings**
```sql
-- Current Swiss standings
SELECT 
    tp.tournament_id,
    team.name as team_name,
    tp.swiss_score,
    tp.tiebreaker_points,
    tp.buchholz_score,
    ROW_NUMBER() OVER (ORDER BY tp.swiss_score DESC, tp.tiebreaker_points DESC) as current_rank,
    COUNT(srr.id) as rounds_played,
    COUNT(CASE WHEN srr.result = 'win' THEN 1 END) as wins,
    COUNT(CASE WHEN srr.result = 'draw' THEN 1 END) as draws,
    COUNT(CASE WHEN srr.result = 'loss' THEN 1 END) as losses,
    tp.is_active,
    tp.dropped_out_at IS NOT NULL as dropped_out
FROM tournament_participants tp
JOIN teams team ON tp.team_id = team.id
LEFT JOIN swiss_round_results srr ON tp.team_id = srr.team_id AND tp.tournament_id = srr.tournament_id
WHERE tp.tournament_id = tournament_uuid
GROUP BY tp.tournament_id, team.name, tp.swiss_score, tp.tiebreaker_points, tp.buchholz_score, tp.is_active, tp.dropped_out_at
ORDER BY tp.swiss_score DESC, tp.tiebreaker_points DESC;
```

### **Team Participation History**
```sql
-- Complete tournament history for a team
SELECT 
    t.name as tournament_name,
    t.format,
    t.start_date,
    t.end_date,
    tp.seed_number,
    ts.placement,
    ts.points,
    CASE 
        WHEN ts.placement = 1 THEN '🏆 Champion'
        WHEN ts.placement <= 3 THEN '🥈 Top 3'
        WHEN ts.placement <= 8 THEN '🥉 Top 8'
        ELSE 'Participated'
    END as result,
    tperf.achievements
FROM tournament_participants tp
JOIN tournaments t ON tp.tournament_id = t.id
LEFT JOIN tournament_standings ts ON tp.team_id = ts.team_id AND tp.tournament_id = ts.tournament_id
LEFT JOIN team_tournament_performances tperf ON tp.team_id = tperf.team_id AND tp.tournament_id = tperf.tournament_id
WHERE tp.team_id = team_uuid
ORDER BY t.start_date DESC;
```

## 🎯 Swiss Tournament Specifics

### **Opponent Tracking**
```sql
-- Check if two teams have played each other in Swiss
SELECT COUNT(*) > 0 as have_played
FROM tournament_participants tp1
JOIN tournament_participants tp2 ON tp1.tournament_id = tp2.tournament_id
WHERE tp1.team_id = team1_uuid
AND tp2.team_id = team2_uuid
AND tp1.tournament_id = tournament_uuid
AND team2_uuid = ANY(tp1.opponents_played);
```

### **Swiss Score Updates**
```sql
-- Update Swiss scores after match result
CREATE OR REPLACE FUNCTION update_swiss_scores(
    tournament_id UUID, winner_id UUID, loser_id UUID, result_type TEXT
) RETURNS VOID AS $$
BEGIN
    -- Update winner score
    UPDATE tournament_participants
    SET 
        swiss_score = swiss_score + 
            CASE 
                WHEN result_type = 'win' THEN 3
                WHEN result_type = 'draw' THEN 1
                ELSE 0
            END,
        tiebreaker_points = tiebreaker_points + 
            CASE 
                WHEN result_type = 'win' THEN 3
                WHEN result_type = 'draw' THEN 1
                ELSE 0
            END,
        opponents_played = array_append(opponents_played, loser_id)
    WHERE tournament_id = tournament_id
    AND team_id = winner_id;
    
    -- Update loser score
    UPDATE tournament_participants
    SET 
        opponents_played = array_append(opponents_played, winner_id)
    WHERE tournament_id = tournament_id
    AND team_id = loser_id;
END;
$$ LANGUAGE plpgsql;
```

## 🛡️ Data Integrity

### **Validation Rules**
- Each team can only register once per tournament
- Seed numbers must be unique within tournament
- Swiss scores must be non-negative
- Opponent arrays must contain valid team IDs

### **Consistency Checks**
```sql
-- Find duplicate registrations
SELECT 
    tournament_id, team_id, COUNT(*) as duplicate_count
FROM tournament_participants
GROUP BY tournament_id, team_id
HAVING COUNT(*) > 1;

-- Find invalid seed numbers
SELECT 
    tournament_id, seed_number, COUNT(*) as teams_with_seed
FROM tournament_participants
WHERE seed_number IS NOT NULL
GROUP BY tournament_id, seed_number
HAVING COUNT(*) > 1;
```

## 📝 Best Practices

### **Registration Management**
1. Validate team eligibility before registration
2. Use waitlists for over-subscribed tournaments
3. Send confirmation notifications
4. Track registration changes in logs

### **Seeding Strategy**
1. Use objective ranking systems
2. Consider geographic distribution
3. Account for previous tournament performance
4. Allow manual seed adjustments for special cases

### **Swiss Tournament Management**
1. Track opponent history carefully
2. Update scores immediately after matches
3. Handle dropouts gracefully
4. Calculate tiebreakers accurately

## 🔄 Migration Notes

### **Version History**
- **v1.0**: Basic team registration and seeding
- **v2.0**: Added Swiss tournament support
- **v3.0**: Enhanced with opponent tracking and tiebreakers
- **v4.0**: Added dropout tracking and status management

### **Backward Compatibility**
- Existing registrations continue to work
- Swiss-specific fields have sensible defaults
- Enhanced features are optional

This table serves as the bridge between tournaments and teams, managing who participates in what, while providing rich data for Swiss tournaments and comprehensive participation tracking.
