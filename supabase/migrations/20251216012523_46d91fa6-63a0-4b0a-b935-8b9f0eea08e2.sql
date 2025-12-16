-- Make embeddings best-effort: allow NULL embeddings when generation fails
ALTER TABLE public.document_chunks
ALTER COLUMN embedding DROP NOT NULL;