# Swiss Pairings Table

## 📋 Overview
The `swiss_pairings` table tracks pairing history and constraints for Swiss tournaments. It prevents rematches between teams and ensures fair Swiss pairings by maintaining a record of all previous matchups.

## 🏗️ Table Structure

### **Core Fields**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
tournament_id UUID NOT NULL
round_number INTEGER NOT NULL
player1_id UUID NOT NULL
player2_id UUID NOT NULL
cannot_pair_again BOOLEAN DEFAULT true -- Players shouldn't meet again in Swiss
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Constraints**
```sql
UNIQUE(tournament_id, round_number, player1_id, player2_id)
FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
FOREIGN KEY (player1_id) REFERENCES teams(id) ON DELETE CASCADE
FOREIGN KEY (player2_id) REFERENCES teams(id) ON DELETE CASCADE
CHECK (player1_id != player2_id)
```

## 🔗 Relationships

### **Belongs To**
- `tournaments` - The tournament these pairings belong to

### **References**
- `teams` (player1_id) - First team in pairing
- `teams` (player2_id) - Second team in pairing

### **Indirect Relationships**
- `tournament_participants` - Both teams are participants
- `swiss_round_results` - Results of these pairings

## 🎯 Usage Patterns

### **Recording Swiss Pairing**
```sql
-- Record that two teams have been paired
INSERT INTO swiss_pairings (
    tournament_id, round_number, player1_id, player2_id, cannot_pair_again
) VALUES (
    tournament_uuid, 1, team1_uuid, team2_uuid, true
);
```

### **Checking if Teams Have Played**
```sql
-- Check if two teams have already played each other
SELECT COUNT(*) > 0 as have_played
FROM swiss_pairings sp
WHERE sp.tournament_id = tournament_uuid
AND (
    (sp.player1_id = team1_uuid AND sp.player2_id = team2_uuid)
    OR (sp.player1_id = team2_uuid AND sp.player2_id = team1_uuid)
);
```

### **Getting Available Opponents**
```sql
-- Get teams a specific team hasn't played yet
SELECT 
    tp.team_id,
    team.name as team_name,
    tp.swiss_score,
    tp.tiebreaker_points
FROM tournament_participants tp
JOIN teams team ON tp.team_id = team.id
WHERE tp.tournament_id = tournament_uuid
AND tp.team_id != current_team_uuid
AND tp.is_active = true
AND tp.team_id NOT IN (
    -- Exclude teams already played
    SELECT sp.player2_id 
    FROM swiss_pairings sp 
    WHERE sp.tournament_id = tournament_uuid 
    AND sp.player1_id = current_team_uuid
    UNION
    SELECT sp.player1_id 
    FROM swiss_pairings sp 
    WHERE sp.tournament_id = tournament_uuid 
    AND sp.player2_id = current_team_uuid
)
ORDER BY tp.swiss_score DESC, tp.tiebreaker_points DESC;
```

## 🔄 Swiss Pairing Algorithm Integration

### **Pairing Validation Function**
```sql
CREATE OR REPLACE FUNCTION can_pair_teams(
    tournament_id UUID, team1_id UUID, team2_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    already_played BOOLEAN;
BEGIN
    -- Check if teams have already played
    SELECT COUNT(*) > 0 INTO already_played
    FROM swiss_pairings sp
    WHERE sp.tournament_id = tournament_id
    AND sp.cannot_pair_again = true
    AND (
        (sp.player1_id = team1_id AND sp.player2_id = team2_id)
        OR (sp.player1_id = team2_id AND sp.player2_id = team1_id)
    );
    
    RETURN NOT already_played;
END;
$$ LANGUAGE plpgsql;
```

