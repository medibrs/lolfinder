-- Update tier_type enum to include Emerald and Unranked
-- This ensures the database accepts these new values

DO $$
BEGIN
    -- Check if tier_type exists (it likely does if tiers are enforced)
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tier_type') THEN
        -- Add 'Emerald' if it doesn't exist
        ALTER TYPE tier_type ADD VALUE IF NOT EXISTS 'Emerald';
        
        -- Add 'Unranked' if it doesn't exist
        ALTER TYPE tier_type ADD VALUE IF NOT EXISTS 'Unranked';
    END IF;
END $$;
