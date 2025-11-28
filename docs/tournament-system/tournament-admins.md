# Tournament Admins Table

## 📋 Overview
The `tournament_admins` table manages user permissions and access control for tournament management. It defines who can administer tournaments and what specific actions they can perform, providing granular security and accountability.

## 🏗️ Enhanced Table Structure

### **Core Fields**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
tournament_id UUID NOT NULL
user_id UUID NOT NULL
role VARCHAR(50) DEFAULT 'admin' -- 'admin', 'moderator', 'observer'
permissions TEXT -- JSON string for specific permissions
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### **Enhanced Permission Fields**
```sql
can_override_matches BOOLEAN DEFAULT false -- Change match results
can_disqualify_teams BOOLEAN DEFAULT false -- Remove teams mid-tournament
can_edit_bracket BOOLEAN DEFAULT false -- Manual bracket changes
can_reschedule_matches BOOLEAN DEFAULT false -- Change match times
can_replace_teams BOOLEAN DEFAULT false -- Substitute teams
can_force_advance BOOLEAN DEFAULT false -- Skip rounds for teams
```

### **Constraints**
```sql
UNIQUE(tournament_id, user_id)
FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
```

## 🔗 Relationships

### **Belongs To**
- `tournaments` - The tournament being administered
- `auth.users` - The user with admin privileges

### **Indirect Relationships**
- `tournament_logs` - Actions performed by this admin
- `tournament_bracket_adjustments` - Changes made by this admin
- `tournament_issues` - Problems resolved by this admin

## 🎯 Usage Patterns

### **Basic Admin Assignment**
```sql
-- Assign user as tournament admin
INSERT INTO tournament_admins (
    tournament_id, user_id, role, permissions
) VALUES (
    tournament_uuid, user_uuid, 'admin',
    '{"all_permissions": true}'
);
```

### **Limited Permission Admin**
```sql
-- Assign moderator with limited permissions
INSERT INTO tournament_admins (
    tournament_id, user_id, role, 
    can_reschedule_matches, can_override_matches
) VALUES (
    tournament_uuid, user_uuid, 'moderator',
    true, false
);
```

### **Observer Role**
```sql
-- Assign observer (read-only access)
INSERT INTO tournament_admins (
    tournament_id, user_id, role, permissions
) VALUES (
    tournament_uuid, user_uuid, 'observer',
    '{"read_only": true}'
);
```

## 📊 Admin Role Definitions

### **Tournament Admin** (Full Access)
```json
{
  "all_permissions": true,
  "can_override_matches": true,
  "can_disqualify_teams": true,
  "can_edit_bracket": true,
  "can_reschedule_matches": true,
  "can_replace_teams": true,
  "can_force_advance": true,
  "can_manage_admins": true,
  "can_delete_tournament": true
}
```

### **Moderator** (Limited Access)
```json
{
  "can_reschedule_matches": true,
  "can_override_matches": false,
  "can_disqualify_teams": false,
  "can_edit_bracket": false,
  "can_replace_teams": false,
  "can_force_advance": false,
  "read_only": false
}
```

### **Observer** (Read-Only)
```json
{
  "read_only": true,
  "can_view_sensitive_data": false,
  "can_export_data": false
}
```

## 🔄 Admin Management Functions

### **Create Tournament with Admin**
```sql
CREATE OR REPLACE FUNCTION create_tournament_with_admin(
    name_param TEXT, description_param TEXT,
    start_date_param TIMESTAMP WITH TIME ZONE, end_date_param TIMESTAMP WITH TIME ZONE,
    max_teams_param INTEGER, format_param tournament_format_type
) RETURNS UUID AS $$
DECLARE
    tournament_id UUID;
BEGIN
    -- Create tournament
    INSERT INTO tournaments (
        name, description, start_date, end_date, max_teams, format
    ) VALUES (
        name_param, description_param, start_date_param, end_date_param, 
        max_teams_param, format_param
    ) RETURNING id INTO tournament_id;
    
    -- Make creator an admin
    INSERT INTO tournament_admins (
        tournament_id, user_id, role, permissions,
        can_override_matches, can_disqualify_teams, can_edit_bracket,
        can_reschedule_matches, can_replace_teams, can_force_advance
    ) VALUES (
        tournament_id, auth.uid(), 'admin', '{"all_permissions": true}',
        true, true, true, true, true, true
    );
    
    -- Log the creation
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        tournament_id, 'TOURNAMENT_CREATED', 
        'Tournament created with admin privileges', auth.uid()
    );
    
    RETURN tournament_id;
END;
$$ LANGUAGE plpgsql;
```

