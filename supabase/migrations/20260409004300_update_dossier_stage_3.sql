-- Migration: 20260409004300_update_dossier_stage_3.sql
-- Goal: Add Stage 3 columns (Strategy Selection Engine) and allow parent referencing for immutability.

-- 1. Add Stage 3 Columns
ALTER TABLE public.process_dossiers 
ADD COLUMN IF NOT EXISTS selected_strategy jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS argument_structure jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS risk_assessment jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS execution_mode text, -- HIGH_FIDELITY_AUTO, ASSISTED, HUMAN_REQUIRED
ADD COLUMN IF NOT EXISTS stage_3_readiness_status text, -- READY_FOR_AUTHORITY_VERIFICATION, BLOCKED_STRATEGY, HUMAN_REVIEW_REQUIRED
ADD COLUMN IF NOT EXISTS parent_stage_2_id uuid REFERENCES public.process_dossiers(id) ON DELETE SET NULL;

-- 2. Add Documentation
COMMENT ON COLUMN public.process_dossiers.selected_strategy IS 'Tese primária e de apoio selecionadas no Estágio 3.';
COMMENT ON COLUMN public.process_dossiers.argument_structure IS 'Hierarquia de argumentos (Main, Supporting, Fallback) definida no Estágio 3.';
COMMENT ON COLUMN public.process_dossiers.risk_assessment IS 'Análise expandida de riscos (Evidentiary, Strategic, Authority, Citation, Playbook).';
COMMENT ON COLUMN public.process_dossiers.execution_mode IS 'Modo de processamento decidido (HIGH_FIDELITY_AUTO, ASSISTED, HUMAN_REQUIRED).';
COMMENT ON COLUMN public.process_dossiers.stage_3_readiness_status IS 'Status após seleção de estratégia (READY_FOR_AUTHORITY_VERIFICATION, BLOCKED_STRATEGY, HUMAN_REVIEW_REQUIRED).';
COMMENT ON COLUMN public.process_dossiers.parent_stage_2_id IS 'Referência ao registro do Estágio 2 (Legal Theory Map) que serviu de base.';

-- 3. Indices
CREATE INDEX IF NOT EXISTS process_dossiers_parent_stage_2_id_idx ON public.process_dossiers(parent_stage_2_id);
