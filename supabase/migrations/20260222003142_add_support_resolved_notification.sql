DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'support_resolved' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'support_resolved';
    END IF;
END $$;
