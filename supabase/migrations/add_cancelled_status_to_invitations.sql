-- Add 'cancelled' status to team_invitations status constraint
-- Run this in your Supabase SQL editor

-- First, drop the existing constraint
ALTER TABLE team_invitations DROP CONSTRAINT team_invitations_status_check;

-- Then add the new constraint with 'cancelled' included
ALTER TABLE team_invitations 
ADD CONSTRAINT team_invitations_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled'));

-- Verify the constraint was updated
\d team_invitations
