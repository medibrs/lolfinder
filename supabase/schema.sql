-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE role_type AS ENUM ('Top', 'Jungle', 'Mid', 'ADC', 'Support');
CREATE TYPE tier_type AS ENUM ('Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Challenger');
CREATE TYPE region_type AS ENUM ('NA', 'EUW', 'EUNE', 'KR', 'BR', 'LAN', 'LAS', 'OCE', 'RU', 'TR', 'JP');
CREATE TYPE recruiting_status_type AS ENUM ('Open', 'Closed', 'Full');
CREATE TYPE registration_status_type AS ENUM ('Pending', 'Confirmed', 'Rejected');

-- Players Table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    summoner_name VARCHAR(255) NOT NULL,
    discord VARCHAR(255) NOT NULL,
    main_role role_type NOT NULL,
    secondary_role role_type,
    opgg_link VARCHAR(500),
    tier tier_type NOT NULL,
    region region_type NOT NULL,
    looking_for_team BOOLEAN DEFAULT false,
    team_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    captain_id UUID NOT NULL,
    open_positions role_type[] DEFAULT '{}',
    tier tier_type NOT NULL,
    region region_type NOT NULL,
    recruiting_status recruiting_status_type DEFAULT 'Open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (captain_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Add foreign key to players table
ALTER TABLE players
ADD CONSTRAINT fk_team
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- Tournaments Table
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    prize_pool VARCHAR(255),
    max_teams INTEGER NOT NULL,
    rules TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament Registrations Table
CREATE TABLE tournament_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    team_id UUID NOT NULL,
    status registration_status_type DEFAULT 'Pending',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, team_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_players_main_role ON players(main_role);
CREATE INDEX idx_players_tier ON players(tier);
CREATE INDEX idx_players_region ON players(region);
CREATE INDEX idx_players_looking_for_team ON players(looking_for_team);
CREATE INDEX idx_players_team_id ON players(team_id);

CREATE INDEX idx_teams_captain_id ON teams(captain_id);
CREATE INDEX idx_teams_tier ON teams(tier);
CREATE INDEX idx_teams_region ON teams(region);
CREATE INDEX idx_teams_recruiting_status ON teams(recruiting_status);

CREATE INDEX idx_tournaments_start_date ON tournaments(start_date);
CREATE INDEX idx_tournament_registrations_tournament_id ON tournament_registrations(tournament_id);
CREATE INDEX idx_tournament_registrations_team_id ON tournament_registrations(team_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_registrations_updated_at BEFORE UPDATE ON tournament_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for now - adjust based on your auth needs)
CREATE POLICY "Enable read access for all users" ON players FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON players FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON players FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON teams FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON teams FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON teams FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON tournaments FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON tournaments FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON tournament_registrations FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON tournament_registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON tournament_registrations FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON tournament_registrations FOR DELETE USING (true);
