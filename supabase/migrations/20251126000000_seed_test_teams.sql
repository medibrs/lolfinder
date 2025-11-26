-- Seed 8 test teams with 5 players each for tournament testing
-- To remove: DELETE FROM players WHERE summoner_name LIKE 'Player%#TEST';
--            DELETE FROM teams WHERE description LIKE 'Test team % for tournament testing';

DO $$
DECLARE
    v_team_id UUID;
    v_player_id UUID;
    v_captain_id UUID;
    team_names TEXT[] := ARRAY['Alpha Wolves', 'Beta Dragons', 'Gamma Knights', 'Delta Phoenix', 'Epsilon Titans', 'Zeta Vipers', 'Eta Storm', 'Theta Legends'];
    roles TEXT[] := ARRAY['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
    tiers TEXT[] := ARRAY['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master'];
    i INT;
    j INT;
BEGIN
    FOR i IN 1..8 LOOP
        -- Generate IDs upfront
        v_team_id := gen_random_uuid();
        v_captain_id := gen_random_uuid();
        
        -- Create captain player first (without team_id to avoid circular dependency)
        INSERT INTO players (id, summoner_name, discord, main_role, secondary_role, tier, opgg_url)
        VALUES (
            v_captain_id,
            'Player' || ((i-1)*5 + 1) || '#TEST',
            'player' || ((i-1)*5 + 1) || '#0000',
            roles[1]::role_type,
            roles[2]::role_type,
            tiers[(random() * 7 + 1)::int]::tier_type,
            'https://op.gg/summoners/euw/Player' || ((i-1)*5 + 1)
        );
        
        -- Create team with captain
        INSERT INTO teams (id, name, description, recruiting_status, team_size, captain_id)
        VALUES (
            v_team_id,
            team_names[i],
            'Test team ' || i || ' for tournament testing',
            'Open',
            '5',
            v_captain_id
        );
        
        -- Update captain's team_id
        UPDATE players SET team_id = v_team_id WHERE id = v_captain_id;
        
        -- Create remaining 4 players for this team
        FOR j IN 2..5 LOOP
            v_player_id := gen_random_uuid();
            
            INSERT INTO players (id, summoner_name, discord, main_role, secondary_role, tier, team_id, opgg_url)
            VALUES (
                v_player_id,
                'Player' || ((i-1)*5 + j) || '#TEST',
                'player' || ((i-1)*5 + j) || '#0000',
                roles[j]::role_type,
                roles[((j % 5) + 1)]::role_type,
                tiers[(random() * 7 + 1)::int]::tier_type,
                v_team_id,
                'https://op.gg/summoners/euw/Player' || ((i-1)*5 + j)
            );
        END LOOP;
    END LOOP;
END $$;
