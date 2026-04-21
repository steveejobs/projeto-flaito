-- Migration: 20260409004600_update_dossier_stage_4.sql
-- Goal: Add Stage 4 columns (Document Assembly Engine).

-- 1. Add Stage 4 Columns
ALTER TABLE public.process_dossiers 
ADD COLUMN IF NOT EXISTS assembled_document_markdown text,
ADD COLUMN IF NOT EXISTS assembly_map jsonb DEFAULT '[]', -- [{ block_id, mode, template_id, ledger_ids, authority_ids }]
ADD COLUMN IF NOT EXISTS citation_map jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS placeholder_status jsonb DEFAULT '{}', -- { resolved: [], missing: [] }
ADD COLUMN IF NOT EXISTS stage_4_readiness_status text, -- READY_FOR_AUDIT, HUMAN_REVIEW_REQUIRED, BLOCKED_ASSEMBLY
ADD COLUMN IF NOT EXISTS parent_stage_3_5_id uuid REFERENCES public.process_dossiers(id);

-- 2. Add Documentation
COMMENT ON COLUMN public.process_dossiers.assembled_document_markdown IS 'Conteúdo final do documento jurídico em Markdown montado deterministicamente.';
COMMENT ON COLUMN public.process_dossiers.assembly_map IS 'Mapeamento detalhado de cada bloco: modo de montagem, template usado e vínculos com evidências/autoridades.';
COMMENT ON COLUMN public.process_dossiers.citation_map IS 'Mapeamento granular das citações verificadas aplicadas no texto.';
COMMENT ON COLUMN public.process_dossiers.placeholder_status IS 'Relatório de variáveis preenchidas e pendentes ([MISSING: ...]).';
COMMENT ON COLUMN public.process_dossiers.stage_4_readiness_status IS 'Status da montagem (READY_FOR_AUDIT, HUMAN_REVIEW_REQUIRED, BLOCKED_ASSEMBLY).';
COMMENT ON COLUMN public.process_dossiers.parent_stage_3_5_id IS 'Referência ao Estágio 3.5 (Verificação de Autoridades) que desbloqueou esta montagem.';
