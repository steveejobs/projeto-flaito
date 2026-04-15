-- Migration: 20260409004100_update_dossier_stage_2.sql
-- Goal: Add Stage 2 columns (Legal theory Map) and allow parent referencing for immutability.

-- 1. Add Stage 2 Columns
ALTER TABLE public.process_dossiers 
ADD COLUMN IF NOT EXISTS legal_theory_map jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stage_2_readiness_status text,
ADD COLUMN IF NOT EXISTS parent_stage_1_id uuid REFERENCES public.process_dossiers(id) ON DELETE SET NULL;

-- 2. Add Documentation
COMMENT ON COLUMN public.process_dossiers.legal_theory_map IS 'Mapeamento de teses e análise jurídica gerada no Estágio 2.';
COMMENT ON COLUMN public.process_dossiers.stage_2_readiness_status IS 'Status de prontidão após análise jurídica (READY_FOR_STAGE_3, BLOCKED_LEGAL_INSUFFICIENCY, HUMAN_REVIEW_REQUIRED).';
COMMENT ON COLUMN public.process_dossiers.parent_stage_1_id IS 'Referência ao registro do Estágio 1 (Evidence Inventory) que serviu de base para esta análise.';

-- 3. Indices for performance
CREATE INDEX IF NOT EXISTS process_dossiers_parent_stage_1_id_idx ON public.process_dossiers(parent_stage_1_id);
