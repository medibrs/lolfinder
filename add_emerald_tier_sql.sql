-- SQL code to add Emerald tier to the tier_type enum
-- Run this in your Supabase SQL editor

-- Add Emerald to the tier_type enum
ALTER TYPE tier_type ADD VALUE 'Emerald' BEFORE 'Diamond';

-- Verify the change
SELECT unnest(enum_range(NULL::tier_type));
