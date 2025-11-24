-- Add status column to tournament_registrations
ALTER TABLE tournament_registrations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add comment
COMMENT ON COLUMN tournament_registrations.status IS 'Registration status: pending (awaiting admin approval), approved (accepted by admin), rejected (denied by admin)';

-- Update existing registrations to approved (assume they were already approved)
UPDATE tournament_registrations SET status = 'approved' WHERE status IS NULL;
