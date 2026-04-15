-- Migration: 20260409004700_update_dossier_stage_5.sql
-- Goal: Add Stage 5 columns (Anti-Hallucination and Assembly Audit).

-- 1. Add Stage 5 Columns
ALTER TABLE public.process_dossiers 
ADD COLUMN IF NOT EXISTS audit_report jsonb DEFAULT '{}', -- { layers: { structural, analytical }, blocks: [], global_status }
ADD COLUMN IF NOT EXISTS dossier_readiness_status text, -- FINAL_APPROVED, HUMAN_REVIEW_REQUIRED, BLOCKED_HALLUCINATION_DETECTED
ADD COLUMN IF NOT EXISTS parent_stage_4_id uuid REFERENCES public.process_dossiers(id);

-- 2. Add Documentation
COMMENT ON COLUMN public.process_dossiers.audit_report IS 'Relatório detalhado de auditoria (PASS/WARN/FAIL) em camadas estrutural e analítica.';
COMMENT ON COLUMN public.process_dossiers.dossier_readiness_status IS 'Status final de prontidão (FINAL_APPROVED, HUMAN_REVIEW_REQUIRED, BLOCKED_HALLUCINATION_DETECTED).';
COMMENT ON COLUMN public.process_dossiers.parent_stage_4_id IS 'Referência ao Estágio 4 (Montagem) que gerou o documento auditado.';
