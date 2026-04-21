-- =====================================================
-- Adicionar colunas para persistência de sessão NIJA
-- =====================================================

-- Hash dos documentos para detectar duplicatas
ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS documents_hash TEXT;

-- Resultado da extração EPROC
ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS extraction_result JSONB;

-- Resultado da análise IA
ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS analysis_result JSONB;

-- Metadados extraídos
ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS cnj_number TEXT;

ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS client_name TEXT;

ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS opponent_name TEXT;

ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS acting_side TEXT;

-- Nomes dos arquivos para exibição
ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS document_names JSONB DEFAULT '[]'::jsonb;

-- IDs dos documentos (já tem attachments, mas vamos usar document_ids para nova lógica)
ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS document_ids JSONB DEFAULT '[]'::jsonb;

-- Status da sessão
ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Updated_at para tracking
ALTER TABLE public.nija_sessions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Tornar case_id nullable (para sessões sem caso criado)
ALTER TABLE public.nija_sessions 
ALTER COLUMN case_id DROP NOT NULL;

-- Índice para busca por hash de documentos
CREATE INDEX IF NOT EXISTS idx_nija_sessions_documents_hash 
ON public.nija_sessions(office_id, documents_hash) 
WHERE documents_hash IS NOT NULL;

-- Índice para CNJ
CREATE INDEX IF NOT EXISTS idx_nija_sessions_cnj 
ON public.nija_sessions(cnj_number) 
WHERE cnj_number IS NOT NULL;