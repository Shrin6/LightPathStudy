-- Remove alpha key system
-- Drop alpha_activated column from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS alpha_activated CASCADE;

-- Drop alpha_keys table
DROP TABLE IF EXISTS alpha_keys CASCADE;
