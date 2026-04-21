-- Migration: 20260403170000_nija_doc_extractions.sql
-- Goal: Create a cache table for Stage 1 (Atomic Extraction) of the Dossier Engine V2.

CREATE TABLE nija_doc_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  office_id uuid REFERENCES offices(id),
  file_hash text,
  tipo_documento text,
  extraction_json jsonb NOT NULL,
  confidence_score float,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE nija_doc_extractions ENABLE ROW LEVEL SECURITY;

-- Policy for office isolation
CREATE POLICY "office_isolation" ON nija_doc_extractions
  USING (office_id = (SELECT office_id FROM profiles WHERE id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_nija_doc_ext_doc_id ON nija_doc_extractions(document_id);
CREATE INDEX idx_nija_doc_ext_case_id ON nija_doc_extractions(case_id);

COMMENT ON TABLE nija_doc_extractions IS 'Cache de extrações estruturadas (Etapa 1) por documento no motor NIJA V2.';
