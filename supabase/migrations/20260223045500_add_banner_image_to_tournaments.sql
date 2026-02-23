-- Add banner_image column to tournaments table if it doesn't exist
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS banner_image VARCHAR(500);
