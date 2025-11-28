# Tournament Brackets Table

## 📋 Overview
The `tournament_brackets` table defines the structural layout of tournament brackets. It organizes matches into rounds and positions, creating the framework for both elimination and Swiss-style tournaments.

## 🏗️ Table Structure

### **Core Fields**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
tournament_id UUID NOT NULL
round_number INTEGER NOT NULL
bracket_position INTEGER NOT NULL -- Position in bracket (1, 2, 3, etc.)
parent_match_id UUID -- For winner bracket progression (single elimination)
winner_bracket_match_id UUID -- For double elimination winner bracket
loser_bracket_match_id UUID -- For double elimination loser bracket
is_final BOOLEAN DEFAULT false
is_third_place BOOLEAN DEFAULT false
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Constraints**
```sql
UNIQUE(tournament_id, round_number, bracket_position)
FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
FOREIGN KEY (parent_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL
FOREIGN KEY (winner_bracket_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL
FOREIGN KEY (loser_bracket_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL
```

## 🔗 Relationships

### **Belongs To**
- `tournaments` - The tournament this bracket belongs to

### **Has Many**
- `tournament_matches` - Matches that occupy these bracket positions

### **References**
- `tournament_matches` - Parent match (winner advances from)
- `tournament_matches` - Winner bracket match (double elimination)
- `tournament_matches` - Loser bracket match (double elimination)

## 🎯 Usage Patterns

### **Single Elimination Bracket**
```sql
-- 8-team single elimination bracket structure
INSERT INTO tournament_brackets (tournament_id, round_number, bracket_position) VALUES
-- Round 1 (Quarterfinals)
(tournament_uuid, 1, 1), (tournament_uuid, 1, 2), (tournament_uuid, 1, 3), (tournament_uuid, 1, 4),
-- Round 2 (Semifinals) 
(tournament_uuid, 2, 1), (tournament_uuid, 2, 2),
-- Round 3 (Final)
(tournament_uuid, 3, 1);
```

### **Double Elimination Structure**
```sql
-- Winner bracket
INSERT INTO tournament_brackets (tournament_id, round_number, bracket_position) VALUES
-- Winner bracket rounds
(tournament_uuid, 1, 1), (tournament_uuid, 1, 2), -- WB Round 1
(tournament_uuid, 2, 1), -- WB Final

-- Loser bracket  
(tournament_uuid, 1, 1), (tournament_uuid, 1, 2), -- LB Round 1
(tournament_uuid, 2, 1), -- LB Round 2
(tournament_uuid, 3, 1); -- Grand Final
```

### **Swiss Tournament Rounds**
```sql
-- Swiss doesn't use traditional bracket positions
-- Each round is just a collection of matches
INSERT INTO tournament_brackets (tournament_id, round_number, bracket_position) VALUES
(tournament_uuid, 1, 1), (tournament_uuid, 1, 2), (tournament_uuid, 1, 3), (tournament_uuid, 1, 4), -- Round 1
(tournament_uuid, 2, 1), (tournament_uuid, 2, 2), (tournament_uuid, 2, 3), (tournament_uuid, 2, 4), -- Round 2
-- ... continue for all Swiss rounds
```

## 📊 Bracket Positioning Logic

### **Single Elimination Positioning**
```
Round 1 (8 teams):    Round 2 (4 teams):    Round 3 (2 teams):
Position 1 → Winner → Position 1 → Winner → Position 1 (Champion)
Position 2 ↗
Position 3 → Winner → Position 2 → Winner ↗
Position 4 ↗
Position 5 → Winner → Position 3 ↗
Position 6 ↗
Position 7 → Winner → Position 4 ↗
Position 8 ↗
```

### **Parent Match Logic**
```sql
-- Winner of position 1,2 advances to position 1 in next round
-- Winner of position 3,4 advances to position 2 in next round
UPDATE tournament_brackets
SET parent_match_id = (
    SELECT id FROM tournament_matches 
    WHERE bracket_position IN (1, 2) AND round_number = current_round - 1
    ORDER BY bracket_position LIMIT 1
)
WHERE bracket_position = 1 AND round_number = current_round;
```

## 🎯 Special Match Types

### **Final Match**
```sql
INSERT INTO tournament_brackets (
    tournament_id, round_number, bracket_position, is_final
) VALUES (
    tournament_uuid, max_round, 1, true
);
```

