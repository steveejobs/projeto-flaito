-- ==================================================
-- 1. Tabela: chat_threads (conversas persistentes)
-- ==================================================
CREATE TABLE public.chat_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global', -- global | case | client | page
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  route TEXT, -- rota atual quando criado
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_chat_threads_office ON public.chat_threads(office_id);
CREATE INDEX idx_chat_threads_user ON public.chat_threads(user_id);
CREATE INDEX idx_chat_threads_case ON public.chat_threads(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_chat_threads_client ON public.chat_threads(client_id) WHERE client_id IS NOT NULL;

-- RLS
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver/criar seus próprios threads
CREATE POLICY "chat_threads_select_own" ON public.chat_threads
  FOR SELECT USING (
    office_id = public.current_office_id()
    AND (user_id = auth.uid() OR public.has_office_role('admin'))
  );

CREATE POLICY "chat_threads_insert_own" ON public.chat_threads
  FOR INSERT WITH CHECK (
    office_id = public.current_office_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "chat_threads_update_own" ON public.chat_threads
  FOR UPDATE USING (
    office_id = public.current_office_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "chat_threads_delete_own" ON public.chat_threads
  FOR DELETE USING (
    office_id = public.current_office_id()
    AND (user_id = auth.uid() OR public.has_office_role('admin'))
  );

-- ==================================================
-- 2. Tabela: chat_messages (mensagens do chat)
-- ==================================================
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- actions, citations, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_chat_messages_thread ON public.chat_messages(thread_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);

-- RLS (herda acesso do thread)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = chat_messages.thread_id
        AND t.office_id = public.current_office_id()
        AND (t.user_id = auth.uid() OR public.has_office_role('admin'))
    )
  );

CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = chat_messages.thread_id
        AND t.office_id = public.current_office_id()
        AND t.user_id = auth.uid()
    )
  );

-- ==================================================
-- 3. Tabela: assistant_memory (preferências do office)
-- ==================================================
CREATE TABLE public.assistant_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(office_id, key)
);

-- Índice
CREATE INDEX idx_assistant_memory_office ON public.assistant_memory(office_id);

-- RLS
ALTER TABLE public.assistant_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_memory_select" ON public.assistant_memory
  FOR SELECT USING (office_id = public.current_office_id());

CREATE POLICY "assistant_memory_upsert_admin" ON public.assistant_memory
  FOR ALL USING (
    office_id = public.current_office_id()
    AND public.has_office_role('admin')
  ) WITH CHECK (
    office_id = public.current_office_id()
    AND public.has_office_role('admin')
  );

-- ==================================================
-- 4. Função: Criar/obter thread para contexto
-- ==================================================
CREATE OR REPLACE FUNCTION public.get_or_create_chat_thread(
  p_scope TEXT DEFAULT 'global',
  p_case_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_route TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office UUID := current_office_id();
  v_user UUID := auth.uid();
  v_thread_id UUID;
BEGIN
  IF v_office IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Busca thread existente para este contexto
  SELECT id INTO v_thread_id
  FROM public.chat_threads
  WHERE office_id = v_office
    AND user_id = v_user
    AND scope = p_scope
    AND (p_case_id IS NULL OR case_id = p_case_id)
    AND (p_client_id IS NULL OR client_id = p_client_id)
  ORDER BY updated_at DESC
  LIMIT 1;

  -- Se não existe, cria novo
  IF v_thread_id IS NULL THEN
    INSERT INTO public.chat_threads (office_id, user_id, scope, case_id, client_id, route)
    VALUES (v_office, v_user, p_scope, p_case_id, p_client_id, p_route)
    RETURNING id INTO v_thread_id;
  ELSE
    -- Atualiza updated_at
    UPDATE public.chat_threads SET updated_at = now(), route = COALESCE(p_route, route)
    WHERE id = v_thread_id;
  END IF;

  RETURN v_thread_id;
END;
$$;

-- ==================================================
-- 5. Função: Obter contexto completo para IA
-- ==================================================
CREATE OR REPLACE FUNCTION public.get_assistant_context(
  p_case_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office UUID := current_office_id();
  v_result JSONB := '{}'::jsonb;
  v_office_data JSONB;
  v_case_data JSONB;
  v_client_data JSONB;
  v_memory JSONB;
BEGIN
  IF v_office IS NULL THEN
    RETURN jsonb_build_object('error', 'no_active_office');
  END IF;

  -- Dados do escritório
  SELECT jsonb_build_object(
    'name', o.name,
    'oab_uf', o.oab_uf,
    'oab_number', o.oab_number,
    'city', o.city,
    'state', o.state
  ) INTO v_office_data
  FROM public.offices o
  WHERE o.id = v_office;

  -- Memória do assistente
  SELECT jsonb_object_agg(key, value) INTO v_memory
  FROM public.assistant_memory
  WHERE office_id = v_office;

  v_result := jsonb_build_object(
    'office', v_office_data,
    'memory', COALESCE(v_memory, '{}'::jsonb)
  );

  -- Caso (se informado)
  IF p_case_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'cnj_number', c.cnj_number,
      'area', c.area,
      'subtype', c.subtype,
      'side', c.side,
      'status', c.status,
      'stage', c.stage,
      'opponent_name', c.opponent_name,
      'opponent_doc', c.opponent_doc,
      'nija_phase', c.nija_phase,
      'client_name', cl.full_name,
      'client_type', cl.person_type,
      'client_doc', COALESCE(cl.cpf, cl.cnpj)
    ) INTO v_case_data
    FROM public.cases c
    LEFT JOIN public.clients cl ON cl.id = c.client_id
    WHERE c.id = p_case_id AND c.office_id = v_office;

    v_result := v_result || jsonb_build_object('case', v_case_data);
  END IF;

  -- Cliente (se informado e não veio do caso)
  IF p_client_id IS NOT NULL AND p_case_id IS NULL THEN
    SELECT jsonb_build_object(
      'id', cl.id,
      'name', cl.full_name,
      'type', cl.person_type,
      'doc', COALESCE(cl.cpf, cl.cnpj),
      'email', cl.email,
      'phone', cl.phone
    ) INTO v_client_data
    FROM public.clients cl
    WHERE cl.id = p_client_id AND cl.office_id = v_office;

    v_result := v_result || jsonb_build_object('client', v_client_data);
  END IF;

  RETURN v_result;
END;
$$;

-- ==================================================
-- 6. Trigger para atualizar updated_at
-- ==================================================
CREATE TRIGGER set_chat_threads_updated_at
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_assistant_memory_updated_at
  BEFORE UPDATE ON public.assistant_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();