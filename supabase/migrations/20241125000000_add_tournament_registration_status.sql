-- Add new enum values if they don't exist
DO $$ 
BEGIN
    -- Add 'pending' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pending' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'registration_status_type')
    ) THEN
        ALTER TYPE registration_status_type ADD VALUE 'pending';
    END IF;
    
    -- Add 'approved' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'approved' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'registration_status_type')
    ) THEN
        ALTER TYPE registration_status_type ADD VALUE 'approved';
    END IF;
    
    -- Add 'rejected' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'rejected' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'registration_status_type')
    ) THEN
        ALTER TYPE registration_status_type ADD VALUE 'rejected';
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN tournament_registrations.status IS 'Registration status: pending (awaiting admin approval), approved (accepted by admin), rejected (denied by admin)';