### **Optimal Pairing Finder**
```sql
CREATE OR REPLACE FUNCTION find_optimal_swiss_pairing(
    tournament_id UUID, current_team_id UUID
) RETURNS TABLE(opponent_id UUID, score_difference INTEGER) AS $$
DECLARE
    current_score INTEGER;
    current_tiebreaker DECIMAL;
BEGIN
    -- Get current team's score
    SELECT swiss_score, tiebreaker_points 
    INTO current_score, current_tiebreaker
    FROM tournament_participants
    WHERE tournament_id = tournament_id
    AND team_id = current_team_id;
    
    -- Find best opponent (same score, haven't played)
    RETURN QUERY
    SELECT 
        tp.team_id,
        ABS(tp.swiss_score - current_score) as score_diff
    FROM tournament_participants tp
    WHERE tp.tournament_id = tournament_id
    AND tp.team_id != current_team_id
    AND tp.is_active = true
    AND can_pair_teams(tournament_id, current_team_id, tp.team_id) = true
    ORDER BY 
        ABS(tp.swiss_score - current_score) ASC,
        ABS(tp.tiebreaker_points - current_tiebreaker) ASC,
        tp.swiss_score DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

## 📊 Pairing Analytics

### **Pairing Distribution Analysis**
```sql
-- Analyze how pairings are distributed across score differences
SELECT 
    ABS(tp1.swiss_score - tp2.swiss_score) as score_difference,
    COUNT(*) as pairing_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM swiss_pairings WHERE tournament_id = tournament_uuid), 2) as percentage
FROM swiss_pairings sp
JOIN tournament_participants tp1 ON sp.player1_id = tp1.team_id AND tp1.tournament_id = sp.tournament_id
JOIN tournament_participants tp2 ON sp.player2_id = tp2.team_id AND tp2.tournament_id = sp.tournament_id
WHERE sp.tournament_id = tournament_uuid
GROUP BY ABS(tp1.swiss_score - tp2.swiss_score)
ORDER BY score_difference;
```

### **Team Pairing History**
```sql
-- Complete pairing history for a team in Swiss tournament
SELECT 
    sp.round_number,
    CASE 
        WHEN sp.player1_id = team_uuid THEN opponent.name
        ELSE opponent.name
    END as opponent,
    sp.created_at as pairing_time,
    CASE 
        WHEN sp.player1_id = team_uuid THEN srr.result
        ELSE CASE srr.result
            WHEN 'win' THEN 'loss'
            WHEN 'loss' THEN 'win'
            ELSE srr.result
        END
    END as result
FROM swiss_pairings sp
JOIN teams opponent ON (
    (sp.player1_id = team_uuid AND sp.player2_id = opponent.id)
    OR (sp.player2_id = team_uuid AND sp.player1_id = opponent.id)
)
LEFT JOIN swiss_round_results srr ON (
    srr.tournament_id = sp.tournament_id
    AND srr.team_id = team_uuid
    AND srr.opponent_id = opponent.id
)
WHERE sp.tournament_id = tournament_uuid
AND (sp.player1_id = team_uuid OR sp.player2_id = team_uuid)
ORDER BY sp.round_number;
```

### **Pairing Quality Metrics**
```sql
-- Evaluate quality of Swiss pairings
SELECT 
    sp.tournament_id,
    COUNT(*) as total_pairings,
    COUNT(CASE WHEN ABS(tp1.swiss_score - tp2.swiss_score) = 0 THEN 1 END) as perfect_score_pairings,
    COUNT(CASE WHEN ABS(tp1.swiss_score - tp2.swiss_score) <= 1 THEN 1 END) as close_score_pairings,
    ROUND(AVG(ABS(tp1.swiss_score - tp2.swiss_score)), 2) as avg_score_difference,
    ROUND(COUNT(CASE WHEN ABS(tp1.swiss_score - tp2.swiss_score) = 0 THEN 1 END) * 100.0 / COUNT(*), 2) as perfect_pairing_percentage
FROM swiss_pairings sp
JOIN tournament_participants tp1 ON sp.player1_id = tp1.team_id AND tp1.tournament_id = sp.tournament_id
JOIN tournament_participants tp2 ON sp.player2_id = tp2.team_id AND tp2.tournament_id = sp.tournament_id
GROUP BY sp.tournament_id;
```

## 🎯 Advanced Pairing Features

### **Pairing Constraints Management**
```sql
-- Allow certain rematches in special circumstances
UPDATE swiss_pairings
SET cannot_pair_again = false
WHERE tournament_id = tournament_uuid
AND round_number <= 2 -- Allow rematches in early rounds if needed
AND (
    -- Only if no other pairings possible
    SELECT COUNT(*) 
    FROM tournament_participants tp 
    WHERE tp.tournament_id = tournament_uuid 
    AND tp.is_active = true
) <= 4;
```

### **Pairing Conflict Resolution**
```sql
-- Handle impossible pairing scenarios
CREATE OR REPLACE FUNCTION resolve_pairing_conflicts(
    tournament_id UUID, round_number INTEGER
) RETURNS TEXT AS $$
DECLARE
    unpaired_teams INTEGER;
    conflict_resolution TEXT;
