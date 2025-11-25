-- Add missing notification types for admin messages and tournament notifications

-- Add 'admin_message' type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin_message' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'admin_message';
    END IF;
END $$;

-- Add 'tournament_approved' type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tournament_approved' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'tournament_approved';
    END IF;
END $$;

-- Add 'tournament_rejected' type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tournament_rejected' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'tournament_rejected';
    END IF;
END $$;

-- Add 'team_invitation_cancelled' type (if missing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'team_invitation_cancelled' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'team_invitation_cancelled';
    END IF;
END $$;
