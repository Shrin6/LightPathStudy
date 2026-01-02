-- Recreate the embedding column with the new schema-qualified vector type
ALTER TABLE public.document_chunks 
  DROP COLUMN IF EXISTS embedding,
  ADD COLUMN embedding extensions.vector;

-- Recreate the match_document_chunks function to use extensions.vector
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding text, 
  match_collection_id uuid, 
  match_user_id uuid,
  match_count integer DEFAULT 10
)
RETURNS TABLE(id uuid, file_id uuid, chunk_text text, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.file_id,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding::extensions.vector) AS similarity
  FROM document_chunks dc
  WHERE dc.collection_id = match_collection_id
    AND dc.user_id = match_user_id
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding::extensions.vector
  LIMIT match_count;
END;
$$;