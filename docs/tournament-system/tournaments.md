# Tournaments Table

## 📋 Overview
The `tournaments` table is the core entity for all tournament management. It stores tournament configuration, settings, and lifecycle state information.

## 🏗️ Table Structure

### **Core Fields**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name VARCHAR(255) NOT NULL UNIQUE
description TEXT
start_date TIMESTAMP WITH TIME ZONE NOT NULL
end_date TIMESTAMP WITH TIME ZONE NOT NULL
prize_pool VARCHAR(255)
max_teams INTEGER NOT NULL
rules TEXT
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Enhanced Fields**
```sql
status tournament_status_type DEFAULT 'Registration'
format tournament_format_type DEFAULT 'Single_Elimination'
registration_deadline TIMESTAMP WITH TIME ZONE
current_round INTEGER DEFAULT 0
total_rounds INTEGER DEFAULT 0
prize_distribution TEXT -- JSON string for prize distribution
bracket_settings TEXT -- JSON string for bracket-specific settings
is_active BOOLEAN DEFAULT true
parent_tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE
stage_order INTEGER DEFAULT 0 -- 0=Main/Standalone, 1=Stage 1, 2=Stage 2, etc.
stage_type VARCHAR(50) DEFAULT 'Main' -- 'Group_Stage', 'Playoffs', 'Qualifier'
```

### **Swiss-Specific Fields**
```sql
swiss_rounds INTEGER DEFAULT 5 -- Number of Swiss rounds
swiss_points_per_win INTEGER DEFAULT 3
swiss_points_per_draw INTEGER DEFAULT 1
swiss_points_per_loss INTEGER DEFAULT 0
top_cut_size INTEGER DEFAULT 8 -- Top cut to elimination bracket
enable_top_cut BOOLEAN DEFAULT false
```

## 🧩 Linked Tournaments (Multi-Stage)
The system supports linking multiple tournaments together to form a complete event series (e.g., Qualifiers → Group Stage → Playoffs).

### **Structure**
- **Parent Tournament**: The main container or the previous stage
- **Child Tournament**: The next stage, linked via `parent_tournament_id`
- **Stage Order**: Defines the sequence (1, 2, 3...)

### **Promotion Logic**
Teams can be promoted from one stage to another using the `promote_teams` function:
```sql
SELECT promote_teams(
    source_tournament_uuid,
    target_tournament_uuid,
    number_of_teams_to_promote
);
```

## 📊 Enums

### **tournament_status_type**
```sql
'Registration' → 'Registration_Closed' → 'Seeding' → 'In_Progress' → 'Completed' → 'Cancelled'
```

### **tournament_format_type**
```sql
'Single_Elimination', 'Double_Elimination', 'Round_Robin', 'Swiss'
```

## 🔗 Relationships

### **One-to-Many**
- `tournament_participants` - Teams registered in tournament
- `tournament_brackets` - Bracket structure for tournament
- `tournament_matches` - All matches in tournament
- `tournament_logs` - All tournament events and changes
- `tournament_admins` - Users with tournament management permissions
- `tournament_standings` - Final rankings and results
- `tournament_state_snapshots` - Historical state captures

### **Many-to-One**
- Created by users (via `tournament_admins`)

## 🎯 Usage Patterns

### **Creating a Tournament**
```sql
INSERT INTO tournaments (
    name, description, start_date, end_date, max_teams, format,
    registration_deadline, swiss_rounds, enable_top_cut
) VALUES (
    'Summer Championship 2024',
    'Annual summer LoL tournament',
    '2024-06-01 10:00:00',
    '2024-06-03 20:00:00',
    16,
    'Single_Elimination',
    '2024-05-28 23:59:59',
    NULL,
    false
);
```

### **Creating Swiss Tournament**
```sql
INSERT INTO tournaments (
    name, format, max_teams, swiss_rounds, enable_top_cut, top_cut_size,
    swiss_points_per_win, swiss_points_per_draw
) VALUES (
    'Swiss Qualifier 2024',
    'Swiss',
    32,
    7,
    true,
    8,
    3,
    1
);
```

### **Tournament Lifecycle**
1. **Registration** - Open for team registration
2. **Registration_Closed** - Deadline reached or max teams reached
3. **Seeding** - Teams are being seeded and bracket generated
4. **In_Progress** - Tournament is running, matches being played
5. **Completed** - Tournament finished, winners determined
6. **Cancelled** - Tournament cancelled for any reason

## 📈 Analytics Integration

### **Status Tracking**
- Monitor tournament progression through lifecycle
- Track registration progress vs. capacity
- Identify tournaments needing attention

### **Format Analysis**
- Compare popularity of different formats
- Analyze completion rates by format
- Optimize tournament settings based on data

### **Performance Metrics**
- Tournament duration vs. format
- Team participation rates
- Prize distribution effectiveness

## 🔧 Configuration Examples

### **Single Elimination Settings**
```json
{
  "bracket_type": "single_elimination",
  "third_place_match": true,
  "best_of_final": 5,
  "best_of_semifinals": 3,
  "best_of_quarterfinals": 3
}
```

### **Swiss Tournament Settings**
```json
{
  "swiss_rounds": 7,
  "points_per_win": 3,
  "points_per_draw": 1,
  "points_per_loss": 0,
  "top_cut_enabled": true,
  "top_cut_size": 8,
  "tiebreaker_system": "buchholz"
}
```

### **Prize Distribution**
```json
{
  "1st": "$1000 + Trophy",
  "2nd": "$500 + Medal", 
  "3rd": "$250 + Medal",
  "4th": "$100",
  "participation": "Digital badge"
}
```

## 🛡️ Security Considerations

### **Access Control**
- Only tournament admins can modify tournament settings
- Public read access for basic tournament info
- Admin actions logged in `tournament_logs`

### **Data Validation**
- Start date must be before end date
- Registration deadline must be before start date
- Max teams must be reasonable for format
- Swiss settings must be consistent

## 📝 Best Practices

### **Tournament Planning**
1. Set realistic registration deadlines
2. Choose appropriate format for team count
3. Configure clear rules and prize structure
4. Plan for sufficient time between rounds

### **Swiss Tournaments**
1. Limit to 5-9 rounds for practicality
2. Consider top cut for large tournaments
3. Use clear point systems
4. Plan for tiebreaker scenarios

### **Single Elimination**
1. Use power of 2 team counts when possible
2. Consider third-place match for completeness
3. Plan bye distribution carefully
4. Allow adequate time for each round

## 🔄 Migration Notes

### **Version History**
- **v1.0**: Basic tournament fields
- **v2.0**: Added status and format fields
- **v3.0**: Added Swiss tournament support
- **v4.0**: Enhanced configuration and lifecycle management

### **Backward Compatibility**
- All new fields have sensible defaults
- Existing tournaments continue to work
- Format-specific fields are nullable

This table serves as the central hub for tournament management, with all other tournament-related tables referencing it for context and relationships.
