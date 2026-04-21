-- Migration: 20260412160000_stage6_intake_hardening.sql
-- Goal: Implement Field-Level Audit, Deduplication Suggestions, and Extraction Versioning.

BEGIN;

-- 1. Create Enums for Provenance and Confidence
DO $$ BEGIN
    CREATE TYPE field_provenance_type AS ENUM (
        'ocr_extraction', 
        'manual_entry', 
        'manual_correction', 
        'system_import', 
        'auto_normalization'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create patient_field_audit_log
-- This table tracks EVERY change to important patient fields for clinical/legal safety.
CREATE TABLE IF NOT EXISTS public.patient_field_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    provenance field_provenance_type DEFAULT 'manual_entry',
    confidence_score float, -- 0.0 to 1.0
    extraction_id uuid REFERENCES public.patient_document_extractions(id), -- Null if manual
    changed_by uuid REFERENCES auth.users(id),
    change_reason text,
    changed_at timestamptz DEFAULT now()
);

-- 3. Create patient_deduplication_suggestions
-- Tracks potential duplicate entities for human review.
CREATE TABLE IF NOT EXISTS public.patient_deduplication_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    source_patient_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    target_patient_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    matching_score float NOT NULL, -- 0.0 to 1.0
    matching_criteria jsonb DEFAULT '{}', -- e.g. {"cpf": "exact", "name": "fuzzy"}
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MERGED', 'DISMISSED')),
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_patient_pair UNIQUE (source_patient_id, target_patient_id)
);

-- 4. Update patient_document_extractions with Head and Worker control
ALTER TABLE public.patient_document_extractions 
ADD COLUMN IF NOT EXISTS is_head boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS worker_version text,
ADD COLUMN IF NOT EXISTS intake_quality_score float;

-- 5. Trigger to enforce single is_head per document
CREATE OR REPLACE FUNCTION public.tr_enforce_single_extraction_head()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_head = true THEN
        UPDATE public.patient_document_extractions
        SET is_head = false
        WHERE patient_document_id = NEW.patient_document_id
          AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_extraction_head_update ON public.patient_document_extractions;
CREATE TRIGGER tr_on_extraction_head_update
BEFORE INSERT OR UPDATE OF is_head ON public.patient_document_extractions
FOR EACH ROW EXECUTE FUNCTION public.tr_enforce_single_extraction_head();

-- 6. Enable RLS
ALTER TABLE public.patient_field_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_deduplication_suggestions ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- Reuse office-based isolation
DROP POLICY IF EXISTS "office_isolation_audit" ON public.patient_field_audit_log;
CREATE POLICY "office_isolation_audit" ON public.patient_field_audit_log
    FOR ALL USING (patient_id IN (SELECT id FROM public.pacientes));

DROP POLICY IF EXISTS "office_isolation_dedup" ON public.patient_deduplication_suggestions;
CREATE POLICY "office_isolation_dedup" ON public.patient_deduplication_suggestions
    FOR ALL USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));

-- 8. Add index for faster dedup lookups
CREATE INDEX IF NOT EXISTS idx_audit_patient_field ON public.patient_field_audit_log(patient_id, field_name);
CREATE INDEX IF NOT EXISTS idx_dedup_office ON public.patient_deduplication_suggestions(office_id);

COMMIT;
