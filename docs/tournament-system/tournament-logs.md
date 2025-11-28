# Tournament Logs Table

## 📋 Overview
The `tournament_logs` table provides a comprehensive audit trail for all tournament activities. It tracks every event, decision, and change that occurs during tournament lifecycle, providing complete accountability and historical records.

## 🏗️ Enhanced Table Structure

### **Core Fields**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
tournament_id UUID NOT NULL
action VARCHAR(100) NOT NULL
details TEXT
event_category VARCHAR(50) DEFAULT 'general'
impact_level VARCHAR(20) DEFAULT 'low'
team_id UUID
match_id UUID
round_number INTEGER
previous_state TEXT -- JSON of state before change
new_state TEXT -- JSON of state after change
public_visible BOOLEAN DEFAULT false
stat_impact BOOLEAN DEFAULT false
user_id UUID
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Constraints**
```sql
FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
FOREIGN KEY (match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
```

## 📊 Event Categories

### **Tournament Management**
```sql
'tournament_created', 'tournament_started', 'tournament_completed', 'tournament_cancelled'
```

### **Match Events**
```sql
'match_scheduled', 'match_started', 'match_completed', 'match_cancelled', 'match_rescheduled'
```

### **Team Management**
```sql
'team_registered', 'team_withdrew', 'team_disqualified', 'team_replaced'
```

### **Admin Actions**
```sql
'bracket_adjusted', 'match_result_overridden', 'emergency_decision', 'rule_change'
```

### **Performance Events**
```sql
'milestone_achieved', 'upset_victory', 'perfect_game', 'record_breaking'
```

### **System Events**
```sql
'snapshot_created', 'bracket_generated', 'standings_calculated', 'error_occurred'
```

## 🎯 Impact Levels

### **Critical** 🔴
```sql
'Tournament cancelled', 'Team disqualified', 'Match result overridden'
```

### **High** 🟠
```sql
'Upset victory', 'Emergency bracket change', 'Major rule violation'
```

### **Medium** 🟡
```sql
'Match completed', 'Round advanced', 'Team withdrew'
```

### **Low** ⚪
```sql
'Match scheduled', 'Snapshot created', 'Admin note added'
```

## 🔗 Relationships

### **Belongs To**
- `tournaments` - The tournament being logged
- `teams` - Team involved in the event (if applicable)
- `tournament_matches` - Match involved in the event (if applicable)
- `auth.users` - User who performed the action

### **Indirect Relationships**
- `tournament_brackets` - Bracket context via round_number
- `tournament_participants` - Participant context via team_id

## 🎯 Usage Patterns

### **Basic Event Logging**
```sql
INSERT INTO tournament_logs (
    tournament_id, action, details, event_category, impact_level, user_id
) VALUES (
    tournament_uuid, 
    'MATCH_COMPLETED',
    'Team Alpha defeated Team Beta 2-1 in semifinals',
    'match', 'medium', user_uuid
);
```

### **High-Impact Event with State Tracking**
```sql
INSERT INTO tournament_logs (
    tournament_id, action, details, event_category, impact_level,
    team_id, match_id, previous_state, new_state, public_visible, stat_impact, user_id
) VALUES (
    tournament_uuid,
    'UPSET_VICTORY',
    '8th seed Team Underdog defeats 1st seed Team Favorite',
    'performance', 'high',
    underdog_uuid, match_uuid,
    '{"expected_winner": "Team Favorite", "seed_difference": 7}',
    '{"actual_winner": "Team Underdog", "score": "2-0"}',
    true, true, user_uuid
);
```

### **Admin Emergency Action**
```sql
INSERT INTO tournament_logs (
    tournament_id, action, details, event_category, impact_level,
    team_id, previous_state, new_state, public_visible, stat_impact, user_id
) VALUES (
    tournament_uuid,
    'TEAM_DISQUALIFIED',
    'Team disqualified for rule violation: cheating detected',
    'admin', 'critical',
    disqualified_uuid,
    '{"status": "active", "matches_remaining": 2}',
    '{"status": "disqualified", "matches_forfeited": 2}',
    true, true, admin_uuid
);
```

## 📊 Logging Functions

