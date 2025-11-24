-- SQL code to add notifications and team invitation system
-- Run this in your Supabase SQL editor

-- Create notification_type enum
CREATE TYPE notification_type AS ENUM ('team_invite', 'team_join_request', 'team_leave', 'team_member_joined', 'team_member_left');

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional data like team_id, from_user_id, etc.
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create team_invitations table for managing team invites
CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    invited_player_id UUID NOT NULL,
    invited_by UUID NOT NULL, -- Who sent the invite
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(team_id, invited_player_id, status) -- Prevent duplicate pending invites
);

-- Create indexes for better performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_invited_player_id ON team_invitations(invited_player_id);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);

-- Add updated_at trigger function for team_invitations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for team_invitations
CREATE TRIGGER update_team_invitations_updated_at 
    BEFORE UPDATE ON team_invitations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verify tables were created
\d notifications
\d team_invitations
