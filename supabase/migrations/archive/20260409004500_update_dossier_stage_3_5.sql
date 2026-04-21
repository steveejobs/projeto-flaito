-- Migration: 20260409004500_update_dossier_stage_3_5.sql
-- Goal: Add Stage 3.5 columns (Authority & Citation Verification).

-- 1. Add Stage 3.5 Columns
ALTER TABLE public.process_dossiers 
ADD COLUMN IF NOT EXISTS verified_authorities jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS rejected_authorities jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS authority_support_map jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS playbook_compatibility_report jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS citation_readiness_status text; -- READY_FOR_DRAFTING, HUMAN_REVIEW_REQUIRED, BLOCKED_UNVERIFIED_AUTHORITIES

-- 2. Add Documentation
COMMENT ON COLUMN public.process_dossiers.verified_authorities IS 'Lista de autoridades (leis, acórdãos, súmulas) confirmadas pelo Estágio 3.5.';
COMMENT ON COLUMN public.process_dossiers.rejected_authorities IS 'Citações alucinadas ou não verificáveis rejeitadas no Estágio 3.5.';
COMMENT ON COLUMN public.process_dossiers.authority_support_map IS 'Mapeamento que vincula argumentos da estratégia a autoridades verificadas.';
COMMENT ON COLUMN public.process_dossiers.playbook_compatibility_report IS 'Relatório de alinhamento com os playbooks do escritório.';
COMMENT ON COLUMN public.process_dossiers.citation_readiness_status IS 'Status final de validade normativa (READY_FOR_DRAFTING, HUMAN_REVIEW_REQUIRED, BLOCKED_UNVERIFIED_AUTHORITIES).';
