-- ============================================================
-- Migration: 20260406000000
-- Title: Phase 15 Full Sync (Rescue + NIJA-CORE V2)
-- Purpose: 
--   1. Restaurar objetos ausentes (FSM, RPCs de Sessão, Convites)
--   2. Implementar infraestrutura de persistência NIJA (Runs, Reviews, Versionamento)
-- ============================================================

-- ============================================================
-- [PART A] RESGATE DE OBJETOS ESSENCIAIS (SESSÃO E FSM)
-- ============================================================

-- 1. TABELA: lexos_case_states
CREATE TABLE IF NOT EXISTS public.lexos_case_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_terminal boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.lexos_case_states (code, name, sort_order, is_terminal, is_active) VALUES
  ('NOVO', 'Novo', 1, false, true),
  ('EM_ANDAMENTO', 'Em Andamento', 2, false, true),
  ('AGUARDANDO_CLIENTE', 'Aguardando Cliente', 3, false, true),
  ('AGUARDANDO_DOCUMENTOS', 'Aguardando Documentos', 4, false, true),
  ('EM_ANALISE', 'Em Análise', 5, false, true),
  ('AGUARDANDO_DECISAO', 'Aguardando Decisão', 6, false, true),
  ('CONCLUIDO', 'Concluído', 7, true, true),
  ('ARQUIVADO', 'Arquivado', 8, true, true),
  ('CANCELADO', 'Cancelado', 9, true, true)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.lexos_case_states ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Enable read for authenticated users" ON public.lexos_case_states FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. TABELA: lexos_case_state_history
CREATE TABLE IF NOT EXISTS public.lexos_case_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  from_state_id uuid REFERENCES public.lexos_case_states(id),
  to_state_id uuid NOT NULL REFERENCES public.lexos_case_states(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id),
  note text
);

CREATE INDEX IF NOT EXISTS idx_case_state_history_case_id ON public.lexos_case_state_history(case_id);
ALTER TABLE public.lexos_case_state_history ENABLE ROW LEVEL SECURITY;

-- 3. VIEW: vw_case_current_state
CREATE OR REPLACE VIEW public.vw_case_current_state AS
SELECT DISTINCT ON (csh.case_id)
  csh.case_id,
  c.office_id,
  csh.to_state_id AS current_state_id,
  csh.changed_at AS current_state_changed_at,
  csh.changed_by AS current_state_changed_by,
  csh.note AS current_state_note
FROM public.lexos_case_state_history csh
JOIN public.cases c ON c.id = csh.case_id
ORDER BY csh.case_id, csh.changed_at DESC;

-- 4. VIEW: vw_case_state_timeline
CREATE OR REPLACE VIEW public.vw_case_state_timeline AS
SELECT
  csh.id AS history_id,
  csh.case_id,
  csh.from_state_id,
  fs.code AS from_state_code,
  fs.name AS from_state_name,
  csh.to_state_id,
  ts.code AS to_state_code,
  ts.name AS to_state_name,
  csh.changed_at,
  csh.changed_by,
  csh.note
FROM public.lexos_case_state_history csh
LEFT JOIN public.lexos_case_states fs ON fs.id = csh.from_state_id
JOIN public.lexos_case_states ts ON ts.id = csh.to_state_id;

-- 5. VIEW: vw_client_signatures
CREATE OR REPLACE VIEW public.vw_client_signatures AS
SELECT
  cl.id AS client_id,
  cl.office_id,
  cl.full_name,
  cl.cpf,
  es.id AS signature_id,
  es.signature_base64,
  es.signed_at
FROM public.clients cl
LEFT JOIN public.e_signatures es ON es.client_id = cl.id
WHERE cl.deleted_at IS NULL;

