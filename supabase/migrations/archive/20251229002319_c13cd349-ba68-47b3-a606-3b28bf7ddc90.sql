-- Adicionar coluna analysis_key para deduplicação de snapshots
ALTER TABLE nija_case_analysis ADD COLUMN IF NOT EXISTS analysis_key TEXT;

-- Adicionar coluna session_id para análises soltas (sem case_id)
ALTER TABLE nija_case_analysis ADD COLUMN IF NOT EXISTS session_id UUID;

-- Tornar case_id opcional (nullable) para análises soltas
ALTER TABLE nija_case_analysis ALTER COLUMN case_id DROP NOT NULL;

-- Índice único composto (case_id + analysis_key) para cache por caso
CREATE UNIQUE INDEX IF NOT EXISTS idx_nija_case_analysis_key 
  ON nija_case_analysis(case_id, analysis_key) WHERE case_id IS NOT NULL AND analysis_key IS NOT NULL;

-- Índice único composto (session_id + analysis_key) para cache por sessão
CREATE UNIQUE INDEX IF NOT EXISTS idx_nija_session_analysis_key 
  ON nija_case_analysis(session_id, analysis_key) WHERE session_id IS NOT NULL AND analysis_key IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN nija_case_analysis.analysis_key IS 'SHA-256 hash de (documents_hash + actingSide + ramo + mode + engine_version) para deduplicação';
COMMENT ON COLUMN nija_case_analysis.session_id IS 'UUID da sessão para análises soltas (sem case_id vinculado)';