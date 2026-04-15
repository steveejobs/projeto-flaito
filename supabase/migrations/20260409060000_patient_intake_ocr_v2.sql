-- Migration: 20260409060000_patient_intake_ocr_v2.sql
-- Goal: Implement Patient Intake OCR schema.

BEGIN;

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE patient_document_status AS ENUM (
        'uploaded', 
        'processing', 
        'extracted', 
        'review_pending', 
        'confirmed', 
        'rejected', 
        'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE patient_extraction_status AS ENUM (
        'draft_extracted', 
        'pending_review', 
        'confirmed', 
        'rejected'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create patient_documents
CREATE TABLE IF NOT EXISTS public.patient_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    document_type text,
    storage_path text NOT NULL,
    file_name text,
    mime_type text,
    file_hash_sha256 text,
    uploaded_by uuid REFERENCES auth.users(id),
    uploaded_at timestamptz DEFAULT now(),
    status patient_document_status DEFAULT 'uploaded',
    ocr_provider text DEFAULT 'nija-v2',
    ocr_started_at timestamptz,
    ocr_completed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 3. Create patient_document_extractions
CREATE TABLE IF NOT EXISTS public.patient_document_extractions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_document_id uuid NOT NULL REFERENCES public.patient_documents(id) ON DELETE CASCADE,
    version_number integer DEFAULT 1,
    source_extraction_id uuid REFERENCES public.patient_document_extractions(id),
    extracted_json jsonb NOT NULL,
    normalized_json jsonb,
    confidence_json jsonb,
    field_source_json jsonb,
    field_status_json jsonb,
    review_diff_json jsonb,
    status patient_extraction_status DEFAULT 'draft_extracted',
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_document_extractions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "office_isolation_docs" ON public.patient_documents;
CREATE POLICY "office_isolation_docs" ON public.patient_documents
    FOR ALL USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "office_isolation_ext" ON public.patient_document_extractions;
CREATE POLICY "office_isolation_ext" ON public.patient_document_extractions
    FOR ALL USING (patient_document_id IN (SELECT id FROM public.patient_documents));

-- 6. Expand pacientes table with detailed fields
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS rg text,
ADD COLUMN IF NOT EXISTS orgao_emissor text,
ADD COLUMN IF NOT EXISTS uf_documento text,
ADD COLUMN IF NOT EXISTS nome_mae text,
ADD COLUMN IF NOT EXISTS nome_pai text,
ADD COLUMN IF NOT EXISTS nacionalidade text,
ADD COLUMN IF NOT EXISTS naturalidade text,
ADD COLUMN IF NOT EXISTS endereco_logradouro text,
ADD COLUMN IF NOT EXISTS endereco_numero text,
ADD COLUMN IF NOT EXISTS endereco_bairro text,
ADD COLUMN IF NOT EXISTS endereco_cidade text,
ADD COLUMN IF NOT EXISTS endereco_uf text,
ADD COLUMN IF NOT EXISTS endereco_cep text,
ADD COLUMN IF NOT EXISTS data_emissao date;

-- 7. Add columns to v_pacientes_unified view (Recreate)
DROP VIEW IF EXISTS public.v_pacientes_unified;
CREATE OR REPLACE VIEW public.v_pacientes_unified AS
SELECT 
    p.id as paciente_id,
    c.id as client_id,
    c.office_id,
    COALESCE(p.nome, c.full_name) as nome,
    COALESCE(p.cpf, c.cpf) as cpf,
    COALESCE(p.email, c.email) as email,
    COALESCE(p.telefone, c.phone) as telefone,
    COALESCE(p.endereco, c.address_line) as endereco,
    p.data_nascimento,
    p.sexo,
    p.historico_medico,
    p.alergias,
    p.medicamentos_em_uso,
    p.observacoes,
    p.status,
    p.created_at,
    p.updated_at,
    p.rg,
    p.orgao_emissor,
    p.uf_documento,
    p.nome_mae,
    p.nome_pai,
    p.nacionalidade,
    p.naturalidade,
    p.data_emissao,
    p.endereco_logradouro,
    p.endereco_numero,
    p.endereco_bairro,
    p.endereco_cidade,
    p.endereco_uf,
    p.endereco_cep
FROM public.pacientes p
JOIN public.clients c ON p.client_id = c.id;

-- 8. Storage Bucket Registration (Metadata)
-- Note: Requires manual creation via Dashboard or CLI if SQL triggers are not configured.
-- We check for storage schema just in case.
DO $$ 
BEGIN
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('patient-documents', 'patient-documents', false)
    ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN 
    -- If storage schema not accessible via SQL, ignore.
    NULL;
END $$;

COMMIT;
