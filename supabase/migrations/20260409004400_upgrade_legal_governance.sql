-- Migration: 20260409004400_upgrade_legal_governance.sql
-- Goal: Enhance the governance layer to support strict authority and citation verification.

-- 1. Update type constraint to include playbooks, precedents, and legislation
ALTER TABLE public.office_knowledge 
DROP CONSTRAINT IF EXISTS office_knowledge_type_check;

ALTER TABLE public.office_knowledge 
ADD CONSTRAINT office_knowledge_type_check 
CHECK (type IN ('piece', 'thesis', 'playbook', 'precedent', 'legislation', 'clause'));

-- 2. Add verifiable identifier and source URL
ALTER TABLE public.office_knowledge 
ADD COLUMN IF NOT EXISTS verifiable_identifier text,
ADD COLUMN IF NOT EXISTS source_url text;

-- 3. Add documentation
COMMENT ON COLUMN public.office_knowledge.verifiable_identifier IS 'Identificador único oficial (ex: RE 1.234.567, Lei 8.112) ou índice interno de playbook.';
COMMENT ON COLUMN public.office_knowledge.source_url IS 'Link direto para a fonte oficial (portal do tribunal, planalto.gov.br, etc.).';

-- 4. Unique index per office for identifiers to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_office_knowledge_unique_id_per_office 
ON public.office_knowledge (office_id, verifiable_identifier) 
WHERE verifiable_identifier IS NOT NULL;
