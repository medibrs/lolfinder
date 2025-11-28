-- Update team_with_players view to include profile_icon_id
-- Run this in your Supabase SQL editor

-- Drop the existing view
DROP VIEW IF EXISTS team_with_players;

-- Recreate the VIEW with profile_icon_id included
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
      'looking_for_team', p.looking_for_team,
      'profile_icon_id', p.profile_icon_id,
      'is_substitute', p.is_substitute
    )
  ) FILTER (WHERE p.id IS NOT NULL) AS players,
  json_agg(
    json_build_object(
      'id', p.id,
      'summoner_name', p.summoner_name,
      'main_role', p.main_role,
      'tier', p.tier,
      'profile_icon_id', p.profile_icon_id,
      'is_substitute', p.is_substitute
    )
  ) FILTER (WHERE p.id IS NOT NULL) AS team_members
FROM teams t
LEFT JOIN players p ON p.team_id = t.id
GROUP BY t.id, t.name, t.description, t.captain_id, t.open_positions, t.team_size, t.recruiting_status, t.created_at, t.updated_at;

-- Also update the basic view
DROP VIEW IF EXISTS team_with_basic_players;

CREATE VIEW team_with_basic_players AS
SELECT
  t.*,
  json_agg(
    json_build_object(
      'id', p.id,
      'summoner_name', p.summoner_name,
      'main_role', p.main_role,
      'tier', p.tier,
      'profile_icon_id', p.profile_icon_id,
      'is_substitute', p.is_substitute
    )
  ) FILTER (WHERE p.id IS NOT NULL) AS players
FROM teams t
LEFT JOIN players p ON p.team_id = t.id
GROUP BY t.id, t.name, t.description, t.captain_id, t.open_positions, t.team_size, t.recruiting_status, t.created_at, t.updated_at;
