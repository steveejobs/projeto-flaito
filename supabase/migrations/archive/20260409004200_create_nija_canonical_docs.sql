-- Migration: 20260409004200_create_nija_canonical_docs.sql
-- Goal: Create central repository for Stage 0 (Canonical Pre-processing) results.

CREATE TABLE IF NOT EXISTS public.nija_canonical_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
    checksum text NOT NULL, -- SHA-256 for reproducibility
    
    -- Processing Metadata
    source_mime_type text,
    processor_version text NOT NULL DEFAULT '1.0.0',
    parser_type text, -- 'native_pdf', 'ocr_pdf', 'docx', 'image'
    cleanup_rules_version text NOT NULL DEFAULT 'v1',
    ocr_engine_version text,
    
    -- Core Content
    canonical_markdown text NOT NULL,
    section_index jsonb NOT NULL DEFAULT '[]', -- [{ "section_id": "...", "title": "...", "start_pos": 0 }]
    raw_text_backup text,
    
    -- Quality & Status
    input_quality_score text CHECK (input_quality_score IN ('GOOD', 'NOISY', 'BROKEN')),
    processing_status text DEFAULT 'PENDING' CHECK (processing_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    has_text_layer boolean DEFAULT false,
    page_count integer,
    
    -- Error Handling
    error_code text,
    error_details text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Ensure same document + same version yields one record
    UNIQUE(checksum, processor_version, cleanup_rules_version)
);

-- RLS
ALTER TABLE public.nija_canonical_documents ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nija_canonical_documents' AND policyname = 'office_isolation_canonical'
    ) THEN
        CREATE POLICY "office_isolation_canonical"
        ON public.nija_canonical_documents
        FOR ALL
        TO authenticated
        USING (
            document_id IN (
                SELECT id FROM documents WHERE office_id IN (
                    SELECT office_id FROM office_members WHERE user_id = auth.uid()
                )
            )
        );
    END IF;
END $$;

-- Indices
CREATE INDEX IF NOT EXISTS nija_canonical_documents_document_id_idx ON public.nija_canonical_documents(document_id);
CREATE INDEX IF NOT EXISTS nija_canonical_documents_checksum_idx ON public.nija_canonical_documents(checksum);

-- Updated At
CREATE OR REPLACE FUNCTION update_nija_canonical_docs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_canonical_docs_updated_at') THEN
        CREATE TRIGGER set_canonical_docs_updated_at
        BEFORE UPDATE ON public.nija_canonical_documents
        FOR EACH ROW EXECUTE FUNCTION update_nija_canonical_docs_updated_at();
    END IF;
END $$;
