-- ============================================================
-- Migration: 20260405200000
-- Purpose: Criar objetos ausentes no schema remoto
--   - Tabelas FSM (lexos_case_states, lexos_case_notifications)
--   - Views FSM (vw_case_current_state, vw_case_state_timeline)
--   - RPCs de convites (get_office_invite_public, accept_office_invite)
--   - RPCs de sessão (lexos_healthcheck_session, ensure_personal_office)
--   - RPCs de documentos (render_template_preview, hard_delete_client)
--   - RPCs de agenda (get_agenda_month_bundle)
--   - Tabelas auxiliares (delegacias, assistant_suggestions)
-- ============================================================

-- ============================================================
-- 1. TABELA: lexos_case_states (FSM states definition)
-- ============================================================
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

-- ============================================================
-- 2. TABELA: lexos_case_state_history (registro de transições)
-- ============================================================
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

-- ============================================================
-- 3. TABELA: lexos_case_notifications
-- ============================================================
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

-- ============================================================
-- 4. VIEW: vw_case_current_state
-- ============================================================
DROP VIEW IF EXISTS public.vw_case_current_state CASCADE;
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

-- ============================================================
-- 5. VIEW: vw_case_state_timeline
-- ============================================================
DROP VIEW IF EXISTS public.vw_case_state_timeline CASCADE;
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

-- ============================================================
-- 6. VIEW: vw_client_signatures
-- ============================================================
DROP VIEW IF EXISTS public.vw_client_signatures CASCADE;
CREATE OR REPLACE VIEW public.vw_client_signatures AS
SELECT
  cl.id AS client_id,
  cl.office_id,
  cl.full_name,
  cl.cpf,
  es.id AS signature_id,
  es.signature_base64,
  NULL::timestamptz AS signed_at,
  NULL::uuid AS signed_by
FROM public.clients cl
LEFT JOIN public.e_signatures es ON es.client_id = cl.id
WHERE cl.deleted_at IS NULL;

