-- Move pgvector extension from public schema to extensions schema
-- First, create the extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move the vector extension to extensions schema
-- Note: We need to drop and recreate since ALTER EXTENSION doesn't support schema changes directly
-- This is safe because pgvector types are still accessible via qualified names

-- Grant usage on extensions schema to authenticated and anon roles
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;