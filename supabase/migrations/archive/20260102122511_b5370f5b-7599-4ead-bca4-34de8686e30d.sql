-- =============================================================================
-- MIGRATION: Enforce 1 Client = 1 Kit (prevent duplicates + cascade delete)
-- =============================================================================

-- 1. Add client_id column to documents table with FK CASCADE
ALTER TABLE public.documents 
ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;

-- 2. Create index for performance
CREATE INDEX idx_documents_client_id ON public.documents(client_id);

-- 3. Migrate existing metadata->>'client_id' values to the new column
UPDATE public.documents 
SET client_id = (metadata->>'client_id')::uuid
WHERE client_id IS NULL 
  AND metadata->>'client_id' IS NOT NULL
  AND metadata->>'client_id' != '';

-- 4. Clean up duplicate client_files (keep only the most recent per client+kind)
DELETE FROM public.client_files cf1
WHERE EXISTS (
  SELECT 1 FROM public.client_files cf2
  WHERE cf2.client_id = cf1.client_id
    AND cf2.kind = cf1.kind
    AND cf2.uploaded_at > cf1.uploaded_at
);

-- 5. Clean up duplicate documents for CLIENT_KIT scope (keep only the most recent)
-- Now client_id column exists from step 1
DELETE FROM public.documents d1
WHERE d1.metadata->>'scope' = 'CLIENT_KIT'
  AND d1.client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.documents d2
    WHERE d2.client_id = d1.client_id
      AND d2.kind = d1.kind
      AND d2.metadata->>'scope' = 'CLIENT_KIT'
      AND d2.uploaded_at > d1.uploaded_at
  );

-- 6. Clean up duplicate generated_docs_legacy (keep only the most recent)
DELETE FROM public.generated_docs_legacy g1
WHERE g1.client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.generated_docs_legacy g2
    WHERE g2.client_id = g1.client_id
      AND g2.kind = g1.kind
      AND g2.created_at > g1.created_at
  );

-- 7. Add unique constraint on client_files to prevent future duplicates
ALTER TABLE public.client_files 
ADD CONSTRAINT uq_client_files_client_kind UNIQUE (client_id, kind);

-- 8. Add column comment for documentation
COMMENT ON COLUMN public.documents.client_id IS 'FK to clients with CASCADE delete - ensures documents are removed when client is deleted';