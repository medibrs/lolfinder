-- Migration: Normalize tournament_registrations status values to lowercase
-- This migration converts legacy capitalized status values to the new lowercase format

-- Update 'Confirmed' to 'approved'
UPDATE tournament_registrations 
SET status = 'approved' 
WHERE status = 'Confirmed';

-- Update 'Pending' to 'pending'
UPDATE tournament_registrations 
SET status = 'pending' 
WHERE status = 'Pending';

-- Update 'Rejected' to 'rejected'
UPDATE tournament_registrations 
SET status = 'rejected' 
WHERE status = 'Rejected';
