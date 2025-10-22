-- Manual migration to add current_journey_id column to session_participants table
-- Run this SQL command directly on your database if the automatic migration fails

ALTER TABLE session_participants 
ADD COLUMN current_journey_id INTEGER NULL;

-- Add foreign key constraint if journeys table exists
-- ALTER TABLE session_participants 
-- ADD CONSTRAINT fk_session_participants_current_journey 
-- FOREIGN KEY (current_journey_id) REFERENCES journeys(id) 
-- ON UPDATE CASCADE ON DELETE SET NULL;

-- Verify the column was added
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'session_participants' AND column_name = 'current_journey_id';
