-- Alter embedding column to support 1536 dimensions (text-embedding-3-small)
ALTER TABLE public.document_chunks 
ALTER COLUMN embedding TYPE vector(1536);