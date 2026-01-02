-- Fix Critical Issue 1: Public Profile Exposure
-- Drop the overly permissive SELECT policy on profiles table
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a restrictive policy for own profile only
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- Fix Critical Issue 2: Secure the Vector Search Function
-- Drop and recreate the function with user_id validation
DROP FUNCTION IF EXISTS public.match_document_chunks(text, uuid, integer);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding text, 
  match_collection_id uuid, 
  match_user_id uuid,
  match_count integer DEFAULT 10
)
RETURNS TABLE(id uuid, file_id uuid, chunk_text text, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.file_id,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding::vector) AS similarity
  FROM document_chunks dc
  WHERE dc.collection_id = match_collection_id
    AND dc.user_id = match_user_id
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;