### **Universal Event Logger**
```sql
CREATE OR REPLACE FUNCTION log_tournament_event(
    tournament_id UUID,
    event_type VARCHAR(100),
    category VARCHAR(50) DEFAULT 'general',
    impact VARCHAR(20) DEFAULT 'low',
    details TEXT DEFAULT NULL,
    team_id UUID DEFAULT NULL,
    match_id UUID DEFAULT NULL,
    round_number INTEGER DEFAULT NULL,
    previous_state TEXT DEFAULT NULL,
    new_state TEXT DEFAULT NULL,
    public_visible BOOLEAN DEFAULT false,
    stat_impact BOOLEAN DEFAULT false
) RETURNS VOID AS $$
BEGIN
    INSERT INTO tournament_logs (
        tournament_id, action, event_category, impact_level,
        details, team_id, match_id, round_number,
        previous_state, new_state, public_visible, stat_impact, user_id
    ) VALUES (
        tournament_id, event_type, category, impact,
        details, team_id, match_id, round_number,
        previous_state, new_state, public_visible, stat_impact, auth.uid()
    );
END;
$$ LANGUAGE plpgsql;
```

### **Match Result Logger**
```sql
CREATE OR REPLACE FUNCTION log_match_result(
    match_id UUID, winner_id UUID, result VARCHAR(20), score VARCHAR(10)
) RETURNS VOID AS $$
DECLARE
    match_record RECORD;
    is_upset BOOLEAN;
BEGIN
    -- Get match details
    SELECT * INTO match_record
    FROM tournament_matches tm
    WHERE tm.id = match_id;
    
    -- Check if this is an upset
    SELECT (seed_difference > 3 AND winner_seed > loser_seed) INTO is_upset
    FROM (
        SELECT 
            tp1.seed_number as winner_seed,
            tp2.seed_number as loser_seed,
            ABS(tp1.seed_number - tp2.seed_number) as seed_difference
        FROM tournament_participants tp1, tournament_participants tp2
        WHERE tp1.team_id = winner_id 
        AND tp2.team_id = CASE 
            WHEN match_record.team1_id = winner_id THEN match_record.team2_id
            ELSE match_record.team1_id
        END
        AND tp1.tournament_id = match_record.tournament_id
        AND tp2.tournament_id = match_record.tournament_id
    ) seed_comparison;
    
    -- Log the result
    INSERT INTO tournament_logs (
        tournament_id, action, details, event_category, impact_level,
        team_id, match_id, previous_state, new_state, public_visible, stat_impact, user_id
    ) VALUES (
        match_record.tournament_id,
        'MATCH_COMPLETED',
        CASE 
            WHEN is_upset THEN 'Upset victory: ' || score
            ELSE 'Match completed: ' || score
        END,
        'match', 
        CASE 
            WHEN is_upset THEN 'high'
            ELSE 'medium'
        END,
        winner_id, match_id, NULL, NULL,
        true, true, auth.uid()
    );
END;
$$ LANGUAGE plpgsql;
```

## 📈 Analytics and Reporting

### **Tournament Timeline**
```sql
-- Complete tournament story with impact indicators
SELECT 
    tl.created_at as event_time,
    tl.action as event_type,
    tl.event_category,
    tl.impact_level,
    CASE 
        WHEN tl.impact_level = 'critical' THEN '🔴'
        WHEN tl.impact_level = 'high' THEN '🟠'
        WHEN tl.impact_level = 'medium' THEN '🟡'
        ELSE '⚪'
    END as impact_icon,
    tl.details,
    tl.public_visible,
    team.name as team_name,
    tm.match_number,
    tl.round_number,
    u.email as admin_email
FROM tournament_logs tl
LEFT JOIN teams team ON tl.team_id = team.id
LEFT JOIN tournament_matches tm ON tl.match_id = tm.id
LEFT JOIN auth.users u ON tl.user_id = u.id
WHERE tl.tournament_id = tournament_uuid
ORDER BY tl.created_at DESC;
```

