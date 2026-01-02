-- Properly move vector extension to extensions schema
-- Drop the extension from public and recreate in extensions
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;