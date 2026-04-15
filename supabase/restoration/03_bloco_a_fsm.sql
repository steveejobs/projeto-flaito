-- ============================================================
-- BLOCO A — FSM (Case State Machine)
-- Executar no: Supabase SQL Editor
-- Projeto: ccvbosbjtlxewqybvwqj
-- Objetos: lexos_case_states, lexos_case_state_history,
--          lexos_case_notifications, vw_case_current_state,
--          vw_case_state_timeline, lexos_next_states_for_case,
--          lexos_transition_case_state
-- Dependências externas: cases, offices, office_members (existem)
-- ============================================================

BEGIN;

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

-- Seed: estados padrão do fluxo legal
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

DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.lexos_case_states;
CREATE POLICY "Enable read for authenticated users"
  ON public.lexos_case_states FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for admin+" ON public.lexos_case_states;
CREATE POLICY "Enable insert for admin+"
  ON public.lexos_case_states FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for admin+" ON public.lexos_case_states;
CREATE POLICY "Enable update for admin+"
  ON public.lexos_case_states FOR UPDATE
  TO authenticated USING (true);

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
CREATE INDEX IF NOT EXISTS idx_case_state_history_office_id ON public.lexos_case_state_history(office_id);

ALTER TABLE public.lexos_case_state_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for office members" ON public.lexos_case_state_history;
CREATE POLICY "Enable read for office members"
  ON public.lexos_case_state_history FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.user_id = auth.uid()
        AND om.office_id = lexos_case_state_history.office_id
        AND om.is_active = true
    )
  );

DROP POLICY IF EXISTS "Enable insert for office members" ON public.lexos_case_state_history;
CREATE POLICY "Enable insert for office members"
  ON public.lexos_case_state_history FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.user_id = auth.uid()
        AND om.office_id = lexos_case_state_history.office_id
        AND om.is_active = true
    )
  );

-- 3. TABELA: lexos_case_notifications
CREATE TABLE IF NOT EXISTS public.lexos_case_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_case_notifications_case_id ON public.lexos_case_notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notifications_office_id ON public.lexos_case_notifications(office_id);
CREATE INDEX IF NOT EXISTS idx_case_notifications_is_read ON public.lexos_case_notifications(is_read);

ALTER TABLE public.lexos_case_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for office members" ON public.lexos_case_notifications;
CREATE POLICY "Enable read for office members"
  ON public.lexos_case_notifications FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.user_id = auth.uid()
        AND om.office_id = lexos_case_notifications.office_id
        AND om.is_active = true
    )
  );

DROP POLICY IF EXISTS "Enable insert for office members" ON public.lexos_case_notifications;
CREATE POLICY "Enable insert for office members"
  ON public.lexos_case_notifications FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.user_id = auth.uid()
        AND om.office_id = lexos_case_notifications.office_id
        AND om.is_active = true
    )
  );

DROP POLICY IF EXISTS "Enable update for office members" ON public.lexos_case_notifications;
CREATE POLICY "Enable update for office members"
  ON public.lexos_case_notifications FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.user_id = auth.uid()
        AND om.office_id = lexos_case_notifications.office_id
        AND om.is_active = true
    )
  );

-- 4. VIEW: vw_case_current_state
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

-- 5. VIEW: vw_case_state_timeline
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

