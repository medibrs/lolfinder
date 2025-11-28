# Tournament Milestones Table

## 📋 Overview
The `tournament_milestones` table captures epic moments, achievements, and notable events throughout tournaments. It preserves the stories and highlights that make tournaments memorable, from upset victories to perfect games and record-breaking performances.

## 🏗️ Table Structure

### **Core Fields**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
tournament_id UUID NOT NULL
milestone_type VARCHAR(50) NOT NULL -- 'first_blood', 'perfect_game', 'upset_victory', 'comeback', 'record_breaking'
description TEXT NOT NULL
team_id UUID
player_id UUID
match_id UUID
round_number INTEGER
significance_score INTEGER DEFAULT 1 -- 1-10 how significant
public_story TEXT -- Human-readable story
metadata JSONB -- Additional data
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Constraints**
```sql
FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
FOREIGN KEY (match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL
```

## 🎯 Milestone Types

### **Performance Milestones**
```sql
'perfect_game' -- Flawless victory with no deaths
'dominating_victory' -- Won with massive gold/kill advantage
'comeback_victory' -- Won from huge deficit
'upset_victory' -- Lower seed beats higher seed
'sweep_victory' -- Won series without losing a game
```

### **Individual Achievements**
```sql
'first_blood' -- First kill of the match
'penta_kill' -- Five kills in short time
'baron_steal' -- Stole Baron from enemy
'dragon_control' -- Perfect dragon control
'flawless_kda' -- No deaths in victory
```

### **Tournament Milestones**
```sql
'tournament_start' -- Official tournament beginning
'bracket_complete' -- Final bracket generated
'first_match_completed' -- Tournament underway
'semi_finals_reached' -- Down to final four
'champion_crowned' -- Tournament winner determined
```

### **Record Breaking**
```sql
'longest_match' -- Match duration record
'shortest_match' -- Quickest victory
'most_kills' -- Kill count record
'least_deaths' -- Defensive record
'fastest_objective' -- Early objective record
```

## 🔗 Relationships

### **Belongs To**
- `tournaments` - The tournament where milestone occurred
- `teams` - Team involved in milestone (if applicable)
- `players` - Individual player achievement (if applicable)
- `tournament_matches` - Match context (if applicable)

### **Indirect Relationships**
- `tournament_brackets` - Bracket context via match
- `tournament_participants` - Participant context via team

## 🎯 Usage Patterns

### **Basic Milestone Recording**
```sql
INSERT INTO tournament_milestones (
    tournament_id, milestone_type, description,
    team_id, match_id, round_number, significance_score, public_story
) VALUES (
    tournament_uuid, 'upset_victory',
    '8th seed Team Underdog defeats 1st seed Team Favorite in quarterfinals',
    underdog_uuid, match_uuid, 2, 8,
    'In one of the biggest upsets of the tournament, Team Underdog has taken down the top seed Team Favorite with a decisive 2-0 victory. The 8th seed showed incredible preparation and execution, proving that seeding doesn''t always tell the whole story.'
);
```

### **Individual Achievement Milestone**
```sql
INSERT INTO tournament_milestones (
    tournament_id, milestone_type, description,
    player_id, team_id, match_id, significance_score, public_story, metadata
) VALUES (
    tournament_uuid, 'penta_kill',
    'PlayerX achieves pentakill in crucial teamfight',
    player_uuid, team_uuid, match_uuid, 6,
    'PlayerX single-handedly turned the tide with an incredible pentakill in the deciding game 3 teamfight, securing the victory for his team.',
    '{"kill_time": "24:15", "champion": "Yasuo", "game_number": 3}'
);
```

### **Tournament Milestone**
```sql
INSERT INTO tournament_milestones (
    tournament_id, milestone_type, description,
    significance_score, public_story
) VALUES (
    tournament_uuid, 'champion_crowned',
    'Team Alpha crowned Summer Championship 2024 champions',
    10,
    'After an intense three-day tournament featuring 16 of the best teams, Team Alpha has emerged victorious, claiming the Summer Championship 2024 title and the $10,000 grand prize.'
);
```

## 🔄 Milestone Detection Functions

