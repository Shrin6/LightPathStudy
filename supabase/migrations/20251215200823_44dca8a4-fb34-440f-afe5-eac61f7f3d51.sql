-- =====================================================
-- DATA REPAIR: Re-process chunks with NULL embeddings
-- This deletes corrupted rows that cannot be used for semantic search
-- =====================================================

-- First, log how many corrupted rows exist
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM document_chunks WHERE embedding IS NULL;
  RAISE NOTICE 'Found % chunks with NULL embeddings - these will be deleted', null_count;
END $$;

-- Delete chunks with NULL embeddings (they are corrupted and break semantic search)
DELETE FROM document_chunks WHERE embedding IS NULL;

-- =====================================================
-- ENFORCE NOT NULL CONSTRAINT on embedding column
-- This prevents future NULL embeddings from being inserted
-- =====================================================

-- Add NOT NULL constraint to embedding column
-- This will fail if there are any remaining NULL values (there shouldn't be after the DELETE above)
ALTER TABLE document_chunks 
ALTER COLUMN embedding SET NOT NULL;