### **Add Admin with Permissions**
```sql
CREATE OR REPLACE FUNCTION add_tournament_admin(
    tournament_id UUID, user_id UUID, role VARCHAR(50),
    permission_json TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Validate permissions based on role
    IF role = 'admin' AND permission_json IS NULL THEN
        permission_json := '{"all_permissions": true}';
    ELSIF role = 'moderator' AND permission_json IS NULL THEN
        permission_json := '{"can_reschedule_matches": true}';
    ELSIF role = 'observer' AND permission_json IS NULL THEN
        permission_json := '{"read_only": true}';
    END IF;
    
    -- Add the admin
    INSERT INTO tournament_admins (
        tournament_id, user_id, role, permissions
    ) VALUES (
        tournament_id, user_id, role, permission_json
    );
    
    -- Log the admin addition
    INSERT INTO tournament_logs (
        tournament_id, action, details, user_id
    ) VALUES (
        tournament_id, 'ADMIN_ADDED',
        'User added as ' || role || ' with permissions: ' || permission_json,
        auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### **Check Admin Permissions**
```sql
CREATE OR REPLACE FUNCTION has_admin_permission(
    tournament_id UUID, user_id UUID, permission VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
    admin_record RECORD;
    permission_json JSONB;
BEGIN
    -- Get admin record
    SELECT * INTO admin_record
    FROM tournament_admins
    WHERE tournament_id = tournament_id
    AND user_id = user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check for all permissions
    permission_json := admin_record.permissions::JSONB;
    IF permission_json->>'all_permissions' = 'true' THEN
        RETURN TRUE;
    END IF;
    
    -- Check specific permission
    RETURN (permission_json->>permission) = 'true';
END;
$$ LANGUAGE plpgsql;
```

## 📈 Admin Analytics

### **Admin Activity Dashboard**
```sql
-- Comprehensive admin activity tracking
SELECT 
    u.email as admin_email,
    u.raw_user_meta_data->>'full_name' as admin_name,
    ta.role,
    COUNT(tl.id) as total_actions,
    COUNT(CASE WHEN tl.impact_level = 'critical' THEN 1 END) as critical_actions,
    COUNT(CASE WHEN tl.event_category = 'admin' THEN 1 END) as admin_decisions,
    MAX(tl.created_at) as last_action,
    STRING_AGG(DISTINCT tl.action, ', ') as action_types,
    ta.permissions
FROM tournament_admins ta
JOIN auth.users u ON ta.user_id = u.id
LEFT JOIN tournament_logs tl ON ta.tournament_id = tl.tournament_id AND ta.user_id = tl.user_id
WHERE ta.tournament_id = tournament_uuid
GROUP BY u.email, u.raw_user_meta_data->>'full_name', ta.role, ta.permissions
ORDER BY total_actions DESC;
```

### **Permission Usage Analysis**
```sql
-- How often different permissions are used
SELECT 
    ta.role,
    ta.can_override_matches,
    COUNT(CASE WHEN tl.action = 'MATCH_RESULT_OVERRIDDEN' THEN 1 END) as override_usage,
    ta.can_disqualify_teams,
    COUNT(CASE WHEN tl.action = 'TEAM_DISQUALIFIED' THEN 1 END) as disqualify_usage,
    ta.can_reschedule_matches,
    COUNT(CASE WHEN tl.action = 'MATCH_RESCHEDULED' THEN 1 END) as reschedule_usage,
    COUNT(tl.id) as total_admin_actions
FROM tournament_admins ta
LEFT JOIN tournament_logs tl ON ta.tournament_id = tl.tournament_id AND ta.user_id = tl.user_id
WHERE ta.tournament_id = tournament_uuid
GROUP BY ta.role, ta.can_override_matches, ta.can_disqualify_teams, ta.can_reschedule_matches;
```

### **Admin Performance Metrics**
```sql
-- Admin effectiveness and responsibility metrics
SELECT 
    u.email as admin_email,
    COUNT(tl.id) as actions_taken,
    AVG(EXTRACT(EPOCH FROM (tl.created_at - t.start_date))/3600) as avg_response_time_hours,
    COUNT(CASE WHEN tl.impact_level = 'critical' THEN 1 END) as critical_handled,
    COUNT(CASE WHEN tl.public_visible = true THEN 1 END) as public_actions,
    ROUND(COUNT(CASE WHEN tl.impact_level = 'critical' THEN 1 END) * 100.0 / NULLIF(COUNT(tl.id), 0), 2) as critical_percentage
FROM tournament_admins ta
JOIN auth.users u ON ta.user_id = u.id
JOIN tournaments t ON ta.tournament_id = t.id
LEFT JOIN tournament_logs tl ON ta.tournament_id = tl.tournament_id AND ta.user_id = tl.user_id
WHERE ta.tournament_id = tournament_uuid
GROUP BY u.email
ORDER BY actions_taken DESC;
```

## 🛡️ Security and Access Control

### **Row Level Security Policies**
```sql
-- Admins can view other admins for same tournament
CREATE POLICY "Admins can view tournament admins" ON tournament_admins
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_admins.tournament_id
        )
    );

-- Only admins can manage other admins
CREATE POLICY "Admins can manage tournament admins" ON tournament_admins
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_admins.tournament_id
            AND role = 'admin'
        )
    );
```

### **Permission Validation**
```sql
-- Function to validate admin permissions before actions
CREATE OR REPLACE FUNCTION validate_admin_action(
    tournament_id UUID, required_permission VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    SELECT has_admin_permission(tournament_id, auth.uid(), required_permission)
    INTO is_admin;
    
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Insufficient permissions for %', required_permission;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 📝 Best Practices

### **Admin Role Assignment**
1. Use principle of least privilege
2. Assign admin role only to trusted users
3. Use moderator role for limited permissions
4. Observer role for viewing access only
5. Document permission changes

### **Permission Management**
1. Regular audit of admin permissions
2. Remove access when no longer needed
3. Use specific permissions over "all_permissions"
4. Log all permission changes
5. Implement approval workflows for sensitive actions

### **Security Considerations**
1. Validate permissions on every action
2. Use RLS for database-level security
3. Implement session management for admin access
4. Monitor admin activity for anomalies
5. Backup admin assignment history

## 🔄 Migration Notes

### **Version History**
- **v1.0**: Basic admin assignment with roles
- **v2.0**: Added JSON permissions field
- **v3.0**: Enhanced with granular permission flags
- **v4.0**: Added comprehensive permission validation

### **Backward Compatibility**
- Existing admin assignments continue to work
- JSON permissions default to role-based defaults
- New permission flags are optional enhancements

This table provides the foundation for secure tournament management, ensuring that only authorized users can perform specific actions while maintaining complete audit trails and accountability.
