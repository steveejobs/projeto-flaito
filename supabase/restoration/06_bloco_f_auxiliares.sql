-- ============================================================
-- BLOCO F — AUXILIARES
-- Executar no: Supabase SQL Editor
-- Projeto: ccvbosbjtlxewqybvwqj
-- Objetos: delegacias, assistant_suggestions
-- Dependências externas: offices (existe)
-- ============================================================

BEGIN;

-- 1. TABELA: delegacias
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

CREATE INDEX IF NOT EXISTS idx_delegacias_cidade_estado ON public.delegacias(cidade, estado);

ALTER TABLE public.delegacias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.delegacias;
CREATE POLICY "Enable read for authenticated users"
  ON public.delegacias FOR SELECT
  TO authenticated USING (true);

-- 2. TABELA: assistant_suggestions
CREATE TABLE IF NOT EXISTS public.assistant_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  suggestion_type text NOT NULL DEFAULT 'ACTION',
  priority int NOT NULL DEFAULT 0,
  metadata jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_suggestions_office_id ON public.assistant_suggestions(office_id);

ALTER TABLE public.assistant_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for office members" ON public.assistant_suggestions;
CREATE POLICY "Enable read for office members"
  ON public.assistant_suggestions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.user_id = auth.uid()
        AND om.office_id = assistant_suggestions.office_id
        AND om.is_active = true
    )
  );

DROP POLICY IF EXISTS "Enable insert for admin+" ON public.assistant_suggestions;
CREATE POLICY "Enable insert for admin+"
  ON public.assistant_suggestions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.user_id = auth.uid()
        AND om.office_id = assistant_suggestions.office_id
        AND om.is_active = true
    )
  );

DROP POLICY IF EXISTS "Enable update for admin+" ON public.assistant_suggestions;
CREATE POLICY "Enable update for admin+"
  ON public.assistant_suggestions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.user_id = auth.uid()
        AND om.office_id = assistant_suggestions.office_id
        AND om.is_active = true
    )
  );

COMMIT;

-- ============================================================
-- VALIDAÇÃO TÉCNICA — Bloco F
-- ============================================================

SELECT COUNT(*) FROM delegacias;
SELECT COUNT(*) FROM assistant_suggestions;

-- ============================================================
-- ROLLBACK — Bloco F (executar se necessário)
-- ============================================================
-- DROP TABLE IF EXISTS public.assistant_suggestions CASCADE;
-- DROP TABLE IF EXISTS public.delegacias CASCADE;
