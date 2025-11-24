-- Create a VIEW that includes teams with their players
-- Run this in your Supabase SQL editor

-- Drop the view if it exists (for updates)
DROP VIEW IF EXISTS team_with_players;

-- Create the VIEW that joins teams with their players
CREATE VIEW team_with_players AS
SELECT
  t.*,
  json_agg(
    json_build_object(
      'id', p.id,
      'summoner_name', p.summoner_name,
      'discord', p.discord,
      'main_role', p.main_role,
      'secondary_role', p.secondary_role,
      'tier', p.tier,
      'opgg_link', p.opgg_link,
      'looking_for_team', p.looking_for_team
    )
  ) FILTER (WHERE p.id IS NOT NULL) AS players,
  json_agg(
    json_build_object(
      'id', p.id,
      'summoner_name', p.summoner_name,
      'main_role', p.main_role,
      'tier', p.tier
    )
  ) FILTER (WHERE p.id IS NOT NULL) AS team_members
FROM teams t
LEFT JOIN players p ON p.team_id = t.id
GROUP BY t.id, t.name, t.description, t.captain_id, t.open_positions, t.team_size, t.recruiting_status, t.created_at, t.updated_at;

-- Create a simpler version for basic API responses
CREATE VIEW team_with_basic_players AS
SELECT
  t.*,
  json_agg(
    json_build_object(
      'id', p.id,
      'summoner_name', p.summoner_name,
      'main_role', p.main_role,
      'tier', p.tier
    )
  ) FILTER (WHERE p.id IS NOT NULL) AS players
FROM teams t
LEFT JOIN players p ON p.team_id = t.id
GROUP BY t.id, t.name, t.description, t.captain_id, t.open_positions, t.team_size, t.recruiting_status, t.created_at, t.updated_at;

-- Grant permissions (if needed)
-- GRANT SELECT ON team_with_players TO authenticated;
-- GRANT SELECT ON team_with_basic_players TO authenticated;

-- Test the view
-- SELECT * FROM team_with_players WHERE id = 'your-team-id-here';
-- SELECT * FROM team_with_basic_players WHERE recruiting_status = 'Open';