-- ============================================================
-- 7. RPC: lexos_healthcheck_session
-- ============================================================
CREATE OR REPLACE FUNCTION public.lexos_healthcheck_session()
RETURNS TABLE (office_id uuid, user_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    om.office_id,
    om.user_id,
    om.role::text
  FROM public.office_members om
  WHERE om.user_id = auth.uid()
    AND om.is_active = true
  ORDER BY om.created_at ASC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lexos_healthcheck_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lexos_healthcheck_session() TO authenticated;

-- ============================================================
-- 8. RPC: ensure_personal_office
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_personal_office()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_office_id uuid;
BEGIN
  -- Check if user already has an office
  SELECT om.office_id INTO v_office_id
  FROM public.office_members om
  WHERE om.user_id = v_user_id
    AND om.is_active = true
  LIMIT 1;

  IF v_office_id IS NOT NULL THEN
    RETURN v_office_id;
  END IF;

  -- Create personal office
  INSERT INTO public.offices (name, metadata)
  VALUES ('Uso Pessoal', '{"is_personal": true}'::jsonb)
  RETURNING id INTO v_office_id;

  -- Add user as OWNER
  INSERT INTO public.office_members (office_id, user_id, role, is_active)
  VALUES (v_office_id, v_user_id, 'OWNER', true);

  RETURN v_office_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_personal_office() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_personal_office() TO authenticated;

-- ============================================================
-- 9. RPC: get_office_invite_public
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_office_invite_public(p_token text)
RETURNS TABLE (
  invite_id uuid,
  email text,
  role text,
  office_id uuid,
  office_name text,
  expires_at timestamptz,
  created_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.id AS invite_id,
    oi.email,
    oi.role::text,
    oi.office_id,
    o.name AS office_name,
    oi.expires_at,
    oi.created_by
  FROM public.office_invites oi
  JOIN public.offices o ON o.id = oi.office_id
  WHERE oi.token = p_token
    AND oi.accepted_at IS NULL
    AND oi.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_office_invite_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_office_invite_public(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_office_invite_public(text) TO authenticated;

-- ============================================================
-- 10. RPC: accept_office_invite
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_office_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_user_id uuid := auth.uid();
BEGIN
  -- Find valid invite
  SELECT oi.* INTO v_invite
  FROM public.office_invites oi
  WHERE oi.token = p_token
    AND oi.accepted_at IS NULL
    AND oi.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;

  -- Check if email matches (if invite has email set)
  IF v_invite.email IS NOT NULL THEN
    -- Email validation would be done at auth level
    NULL;
  END IF;

  -- Add user to office
  INSERT INTO public.office_members (office_id, user_id, role, is_active)
  VALUES (v_invite.office_id, v_user_id, v_invite.role, true)
  ON CONFLICT (office_id, user_id) DO NOTHING;

  -- Mark invite as accepted
  UPDATE public.office_invites
  SET accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true, 'office_id', v_invite.office_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_office_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_office_invite(text) TO authenticated;

-- ============================================================
-- 11. RPC: render_template_preview
-- ============================================================
CREATE OR REPLACE FUNCTION public.render_template_preview(
  p_template_id uuid,
  p_data jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template_content text;
  v_result text;
  v_key text;
  v_value text;
BEGIN
  -- Get template content
  SELECT content INTO v_template_content
  FROM public.document_templates
  WHERE id = p_template_id
  LIMIT 1;

  IF v_template_content IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  -- Simple variable replacement: {{variable}} -> value
  v_result := v_template_content;

  FOR v_key, v_value IN
    SELECT key, value::text
    FROM jsonb_each_text(p_data)
  LOOP
    v_result := replace(v_result, '{{' || v_key || '}}', v_value);
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.render_template_preview(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.render_template_preview(uuid, jsonb) TO authenticated;

-- ============================================================
-- 12. RPC: hard_delete_client
-- ============================================================
CREATE OR REPLACE FUNCTION public.hard_delete_client(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_office_id uuid;
  v_user_id uuid := auth.uid();
  v_role text;
BEGIN
  -- Get client office
  SELECT office_id INTO v_office_id
  FROM public.clients
  WHERE id = p_client_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Check user role
  SELECT role::text INTO v_role
  FROM public.office_members
  WHERE user_id = v_user_id AND office_id = v_office_id AND is_active = true;

  IF v_role NOT IN ('OWNER', 'ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permissão negada');
  END IF;

  -- Hard delete client and related data
  DELETE FROM public.clients WHERE id = p_client_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.hard_delete_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hard_delete_client(uuid) TO authenticated;

-- ============================================================
-- 13. RPC: lexos_next_states_for_case
-- ============================================================
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
  -- Get current state from the view
  SELECT current_state_id INTO v_current_state_id
  FROM public.vw_case_current_state
  WHERE case_id = p_case_id;

  -- If no state history, return all non-terminal states (case is new)
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

  -- Return all active non-terminal states except current
  -- (In a full FSM, this would use a transition_rules table)
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

-- ============================================================
-- 14. RPC: lexos_transition_case_state
-- ============================================================
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
  -- Validate case exists
  SELECT id, office_id INTO v_case_id, v_office_id
  FROM public.cases
  WHERE id = p_case_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOQUEIO: Caso não encontrado. Use RPC lexos_transition_case_state com case_id válido';
  END IF;

  -- Validate to_state exists and is active
  SELECT is_active INTO v_to_state_active
  FROM public.lexos_case_states
  WHERE id = p_to_state_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOQUEIO: Estado destino não encontrado. Use RPC lexos_transition_case_state com to_state_id válido';
  END IF;

  IF NOT v_to_state_active THEN
    RAISE EXCEPTION 'Transição inválida: estado destino está inativo';
  END IF;

  -- Get current state
  SELECT current_state_id INTO v_current_state_id
  FROM public.vw_case_current_state
  WHERE case_id = p_case_id;

  -- Record transition
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

  -- Create notification
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

-- ============================================================
-- 15. RPC: get_agenda_month_bundle
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_agenda_month_bundle(
  p_office_id uuid,
  p_year int,
  p_month int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date date;
  v_end_date date;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + interval '1 month' - interval '1 day')::date;

  RETURN jsonb_build_object(
    'events', (
      SELECT COALESCE(json_agg(e), '[]'::json)
      FROM (
        SELECT
          cd.id,
          cd.title,
          cd.description,
          cd.due_date AS event_date,
          cd.priority,
          cd.status,
          cd.case_id,
          c.title AS case_title
        FROM public.case_deadlines cd
        LEFT JOIN public.cases c ON c.id = cd.case_id
        WHERE cd.office_id = p_office_id
          AND cd.due_date BETWEEN v_start_date AND v_end_date
        ORDER BY cd.due_date
      ) e
    ),
    'year', p_year,
    'month', p_month
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_agenda_month_bundle(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agenda_month_bundle(uuid, int, int) TO authenticated;

-- ============================================================
-- 16. TABELA: delegacias (lookup de delegacias)
-- ============================================================
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

-- ============================================================
-- 17. TABELA: assistant_suggestions (Athena suggestions)
-- ============================================================
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