### **Admin Activity Dashboard**
```sql
-- Admin action frequency and impact
SELECT 
    u.email as admin_email,
    u.raw_user_meta_data->>'full_name' as admin_name,
    COUNT(tl.id) as total_actions,
    COUNT(CASE WHEN tl.impact_level = 'critical' THEN 1 END) as critical_actions,
    COUNT(CASE WHEN tl.impact_level = 'high' THEN 1 END) as high_actions,
    COUNT(CASE WHEN tl.public_visible = true THEN 1 END) as public_actions,
    MAX(tl.created_at) as last_action,
    STRING_AGG(DISTINCT tl.action, ', ') as action_types
FROM tournament_logs tl
JOIN auth.users u ON tl.user_id = u.id
WHERE tl.tournament_id = tournament_uuid
GROUP BY u.email, u.raw_user_meta_data->>'full_name'
ORDER BY total_actions DESC;
```

### **Impact Analysis**
```sql
-- Analyze tournament events by impact and category
SELECT 
    event_category,
    impact_level,
    COUNT(*) as event_count,
    COUNT(CASE WHEN public_visible = true THEN 1 END) as public_events,
    COUNT(CASE WHEN stat_impact = true THEN 1 END) as stat_impacting_events,
    MIN(created_at) as first_event,
    MAX(created_at) as last_event
FROM tournament_logs
WHERE tournament_id = tournament_uuid
GROUP BY event_category, impact_level
ORDER BY impact_level DESC, event_category;
```

### **Team-Specific History**
```sql
-- Complete event history for a team
SELECT 
    tl.created_at,
    tl.action,
    tl.impact_level,
    tl.details,
    tl.public_visible,
    CASE 
        WHEN tl.impact_level = 'critical' THEN '🔴'
        WHEN tl.impact_level = 'high' THEN '🟠'
        WHEN tl.impact_level = 'medium' THEN '🟡'
        ELSE '⚪'
    END as impact_icon
FROM tournament_logs tl
WHERE tl.tournament_id = tournament_uuid
AND tl.team_id = team_uuid
ORDER BY tl.created_at DESC;
```

## 🎯 Public vs Private Events

### **Public Timeline Events**
```sql
-- Events shown on public tournament page
SELECT * FROM tournament_logs
WHERE tournament_id = tournament_uuid
AND public_visible = true
ORDER BY created_at DESC
LIMIT 50;
```

### **Admin-Only Events**
```sql
-- Sensitive admin decisions and system events
SELECT * FROM tournament_logs
WHERE tournament_id = tournament_uuid
AND public_visible = false
AND event_category IN ('admin', 'system')
ORDER BY created_at DESC;
```

## 🛡️ Security and Privacy

### **Access Control**
```sql
-- RLS Policy: Public can see public events, admins see all
CREATE POLICY "Public read access" ON tournament_logs
    FOR SELECT USING (public_visible = true);

CREATE POLICY "Admin full access" ON tournament_logs
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_logs.tournament_id
        )
    );
```

### **Data Protection**
- Sensitive admin actions marked as private
- User information properly anonymized in public views
- Audit trail preserved even for deleted entities

## 📝 Best Practices

### **Event Logging Strategy**
1. Log every significant tournament action
2. Use appropriate impact levels for prioritization
3. Include context (team, match, round) when relevant
4. Store state changes for audit purposes
5. Mark public events appropriately

### **Categorization Guidelines**
1. **Match events**: Game results, scheduling changes
2. **Team events**: Registration, withdrawal, disqualification
3. **Admin events**: Overrides, emergency decisions
4. **Performance events**: Achievements, milestones
5. **System events**: Automated processes, errors

### **Impact Level Assignment**
1. **Critical**: Tournament cancellation, major rule violations
2. **High**: Upsets, disqualifications, bracket changes
3. **Medium**: Match completions, round advancements
4. **Low**: Scheduling, notifications, system events

## 🔄 Migration Notes

### **Version History**
- **v1.0**: Basic action logging with details
- **v2.0**: Added categorization and impact levels
- **v3.0**: Enhanced with state tracking and public visibility
- **v4.0**: Added comprehensive context fields and stat impact tracking

### **Backward Compatibility**
- All new fields have sensible defaults
- Existing logs continue to work
- Enhanced features are optional

This table serves as the complete historical record and audit trail for tournaments, providing transparency, accountability, and rich data for analytics and storytelling.
