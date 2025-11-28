-- Comprehensive Tournament System with Brackets and Match Management
-- Run this in your Supabase SQL editor

-- Tournament Status Types
CREATE TYPE tournament_status_type AS ENUM (
    'Registration', 
    'Registration_Closed', 
    'Seeding', 
    'In_Progress', 
    'Completed', 
    'Cancelled'
);

-- Match Status Types
CREATE TYPE match_status_type AS ENUM (
    'Scheduled',
    'In_Progress',
    'Completed',
    'Cancelled'
);

-- Match Result Types
CREATE TYPE match_result_type AS ENUM (
    'Team1_Win',
    'Team2_Win',
    'Draw',
    'No_Show'
);

-- Tournament Format Types
CREATE TYPE tournament_format_type AS ENUM (
    'Single_Elimination',
    'Double_Elimination',
    'Round_Robin',
    'Swiss'
);

-- Update tournaments table with new fields
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS status tournament_status_type DEFAULT 'Registration',
ADD COLUMN IF NOT EXISTS format tournament_format_type DEFAULT 'Single_Elimination',
ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_distribution TEXT, -- JSON string for prize distribution
ADD COLUMN IF NOT EXISTS bracket_settings TEXT, -- JSON string for bracket-specific settings
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Tournament Matches Table (create before brackets that reference it)
CREATE TABLE tournament_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bracket_id UUID NOT NULL,
    tournament_id UUID NOT NULL,
    team1_id UUID,
    team2_id UUID,
    winner_id UUID,
    status match_status_type DEFAULT 'Scheduled',
    result match_result_type,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    match_number INTEGER NOT NULL, -- Order within the round
    best_of INTEGER DEFAULT 1, -- Best of 1, 3, 5, etc.
    team1_score INTEGER DEFAULT 0,
    team2_score INTEGER DEFAULT 0,
    match_room TEXT, -- Custom game room info
    stream_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (winner_id) REFERENCES teams(id) ON DELETE SET NULL,
    CHECK (team1_id IS NULL OR team2_id IS NULL OR team1_id != team2_id),
    CHECK (status != 'Completed' OR winner_id IS NOT NULL),
    CHECK (team1_score >= 0 AND team2_score >= 0)
);

-- Tournament Brackets Table
CREATE TABLE tournament_brackets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    round_number INTEGER NOT NULL,
    bracket_position INTEGER NOT NULL, -- Position in bracket (1, 2, 3, etc.)
    parent_match_id UUID, -- For winner bracket progression (single elimination)
    winner_bracket_match_id UUID, -- For double elimination winner bracket
    loser_bracket_match_id UUID, -- For double elimination loser bracket
    is_final BOOLEAN DEFAULT false,
    is_third_place BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL,
    FOREIGN KEY (winner_bracket_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL,
    FOREIGN KEY (loser_bracket_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL,
    UNIQUE(tournament_id, round_number, bracket_position)
);

-- Add the missing foreign key constraint from matches to brackets
ALTER TABLE tournament_matches 
ADD CONSTRAINT fk_tournament_matches_bracket_id 
FOREIGN KEY (bracket_id) REFERENCES tournament_brackets(id) ON DELETE CASCADE;

-- Match Games Table (for individual games within a match)
CREATE TABLE tournament_match_games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL,
    game_number INTEGER NOT NULL,
    winner_id UUID NOT NULL,
    duration INTEGER, -- Game duration in seconds
    game_data TEXT, -- JSON string for additional game stats
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (match_id) REFERENCES tournament_matches(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(match_id, game_number)
);

-- Tournament Participants Table (extended registration info)
CREATE TABLE tournament_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    team_id UUID NOT NULL,
    seed_number INTEGER, -- Tournament seed (1, 2, 3, etc.)
    initial_bracket_position INTEGER, -- Starting position in bracket
    is_active BOOLEAN DEFAULT true,
    registration_data TEXT, -- JSON for additional registration info
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, team_id)
);

-- Tournament Standings Table
CREATE TABLE tournament_standings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    team_id UUID NOT NULL,
    placement INTEGER NOT NULL,
    points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    prize_awarded TEXT, -- Description or amount of prize
    is_final BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, team_id)
);

-- Tournament Admins Table
CREATE TABLE tournament_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(50) DEFAULT 'admin', -- admin, moderator, observer
    permissions TEXT, -- JSON string for specific permissions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, user_id)
);

-- Tournament Logs Table (for audit trail)
CREATE TABLE tournament_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_format ON tournaments(format);
-- Note: idx_tournaments_start_date already exists in original schema
CREATE INDEX IF NOT EXISTS idx_tournaments_is_active ON tournaments(is_active);

CREATE INDEX IF NOT EXISTS idx_tournament_brackets_tournament_id ON tournament_brackets(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_round_number ON tournament_brackets(round_number);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_parent_match ON tournament_brackets(parent_match_id);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket_id ON tournament_matches(bracket_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team1 ON tournament_matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team2 ON tournament_matches(team2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_scheduled_at ON tournament_matches(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_tournament_match_games_match_id ON tournament_match_games(match_id);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_id ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_team_id ON tournament_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_seed_number ON tournament_participants(seed_number);

CREATE INDEX IF NOT EXISTS idx_tournament_standings_tournament_id ON tournament_standings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_standings_placement ON tournament_standings(placement);

CREATE INDEX IF NOT EXISTS idx_tournament_admins_tournament_id ON tournament_admins(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_admins_user_id ON tournament_admins(user_id);

CREATE INDEX IF NOT EXISTS idx_tournament_logs_tournament_id ON tournament_logs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_created_at ON tournament_logs(created_at);

-- Add updated_at triggers for new tables
CREATE TRIGGER update_tournament_brackets_updated_at BEFORE UPDATE ON tournament_brackets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_matches_updated_at BEFORE UPDATE ON tournament_matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_participants_updated_at BEFORE UPDATE ON tournament_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_standings_updated_at BEFORE UPDATE ON tournament_standings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_match_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tournaments (everyone can read, only admins can write)
CREATE POLICY "Anyone can view tournaments" ON tournaments
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tournaments" ON tournaments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tournament admins can update tournaments" ON tournaments
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_id = id
        )
    );

-- RLS Policies for tournament matches
CREATE POLICY "Anyone can view tournament matches" ON tournament_matches
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage matches" ON tournament_matches
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_matches.tournament_id
        )
    );

-- RLS Policies for tournament participants
CREATE POLICY "Anyone can view tournament participants" ON tournament_participants
    FOR SELECT USING (true);

CREATE POLICY "Tournament admins can manage participants" ON tournament_participants
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM tournament_admins 
            WHERE tournament_admins.tournament_id = tournament_participants.tournament_id
        )
    );

-- Similar policies for other tables...