-- 6. RPC: lexos_healthcheck_session
DROP FUNCTION IF EXISTS public.lexos_healthcheck_session();
CREATE OR REPLACE FUNCTION public.lexos_healthcheck_session()
RETURNS TABLE (office_id uuid, user_id uuid, role text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT om.office_id, om.user_id, om.role::text
  FROM public.office_members om
  WHERE om.user_id = auth.uid() AND om.is_active = true
  ORDER BY om.created_at ASC LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lexos_healthcheck_session() TO authenticated;

-- 7. RPC: ensure_personal_office
DROP FUNCTION IF EXISTS public.ensure_personal_office();
CREATE OR REPLACE FUNCTION public.ensure_personal_office()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_office_id uuid;
BEGIN
  SELECT om.office_id INTO v_office_id FROM public.office_members om
  WHERE om.user_id = v_user_id AND om.is_active = true LIMIT 1;
  IF v_office_id IS NOT NULL THEN RETURN v_office_id; END IF;
  INSERT INTO public.offices (name, is_personal) VALUES ('Uso Pessoal', true) RETURNING id INTO v_office_id;
  INSERT INTO public.office_members (office_id, user_id, role, is_active) VALUES (v_office_id, v_user_id, 'OWNER', true);
  RETURN v_office_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_personal_office() TO authenticated;

-- ============================================================
-- [PART B] NIJA-CORE V2 (INFRAESTRUTURA DE PIPELINE)
-- ============================================================

-- 5. TABELA: nija_pipeline_runs (Rastreio de execução do orquestrador)
CREATE TABLE IF NOT EXISTS public.nija_pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  current_stage text,
  logs text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  dossier_id uuid,
  initial_piece_id uuid,
  final_piece_id uuid,
  judge_simulation_id uuid,
  config_resolver_id uuid,
  config_resolver_version int,
  config_resolver_source text,
  config_fallback_used boolean,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nija_runs_case_id ON public.nija_pipeline_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_nija_runs_office_id ON public.nija_pipeline_runs(office_id);
ALTER TABLE public.nija_pipeline_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable read for office members" ON public.nija_pipeline_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.office_members om WHERE om.user_id = auth.uid() AND om.office_id = nija_pipeline_runs.office_id AND om.is_active = true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. TABELA: nija_reviews (Auditoria técnica das peças)
CREATE TABLE IF NOT EXISTS public.nija_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  document_id uuid NOT NULL, -- FK sem restrição para permitir diferentes tabelas de docs se necessário
  quality_score int DEFAULT 0,
  report_json jsonb,
  structured_findings jsonb DEFAULT '[]'::jsonb,
  critical_risks jsonb DEFAULT '[]'::jsonb,
  suggestions jsonb DEFAULT '[]'::jsonb,
  config_resolver_id uuid,
  config_resolver_version int,
  config_resolver_source text,
  config_fallback_used boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nija_reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Enable read for office members" ON public.nija_reviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.office_members om WHERE om.user_id = auth.uid() AND om.office_id = nija_reviews.office_id AND om.is_active = true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10. EXTENSÃO: vector (Necessária para embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- 11. TABELA: legal_documents (Base)
CREATE TABLE IF NOT EXISTS public.legal_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    type text, -- PETICAO, TESE, SUMULA, MODELO, PROCURACAO
    content text NOT NULL,
    tags text[],
    area text,
    office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
    embedding vector(1536),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS e Políticas para legal_documents
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'legal_documents' AND policyname = 'Enable access for office members') THEN
    CREATE POLICY "Enable access for office members" ON public.legal_documents
    USING (EXISTS (SELECT 1 FROM public.office_members om WHERE om.user_id = auth.uid() AND om.office_id = legal_documents.office_id AND om.is_active = true));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12. ALTERAÇÕES EM legal_documents (Versionamento e Rastreabilidade)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='case_id') THEN
        ALTER TABLE public.legal_documents ADD COLUMN case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='client_id') THEN
        ALTER TABLE public.legal_documents ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='version') THEN
        ALTER TABLE public.legal_documents ADD COLUMN version int DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='parent_id') THEN
        ALTER TABLE public.legal_documents ADD COLUMN parent_id uuid REFERENCES public.legal_documents(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='legal_documents' AND column_name='config_resolver_id') THEN
        ALTER TABLE public.legal_documents ADD COLUMN config_resolver_id uuid;
        ALTER TABLE public.legal_documents ADD COLUMN config_resolver_version int;
        ALTER TABLE public.legal_documents ADD COLUMN config_resolver_source text;
        ALTER TABLE public.legal_documents ADD COLUMN config_fallback_used boolean;
    END IF;
END $$;

-- 8. TABELAS AUXILIARES E LOOKUPS
CREATE TABLE IF NOT EXISTS public.delegacias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cidade text NOT NULL,
  estado text NOT NULL,
  tipo text NOT NULL DEFAULT 'COMUM',
  endereco text,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  suggestion_type text NOT NULL DEFAULT 'ACTION',
  priority int NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- [PART C] GRANTS E PERMISSÕES FINAIS
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;
