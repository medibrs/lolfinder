-- Create Riot API request logging table
-- This will track all Riot API calls for rate limit monitoring

CREATE TABLE IF NOT EXISTS riot_request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'GET',
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    riot_api_endpoint VARCHAR(255) NOT NULL,
    summoner_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_riot_logs_user_id ON riot_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_riot_logs_created_at ON riot_request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_riot_logs_endpoint ON riot_request_logs(riot_api_endpoint);
CREATE INDEX IF NOT EXISTS idx_riot_logs_status_code ON riot_request_logs(status_code);

-- Create index for rate limit monitoring (last minute/10 seconds queries)
CREATE INDEX IF NOT EXISTS idx_riot_logs_recent ON riot_request_logs(created_at DESC, riot_api_endpoint);

-- Enable RLS
ALTER TABLE riot_request_logs ENABLE ROW LEVEL SECURITY;

-- Policies (admin can read all, users can read their own)
CREATE POLICY "Enable read access for admins" ON riot_request_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'admin'
    )
);

CREATE POLICY "Enable read own logs" ON riot_request_logs FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Enable insert for authenticated" ON riot_request_logs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Enable insert for system" ON riot_request_logs FOR INSERT WITH CHECK (true);
