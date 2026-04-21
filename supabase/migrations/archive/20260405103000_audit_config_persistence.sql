-- Migration: Audit Config Persistence
-- Adiciona colunas para rastrear qual configuração de IA gerou cada resultado.

-- 1. nija_pipeline_runs
ALTER TABLE public.nija_pipeline_runs 
ADD COLUMN IF NOT EXISTS config_resolver_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS config_resolver_version integer,
ADD COLUMN IF NOT EXISTS config_resolver_source text,
ADD COLUMN IF NOT EXISTS config_fallback_used boolean DEFAULT false;

-- 2. nija_reviews
ALTER TABLE public.nija_reviews 
ADD COLUMN IF NOT EXISTS config_resolver_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS config_resolver_version integer,
ADD COLUMN IF NOT EXISTS config_resolver_source text,
ADD COLUMN IF NOT EXISTS config_fallback_used boolean DEFAULT false;

-- 3. judge_simulations
ALTER TABLE public.judge_simulations 
ADD COLUMN IF NOT EXISTS config_resolver_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS config_resolver_version integer,
ADD COLUMN IF NOT EXISTS config_resolver_source text,
ADD COLUMN IF NOT EXISTS config_fallback_used boolean DEFAULT false;

-- 4. process_dossiers
ALTER TABLE public.process_dossiers 
ADD COLUMN IF NOT EXISTS config_resolver_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS config_resolver_version integer,
ADD COLUMN IF NOT EXISTS config_resolver_source text,
ADD COLUMN IF NOT EXISTS config_fallback_used boolean DEFAULT false;

-- 5. legal_documents
ALTER TABLE public.legal_documents 
ADD COLUMN IF NOT EXISTS config_resolver_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS config_resolver_version integer,
ADD COLUMN IF NOT EXISTS config_resolver_source text,
ADD COLUMN IF NOT EXISTS config_fallback_used boolean DEFAULT false;

COMMENT ON COLUMN public.nija_pipeline_runs.config_resolver_id IS 'ID da config resolvida via getAgentConfig';
COMMENT ON COLUMN public.nija_pipeline_runs.config_resolver_source IS 'Nível de resolução (GLOBAL, OFFICE, STAGE)';
