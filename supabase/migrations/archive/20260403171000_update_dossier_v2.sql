-- Migration: 20260403171000_update_dossier_v2.sql
-- Goal: Update process_dossiers table for Advanced Dossier Engine (NIJA V2).

ALTER TABLE process_dossiers 
ADD COLUMN IF NOT EXISTS timeline_factual jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS timeline_processual jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fato_prova_map jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS lacunas_detectadas jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS pedidos_estruturados jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS resumo_tatico jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS documentos_utilizados uuid[] DEFAULT '{}';

COMMENT ON COLUMN process_dossiers.timeline_factual IS 'Linha do tempo dos fatos reais relatados no caso.';
COMMENT ON COLUMN process_dossiers.timeline_processual IS 'Linha do tempo dos atos judiciais.';
COMMENT ON COLUMN process_dossiers.fato_prova_map IS 'Mapeamento estruturado entre Fatos e Documentos (Provas).';
COMMENT ON COLUMN process_dossiers.lacunas_detectadas IS 'Relatório de Gaps e inconsistências probatórias.';
COMMENT ON COLUMN process_dossiers.resumo_tatico IS 'Visão estratégica e executiva para o advogado.';
