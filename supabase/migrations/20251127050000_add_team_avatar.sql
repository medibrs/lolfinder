-- Add team_avatar column to teams table
ALTER TABLE teams 
ADD COLUMN team_avatar INTEGER;

-- Add comment to explain the avatar ID system
COMMENT ON COLUMN teams.team_avatar IS 'Profile icon ID from League of Legends (3905-4016), referencing https://ddragon.leagueoflegends.com/cdn/15.23.1/img/profileicon/<id>.png';