-- 6. RPC: lexos_next_states_for_case
CREATE OR REPLACE FUNCTION public.lexos_next_states_for_case(p_case_id uuid)
RETURNS TABLE (
  to_state_id uuid,
  to_state_code text,
  to_state_name text,
  sort_order int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state_id uuid;
BEGIN
  SELECT current_state_id INTO v_current_state_id
  FROM public.vw_case_current_state
  WHERE case_id = p_case_id;

  IF v_current_state_id IS NULL THEN
    RETURN QUERY
    SELECT
      s.id AS to_state_id,
      s.code AS to_state_code,
      s.name AS to_state_name,
      s.sort_order
    FROM public.lexos_case_states s
    WHERE s.is_active = true
      AND s.is_terminal = false
    ORDER BY s.sort_order;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id AS to_state_id,
    s.code AS to_state_code,
    s.name AS to_state_name,
    s.sort_order
  FROM public.lexos_case_states s
  WHERE s.is_active = true
    AND s.id != v_current_state_id
  ORDER BY s.sort_order;
END;
$$;

REVOKE ALL ON FUNCTION public.lexos_next_states_for_case(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lexos_next_states_for_case(uuid) TO authenticated;

-- 7. RPC: lexos_transition_case_state
CREATE OR REPLACE FUNCTION public.lexos_transition_case_state(
  p_case_id uuid,
  p_to_state_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case_id uuid;
  v_office_id uuid;
  v_current_state_id uuid;
  v_history_id uuid;
  v_user_id uuid := auth.uid();
  v_to_state_active boolean;
BEGIN
  SELECT id, office_id INTO v_case_id, v_office_id
  FROM public.cases
  WHERE id = p_case_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOQUEIO: Caso não encontrado. Use RPC lexos_transition_case_state com case_id válido';
  END IF;

  SELECT is_active INTO v_to_state_active
  FROM public.lexos_case_states
  WHERE id = p_to_state_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOQUEIO: Estado destino não encontrado. Use RPC lexos_transition_case_state com to_state_id válido';
  END IF;

  IF NOT v_to_state_active THEN
    RAISE EXCEPTION 'Transição inválida: estado destino está inativo';
  END IF;

  SELECT current_state_id INTO v_current_state_id
  FROM public.vw_case_current_state
  WHERE case_id = p_case_id;

  INSERT INTO public.lexos_case_state_history (
    case_id,
    office_id,
    from_state_id,
    to_state_id,
    changed_by,
    note
  ) VALUES (
    p_case_id,
    v_office_id,
    v_current_state_id,
    p_to_state_id,
    v_user_id,
    p_note
  )
  RETURNING id INTO v_history_id;

  INSERT INTO public.lexos_case_notifications (
    case_id,
    office_id,
    title,
    body,
    created_by
  )
  SELECT
    p_case_id,
    v_office_id,
    'Estado alterado',
    'Caso movido para: ' || s.name,
    v_user_id
  FROM public.lexos_case_states s
  WHERE s.id = p_to_state_id;

  RETURN v_history_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lexos_transition_case_state(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lexos_transition_case_state(uuid, uuid, text) TO authenticated;

COMMIT;

-- ============================================================
-- VALIDAÇÃO TÉCNICA — Bloco A
-- ============================================================

-- Deve retornar 9 estados seed
SELECT id, code, name, sort_order, is_terminal, is_active FROM lexos_case_states ORDER BY sort_order;

-- Deve estar vazio inicialmente
SELECT COUNT(*) FROM lexos_case_state_history;
SELECT COUNT(*) FROM lexos_case_notifications;

-- Deve funcionar mesmo sem dados
SELECT * FROM vw_case_current_state LIMIT 1;
SELECT * FROM vw_case_state_timeline LIMIT 1;

-- Deve retornar estados não-terminais (caso sem histórico)
SELECT * FROM lexos_next_states_for_case('00000000-0000-0000-0000-000000000000');

-- ============================================================
-- ROLLBACK — Bloco A (executar se necessário)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.lexos_transition_case_state(uuid, uuid, text) CASCADE;
-- DROP FUNCTION IF EXISTS public.lexos_next_states_for_case(uuid) CASCADE;
-- DROP VIEW IF EXISTS public.vw_case_state_timeline CASCADE;
-- DROP VIEW IF EXISTS public.vw_case_current_state CASCADE;
-- DROP TABLE IF EXISTS public.lexos_case_notifications CASCADE;
-- DROP TABLE IF EXISTS public.lexos_case_state_history CASCADE;
-- DROP TABLE IF EXISTS public.lexos_case_states CASCADE;