### **Third Place Match**
```sql
INSERT INTO tournament_brackets (
    tournament_id, round_number, bracket_position, is_third_place
) VALUES (
    tournament_uuid, max_round, 2, true
);
```

## 🔄 Bracket Generation Functions

### **Single Elimination Generation**
```sql
CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(
    tournament_id UUID, num_teams INTEGER
) RETURNS VOID AS $$
DECLARE
    bracket_size INTEGER;
    num_rounds INTEGER;
    current_round INTEGER;
    matches_in_round INTEGER;
BEGIN
    bracket_size := calculate_next_power_of_two(num_teams);
    num_rounds := CEIL(LOG(2, bracket_size));
    
    -- Generate bracket from final backwards
    FOR current_round IN REVERSE num_rounds..1 LOOP
        matches_in_round := POWER(2, current_round - 1);
        
        FOR i IN 1..matches_in_round LOOP
            INSERT INTO tournament_brackets (
                tournament_id, round_number, bracket_position,
                is_final, is_third_place
            ) VALUES (
                tournament_id, current_round, i,
                current_round = num_rounds AND i = 1,
                current_round = num_rounds AND i = 2
            );
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## 📈 Visualization Data

### **Bracket Tree Query**
```sql
-- Get complete bracket structure for visualization
WITH RECURSIVE bracket_tree AS (
    -- Base: final match
    SELECT tb.*, NULL::UUID as child_position
    FROM tournament_brackets tb
    WHERE tb.is_final = true AND tb.tournament_id = $1
    
    UNION ALL
    
    -- Recursive: previous rounds
    SELECT tb.*, bt.bracket_position as child_position
    FROM tournament_brackets tb
    JOIN bracket_tree bt ON tb.parent_match_id = (SELECT id FROM tournament_matches WHERE bracket_id = bt.id)
    WHERE tb.tournament_id = $1
)
SELECT * FROM bracket_tree ORDER BY round_number DESC, bracket_position;
```

### **Match Progression Path**
```sql
-- Get the path a team takes through bracket
SELECT 
    tb.round_number,
    tb.bracket_position,
    tm.team1_id,
    tm.team2_id,
    tm.winner_id,
    CASE 
        WHEN tm.winner_id = $team_id THEN 'Advanced'
        WHEN tm.status = 'Completed' THEN 'Eliminated'
        ELSE 'Pending'
    END as result
FROM tournament_brackets tb
JOIN tournament_matches tm ON tb.id = tm.bracket_id
WHERE tb.tournament_id = $tournament_id
AND (tm.team1_id = $team_id OR tm.team2_id = $team_id)
ORDER BY tb.round_number;
```

## 🛡️ Data Integrity

### **Constraints Validation**
- Each position within a round must be unique
- Parent matches must exist in previous round
- Final matches must be properly marked
- Bracket positions must follow logical progression

### **Consistency Checks**
```sql
-- Verify bracket structure is complete
SELECT 
    tournament_id,
    round_number,
    COUNT(*) as matches_in_round,
    POWER(2, round_number - 1) as expected_matches
FROM tournament_brackets
GROUP BY tournament_id, round_number
HAVING COUNT(*) != POWER(2, round_number - 1);
```

## 📝 Best Practices

### **Bracket Design**
1. Use power of 2 numbers for clean brackets
2. Consider third-place matches for completeness
3. Plan bye distribution for uneven teams
4. Allow adequate space between rounds

### **Performance Optimization**
1. Index on tournament_id and round_number
2. Use bracket position for ordering
3. Cache bracket structures for visualization
4. Batch bracket generation operations

### **Error Handling**
1. Validate bracket structure before tournament start
2. Check for orphaned bracket positions
3. Verify parent-child relationships
4. Handle incomplete brackets gracefully

## 🔄 Migration Notes

### **Version History**
- **v1.0**: Basic bracket structure for single elimination
- **v2.0**: Added double elimination support
- **v3.0**: Enhanced with Swiss tournament compatibility
- **v4.0**: Added special match types and parent relationships

### **Backward Compatibility**
- Existing brackets continue to work
- New fields have sensible defaults
- Format-specific features are optional

This table provides the structural backbone for tournament brackets, enabling everything from simple 4-team brackets to complex double elimination and Swiss tournaments.