### **Upset Victory Detection**
```sql
CREATE OR REPLACE FUNCTION detect_upset_victory(
    match_id UUID, winner_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    seed_difference INTEGER;
    is_upset BOOLEAN;
BEGIN
    -- Calculate seed difference
    SELECT ABS(tp1.seed_number - tp2.seed_number) INTO seed_difference
    FROM tournament_participants tp1, tournament_participants tp2
    WHERE tp1.team_id = winner_id 
    AND tp2.team_id = (SELECT CASE 
        WHEN tm.team1_id = winner_id THEN tm.team2_id 
        ELSE tm.team1_id 
    END FROM tournament_matches tm WHERE tm.id = match_id)
    AND tp1.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id)
    AND tp2.tournament_id = tp1.tournament_id;
    
    -- Determine if it's an upset (seed difference > 3 and lower seed won)
    SELECT (seed_difference > 3 AND 
            (SELECT tp.seed_number FROM tournament_participants tp 
             WHERE tp.team_id = winner_id AND tp.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id)) > 
            (SELECT tp.seed_number FROM tournament_participants tp 
             WHERE tp.team_id = (SELECT CASE 
                WHEN tm.team1_id = winner_id THEN tm.team2_id 
                ELSE tm.team1_id 
             END FROM tournament_matches tm WHERE tm.id = match_id) 
             AND tp.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id))
    ) INTO is_upset;
    
    -- Record the upset milestone
    IF is_upset THEN
        INSERT INTO tournament_milestones (
            tournament_id, milestone_type, description,
            team_id, match_id, round_number, significance_score,
            public_story, metadata
        ) VALUES (
            (SELECT tournament_id FROM tournament_matches WHERE id = match_id),
            'upset_victory',
            format('%s seed defeats %s seed (seed difference: %d)', 
                (SELECT tp.seed_number FROM tournament_participants tp WHERE tp.team_id = winner_id AND tp.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id)),
                (SELECT tp.seed_number FROM tournament_participants tp WHERE tp.team_id = (SELECT CASE WHEN tm.team1_id = winner_id THEN tm.team2_id ELSE tm.team1_id END FROM tournament_matches tm WHERE tm.id = match_id) AND tp.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id)),
                seed_difference
            ),
            winner_id, match_id,
            (SELECT tb.round_number FROM tournament_matches tm JOIN tournament_brackets tb ON tm.bracket_id = tb.id WHERE tm.id = match_id),
            LEAST(seed_difference + 3, 10), -- Scale significance by seed difference
            format('In a stunning upset, the %s seed defeated the %s seed, proving that rankings don''t always predict outcomes.',
                (SELECT tp.seed_number FROM tournament_participants tp WHERE tp.team_id = winner_id AND tp.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id)),
                (SELECT tp.seed_number FROM tournament_participants tp WHERE tp.team_id = (SELECT CASE WHEN tm.team1_id = winner_id THEN tm.team2_id ELSE tm.team1_id END FROM tournament_matches tm WHERE tm.id = match_id) AND tp.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id))
            ),
            json_build_object('seed_difference', seed_difference, 'winner_seed', (SELECT tp.seed_number FROM tournament_participants tp WHERE tp.team_id = winner_id AND tp.tournament_id = (SELECT tournament_id FROM tournament_matches WHERE id = match_id)))
        );
    END IF;
    
    RETURN is_upset;
END;
$$ LANGUAGE plpgsql;
```

### **Perfect Game Detection**
```sql
CREATE OR REPLACE FUNCTION detect_perfect_game(
    match_id UUID, team_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    is_perfect BOOLEAN;
BEGIN
    -- Check if team won with no deaths (simplified logic)
    -- In real implementation, this would check actual game stats
    SELECT (tm.winner_id = team_id AND tm.team1_score = 2 AND tm.team2_score = 0) INTO is_perfect
    FROM tournament_matches tm
    WHERE tm.id = match_id;
    
    IF is_perfect THEN
        INSERT INTO tournament_milestones (
            tournament_id, milestone_type, description,
            team_id, match_id, significance_score, public_story
        ) VALUES (
            (SELECT tournament_id FROM tournament_matches WHERE id = match_id),
            'perfect_game',
            'Dominant victory with flawless execution',
            team_id, match_id,
            7,
            'A masterclass in competitive gaming - this team achieved a perfect victory, showcasing superior skill and coordination.'
        );
    END IF;
    
    RETURN is_perfect;
END;
$$ LANGUAGE plpgsql;
```

## 📈 Milestone Analytics

### **Tournament Highlights Dashboard**
```sql
-- Get most significant milestones from tournament
SELECT 
    tm.*,
    t.name as tournament_name,
    team.name as team_name,
    player.summoner_name as player_name,
    tm_match.match_number,
    tb.round_number,
    CASE 
        WHEN tm.significance_score >= 8 THEN '🏆 Legendary'
        WHEN tm.significance_score >= 5 THEN '⭐ Epic'
        WHEN tm.significance_score >= 3 THEN '🎯 Great'
        ELSE '📝 Notable'
    END as significance_level
FROM tournament_milestones tm
JOIN tournaments t ON tm.tournament_id = t.id
LEFT JOIN teams team ON tm.team_id = team.id
LEFT JOIN players player ON tm.player_id = player.id
LEFT JOIN tournament_matches tm_match ON tm.match_id = tm_match.id
LEFT JOIN tournament_brackets tb ON tm_match.bracket_id = tb.id
WHERE tm.tournament_id = tournament_uuid
ORDER BY tm.significance_score DESC, tm.created_at DESC;
```