BEGIN
    -- Count teams that couldn't be paired
    SELECT COUNT(*) INTO unpaired_teams
    FROM tournament_participants tp
    WHERE tp.tournament_id = tournament_id
    AND tp.is_active = true
    AND tp.team_id NOT IN (
        SELECT DISTINCT sp.player1_id 
        FROM swiss_pairings sp 
        WHERE sp.tournament_id = tournament_id 
        AND sp.round_number = round_number
        UNION
        SELECT DISTINCT sp.player2_id 
        FROM swiss_pairings sp 
        WHERE sp.tournament_id = tournament_id 
        AND sp.round_number = round_number
    );
    
    IF unpaired_teams > 0 THEN
        conflict_resolution := 'Assigned ' || unpaired_teams || ' teams byes';
        -- Log the conflict resolution
        INSERT INTO tournament_logs (
            tournament_id, action, details, event_category, impact_level
        ) VALUES (
            tournament_id, 'PAIRING_CONFLICTS_RESOLVED',
            conflict_resolution, 'system', 'medium'
        );
    END IF;
    
    RETURN COALESCE(conflict_resolution, 'All teams paired successfully');
END;
$$ LANGUAGE plpgsql;
```

## 🛡️ Data Integrity

### **Validation Rules**
- Teams cannot be paired with themselves
- Each pairing combination is unique per tournament
- Both teams must be active participants
- Pairings must respect tournament format

### **Consistency Checks**
```sql
-- Find invalid pairings
SELECT 
    sp.id,
    CASE 
        WHEN sp.player1_id = sp.player2_id THEN 'Team paired with itself'
        WHEN NOT EXISTS(SELECT 1 FROM tournament_participants tp WHERE tp.team_id = sp.player1_id AND tp.tournament_id = sp.tournament_id) THEN 'Player1 not in tournament'
        WHEN NOT EXISTS(SELECT 1 FROM tournament_participants tp WHERE tp.team_id = sp.player2_id AND tp.tournament_id = sp.tournament_id) THEN 'Player2 not in tournament'
        WHEN sp.cannot_pair_again = false AND sp.round_number > 3 THEN 'Rematch allowed in late round'
    END as issue
FROM swiss_pairings sp
WHERE sp.player1_id = sp.player2_id
OR NOT EXISTS(SELECT 1 FROM tournament_participants tp WHERE tp.team_id = sp.player1_id AND tp.tournament_id = sp.tournament_id)
OR NOT EXISTS(SELECT 1 FROM tournament_participants tp WHERE tp.team_id = sp.player2_id AND tp.tournament_id = sp.tournament_id);
```

## 📝 Best Practices

### **Pairing Strategy**
1. Prioritize same-score pairings
2. Use tiebreakers for equal scores
3. Avoid rematches when possible
4. Handle odd numbers with byes
5. Document all pairing decisions

### **Performance Optimization**
1. Index on tournament_id and team IDs
2. Cache pairing availability checks
3. Batch pairing generation
4. Use efficient opponent lookup queries

### **Fairness Considerations**
1. Transparent pairing algorithm
2. Consistent tiebreaker application
3. Document conflict resolutions
4. Allow appeals for pairing disputes

## 🔄 Migration Notes

### **Version History**
- **v1.0**: Basic pairing tracking for Swiss tournaments
- **v2.0**: Enhanced with constraint management
- **v3.0**: Added pairing quality analytics
- **v4.0**: Advanced conflict resolution features

### **Backward Compatibility**
- Existing pairings continue to work
- New constraint features are optional
- Enhanced analytics use existing data

This table ensures fair and consistent Swiss tournament pairings by maintaining a complete history of team matchups and preventing undesirable rematches while providing rich analytics for tournament quality assessment.
