-- First, check what values exist in the enum
DO $$ 
DECLARE
    enum_exists boolean;
BEGIN
    -- Check if the enum type exists
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'registration_status_type'
    ) INTO enum_exists;
    
    IF NOT enum_exists THEN
        -- Create the enum if it doesn't exist
        CREATE TYPE registration_status_type AS ENUM ('pending', 'approved', 'rejected');
    ELSE
        -- Add missing values to existing enum
        -- Add 'pending' if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'pending' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'registration_status_type')
        ) THEN
            ALTER TYPE registration_status_type ADD VALUE IF NOT EXISTS 'pending';
        END IF;
        
        -- Add 'approved' if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'approved' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'registration_status_type')
        ) THEN
            ALTER TYPE registration_status_type ADD VALUE IF NOT EXISTS 'approved';
        END IF;
        
        -- Add 'rejected' if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'rejected' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'registration_status_type')
        ) THEN
            ALTER TYPE registration_status_type ADD VALUE IF NOT EXISTS 'rejected';
        END IF;
    END IF;
END $$;

-- Ensure the column exists and has the right type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tournament_registrations' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE tournament_registrations 
        ADD COLUMN status registration_status_type DEFAULT 'pending';
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN tournament_registrations.status IS 'Registration status: pending (awaiting admin approval), approved (accepted by admin), rejected (denied by admin)';