### **Milestone Distribution Analysis**
```sql
-- Analyze types of milestones achieved
SELECT 
    milestone_type,
    COUNT(*) as milestone_count,
    AVG(significance_score) as avg_significance,
    COUNT(CASE WHEN significance_score >= 8 THEN 1 END) as legendary_milestones,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tournament_milestones WHERE tournament_id = tournament_uuid), 2) as percentage
FROM tournament_milestones
WHERE tournament_id = tournament_uuid
GROUP BY milestone_type
ORDER BY milestone_count DESC;
```

### **Team Achievement History**
```sql
-- Complete milestone history for a team
SELECT 
    tm.milestone_type,
    tm.description,
    tm.significance_score,
    tm.public_story,
    tm.created_at,
    t.name as tournament_name,
    CASE 
        WHEN tm.significance_score >= 8 THEN '🏆'
        WHEN tm.significance_score >= 5 THEN '⭐'
        WHEN tm.significance_score >= 3 THEN '🎯'
        ELSE '📝'
    END as significance_icon
FROM tournament_milestones tm
JOIN tournaments t ON tm.tournament_id = t.id
WHERE tm.team_id = team_uuid
ORDER BY tm.created_at DESC;
```

## 🎯 Public Story Generation

### **Automated Story Creation**
```sql
CREATE OR REPLACE FUNCTION generate_milestone_story(
    milestone_type VARCHAR(50), 
    team_name VARCHAR(255), 
    context JSONB
) RETURNS TEXT AS $$
BEGIN
    RETURN CASE milestone_type
        WHEN 'upset_victory' THEN format(
            'In a shocking turn of events, %s has defeated the heavily favored opponent, proving that underdogs can rise to the occasion when it matters most.',
            team_name
        )
        WHEN 'perfect_game' THEN format(
            '%s delivered a flawless performance, achieving victory without a single setback and demonstrating complete mastery of the game.',
            team_name
        )
        WHEN 'comeback_victory' THEN format(
            'Down by over %s gold, %s mounted an incredible comeback, showing incredible resilience and never giving up despite the odds.',
            context->>'gold_deficit', team_name
        )
        WHEN 'penta_kill' THEN format(
            'A legendary pentakill by %s turned the tide of battle, single-handedly winning a crucial teamfight and momentum.',
            context->>'player_name'
        )
        ELSE format(
            '%s achieved a remarkable milestone in their tournament journey, adding another memorable moment to their legacy.',
            team_name
        );
    END CASE;
END;
$$ LANGUAGE plpgsql;
```

## 🛡️ Data Integrity

### **Validation Rules**
- Milestone type must be from predefined list
- Significance score must be between 1-10
- At least one context entity (team, player, or match) must be provided
- Description cannot be empty

### **Consistency Checks**
```sql
-- Find milestones with invalid data
SELECT 
    id,
    CASE 
        WHEN milestone_type NOT IN ('perfect_game', 'upset_victory', 'comeback_victory', 'penta_kill', 'first_blood', 'tournament_start', 'champion_crowned') THEN 'Invalid milestone type'
        WHEN significance_score < 1 OR significance_score > 10 THEN 'Invalid significance score'
        WHEN team_id IS NULL AND player_id IS NULL AND match_id IS NULL THEN 'No context provided'
        WHEN description IS NULL OR LENGTH(TRIM(description)) = 0 THEN 'Empty description'
    END as issue
FROM tournament_milestones
WHERE milestone_type NOT IN ('perfect_game', 'upset_victory', 'comeback_victory', 'penta_kill', 'first_blood', 'tournament_start', 'champion_crowned')
OR significance_score < 1 OR significance_score > 10
OR (team_id IS NULL AND player_id IS NULL AND match_id IS NULL)
OR description IS NULL OR LENGTH(TRIM(description)) = 0;
```

## 📝 Best Practices

### **Milestone Creation**
1. Use descriptive, engaging stories
2. Assign appropriate significance scores
3. Include rich metadata for context
4. Link to relevant teams, players, matches
5. Create public-friendly narratives

### **Significance Scoring**
1. **10**: Tournament winner, once-in-a-lifetime plays
2. **8-9**: Major upsets, perfect games, pentakills
3. **5-7**: Significant comebacks, important first bloods
4. **3-4**: Notable achievements, solid performances
5. **1-2**: Minor milestones, routine achievements

### **Story Writing**
1. Focus on human drama and emotion
2. Include specific details and context
3. Use engaging, narrative language
4. Highlight the significance of the moment
5. Consider the audience (players, fans, media)

## 🔄 Migration Notes

### **Version History**
- **v1.0**: Basic milestone tracking with types and descriptions
- **v2.0**: Added significance scoring and public stories
- **v3.0**: Enhanced with metadata and automated detection
- **v4.0**: Advanced story generation and analytics

### **Backward Compatibility**
- Existing milestones continue to work
- New metadata fields are optional
- Enhanced features build on existing data

This table transforms tournament data into compelling narratives, preserving the epic moments and achievements that make competitive gaming exciting and memorable for players and fans alike.
