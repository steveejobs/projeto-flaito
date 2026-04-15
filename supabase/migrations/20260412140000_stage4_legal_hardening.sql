-- Migration: Stage 4 — Legal Intelligence Hardening
-- Description: Adiciona suporte para taxonomia de fatos, suficiência de contexto e gates de validação.

-- 1. Enum para Suficiência de Contexto
DO $$ BEGIN
    CREATE TYPE public.context_sufficiency_level AS ENUM (
        'sufficient',   -- Contexto robusto, permite geração total
        'weak',         -- Falta de alguns documentos secundários, gera com avisos
        'insufficient'  -- Falta de documentos mandatórios ou áudio, bloqueia geração
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Evolução de legal_session_outputs
ALTER TABLE public.legal_session_outputs
ADD COLUMN IF NOT EXISTS context_sufficiency public.context_sufficiency_level,
ADD COLUMN IF NOT EXISTS validation_gates JSONB DEFAULT '{}', -- Resultados dos checks de Stage 5
ADD COLUMN IF NOT EXISTS fact_taxonomy JSONB DEFAULT '{}',   -- { oral: [], documentary: [], inference: [] }
ADD COLUMN IF NOT EXISTS output_hash TEXT;                   -- Para detecção de duplicatas reais

-- 3. Índice para rastreabilidade e performance
CREATE INDEX IF NOT EXISTS idx_legal_outputs_snapshot_id 
ON public.legal_session_outputs(snapshot_id);

-- 4. Comentários para Auditoria
COMMENT ON COLUMN public.legal_session_outputs.context_sufficiency IS 'Nível de confiança na base documental usada para esta geração.';
COMMENT ON COLUMN public.legal_session_outputs.fact_taxonomy IS 'Estrutura segregada de fatos orais, documentais e inferências.';
