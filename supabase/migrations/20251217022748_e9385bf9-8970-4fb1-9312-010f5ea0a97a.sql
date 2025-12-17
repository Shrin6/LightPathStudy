-- Update match_document_chunks to accept text parameter and cast to vector
-- Also filter out chunks with NULL embeddings
DROP FUNCTION IF EXISTS public.match_document_chunks(text, uuid, integer);
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, uuid, integer);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding text,
  match_collection_id uuid,
  match_count integer DEFAULT 10
)
RETURNS TABLE(id uuid, file_id uuid, chunk_text text, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.file_id,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding::vector) AS similarity
  FROM document_chunks dc
  WHERE dc.collection_id = match_collection_id
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$function$;