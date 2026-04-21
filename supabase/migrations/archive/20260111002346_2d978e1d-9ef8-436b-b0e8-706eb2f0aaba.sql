-- ============================================
-- NIJA LOGGING SYSTEM - Tabela + RPC + Policies
-- ============================================

-- 1. CRIAR TABELA DE LOGS
CREATE TABLE IF NOT EXISTS public.nija_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  source text NOT NULL,
  action text NOT NULL,
  office_id uuid NULL REFERENCES public.offices(id) ON DELETE SET NULL,
  case_id uuid NULL REFERENCES public.cases(id) ON DELETE SET NULL,
  session_id text NULL,
  user_id uuid NULL,
  payload jsonb NULL,
  result jsonb NULL,
  error jsonb NULL,
  duration_ms integer NULL
);

-- 2. CRIAR ÍNDICES PARA CONSULTAS EFICIENTES
CREATE INDEX IF NOT EXISTS idx_nija_logs_created_at ON public.nija_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nija_logs_office_id ON public.nija_logs(office_id) WHERE office_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nija_logs_case_id ON public.nija_logs(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nija_logs_level ON public.nija_logs(level);
CREATE INDEX IF NOT EXISTS idx_nija_logs_source ON public.nija_logs(source);

-- 3. HABILITAR RLS
ALTER TABLE public.nija_logs ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES - SELECT apenas para mesmo office ou admin
DROP POLICY IF EXISTS nija_logs_select_office ON public.nija_logs;
CREATE POLICY nija_logs_select_office ON public.nija_logs
  FOR SELECT
  USING (
    office_id IS NULL 
    OR office_id = current_office_id()
    OR EXISTS (
      SELECT 1 FROM office_members om
      WHERE om.user_id = auth.uid() 
        AND om.office_id = nija_logs.office_id
        AND om.is_active = true
        AND lower(om.role) IN ('owner', 'admin')
    )
  );

-- 5. BLOQUEAR INSERT DIRETO (somente via RPC)
DROP POLICY IF EXISTS nija_logs_insert_deny ON public.nija_logs;
CREATE POLICY nija_logs_insert_deny ON public.nija_logs
  FOR INSERT
  WITH CHECK (false);

-- 6. RPC PARA LOGGING (SECURITY DEFINER - NUNCA FALHA)
CREATE OR REPLACE FUNCTION public.lexos_nija_log_event(
  p_level text,
  p_source text,
  p_action text,
  p_office_id uuid DEFAULT NULL,
  p_case_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_payload jsonb DEFAULT NULL,
  p_result jsonb DEFAULT NULL,
  p_error jsonb DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_id uuid;
  v_user_id uuid;
  v_level text;
BEGIN
  -- Obter user_id (pode ser null para chamadas anônimas)
  v_user_id := auth.uid();
  
  -- Validar level (default INFO se inválido)
  v_level := CASE 
    WHEN upper(p_level) IN ('INFO', 'WARN', 'ERROR') THEN upper(p_level)
    ELSE 'INFO'
  END;
  
  -- INSERT direto (bypass RLS via SECURITY DEFINER)
  INSERT INTO nija_logs (
    level,
    source,
    action,
    office_id,
    case_id,
    session_id,
    user_id,
    payload,
    result,
    error,
    duration_ms
  ) VALUES (
    v_level,
    COALESCE(p_source, 'unknown'),
    COALESCE(p_action, 'unknown'),
    p_office_id,
    p_case_id,
    p_session_id,
    v_user_id,
    p_payload,
    p_result,
    p_error,
    p_duration_ms
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
  
EXCEPTION WHEN OTHERS THEN
  -- NUNCA lançar exceção - log não pode quebrar fluxo
  RETURN NULL;
END;
$$;

-- 7. GRANT EXECUTE
GRANT EXECUTE ON FUNCTION public.lexos_nija_log_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_nija_log_event TO anon;

-- 8. ATUALIZAR RPCs EXISTENTES PARA INCLUIR LOGGING

-- 8.1 lexos_nija_insert_analysis COM LOGGING
CREATE OR REPLACE FUNCTION public.lexos_nija_insert_analysis(
  p_documents_hash text,
  p_analysis_key text,
  p_analysis jsonb,
  p_case_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_id uuid;
  v_user_id uuid;
  v_office_id uuid;
  v_start_time timestamptz;
  v_duration_ms integer;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Obter user_id autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    -- Log de erro
    PERFORM lexos_nija_log_event(
      'ERROR', 
      'RPC:lexos_nija_insert_analysis', 
      'AUTH_FAIL',
      NULL, p_case_id, p_session_id,
      jsonb_build_object('documents_hash', p_documents_hash),
      NULL,
      jsonb_build_object('message', 'Usuário não autenticado', 'code', 'AUTH_REQUIRED'),
      NULL
    );
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Obter office_id do usuário
  SELECT om.office_id INTO v_office_id
  FROM office_members om
  WHERE om.user_id = v_user_id AND COALESCE(om.is_active, true) = true
  ORDER BY (lower(om.role) = 'owner') DESC, om.created_at DESC
  LIMIT 1;
  
  -- Log de início
  PERFORM lexos_nija_log_event(
    'INFO', 
    'RPC:lexos_nija_insert_analysis', 
    'RPC_START',
    v_office_id, p_case_id, p_session_id,
    jsonb_build_object(
      'documents_hash', p_documents_hash,
      'analysis_key', p_analysis_key,
      'has_case_id', p_case_id IS NOT NULL
    ),
    NULL, NULL, NULL
  );
  
  -- Se tem case_id, validar que pertence ao office
  IF p_case_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM cases c 
      WHERE c.id = p_case_id AND c.office_id = v_office_id
    ) THEN
      v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::integer;
      PERFORM lexos_nija_log_event(
        'ERROR', 
        'RPC:lexos_nija_insert_analysis', 
        'CASE_ACCESS_DENIED',
        v_office_id, p_case_id, p_session_id,
        NULL, NULL,
        jsonb_build_object('message', 'Caso não pertence ao escritório', 'code', 'ACCESS_DENIED'),
        v_duration_ms
      );
      RAISE EXCEPTION 'Caso não pertence ao escritório do usuário';
    END IF;
  END IF;
  
  -- Inserir análise
  INSERT INTO nija_case_analysis (
    documents_hash,
    analysis_key,
    analysis,
    case_id,
    session_id
  ) VALUES (
    p_documents_hash,
    p_analysis_key,
    p_analysis,
    p_case_id,
    p_session_id
  )
  RETURNING id INTO v_id;
  
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::integer;
  
  -- Log de sucesso
  PERFORM lexos_nija_log_event(
    'INFO', 
    'RPC:lexos_nija_insert_analysis', 
    'RPC_SUCCESS',
    v_office_id, p_case_id, p_session_id,
    NULL,
    jsonb_build_object('inserted_id', v_id),
    NULL,
    v_duration_ms
  );
  
  RETURN v_id;

EXCEPTION WHEN OTHERS THEN
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::integer;
  PERFORM lexos_nija_log_event(
    'ERROR', 
    'RPC:lexos_nija_insert_analysis', 
    'RPC_EXCEPTION',
    v_office_id, p_case_id, p_session_id,
    jsonb_build_object('documents_hash', p_documents_hash),
    NULL,
    jsonb_build_object('message', SQLERRM, 'state', SQLSTATE),
    v_duration_ms
  );
  RAISE;
END;
$$;

-- 8.2 lexos_nija_insert_piece COM LOGGING
CREATE OR REPLACE FUNCTION public.lexos_nija_insert_piece(
  p_piece_type text,
  p_documents_hash text,
  p_case_id uuid,
  p_piece jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_id uuid;
  v_user_id uuid;
  v_office_id uuid;
  v_start_time timestamptz;
  v_duration_ms integer;
BEGIN
  v_start_time := clock_timestamp();
  
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    PERFORM lexos_nija_log_event(
      'ERROR', 
      'RPC:lexos_nija_insert_piece', 
      'AUTH_FAIL',
      NULL, p_case_id, NULL,
      jsonb_build_object('piece_type', p_piece_type),
      NULL,
      jsonb_build_object('message', 'Usuário não autenticado', 'code', 'AUTH_REQUIRED'),
      NULL
    );
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  SELECT om.office_id INTO v_office_id
  FROM office_members om
  WHERE om.user_id = v_user_id AND COALESCE(om.is_active, true) = true
  LIMIT 1;
  
  -- Log de início
  PERFORM lexos_nija_log_event(
    'INFO', 
    'RPC:lexos_nija_insert_piece', 
    'RPC_START',
    v_office_id, p_case_id, NULL,
    jsonb_build_object('piece_type', p_piece_type, 'documents_hash', p_documents_hash),
    NULL, NULL, NULL
  );
  
  -- Validar case pertence ao office
  IF NOT EXISTS (
    SELECT 1 FROM cases c 
    WHERE c.id = p_case_id AND c.office_id = v_office_id
  ) THEN
    v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::integer;
    PERFORM lexos_nija_log_event(
      'ERROR', 
      'RPC:lexos_nija_insert_piece', 
      'CASE_ACCESS_DENIED',
      v_office_id, p_case_id, NULL,
      NULL, NULL,
      jsonb_build_object('message', 'Caso não pertence ao escritório', 'code', 'ACCESS_DENIED'),
      v_duration_ms
    );
    RAISE EXCEPTION 'Caso não pertence ao escritório do usuário';
  END IF;
  
  INSERT INTO nija_generated_pieces (
    piece_type,
    documents_hash,
    case_id,
    piece
  ) VALUES (
    p_piece_type,
    p_documents_hash,
    p_case_id,
    p_piece
  )
  RETURNING id INTO v_id;
  
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::integer;
  
  -- Log de sucesso
  PERFORM lexos_nija_log_event(
    'INFO', 
    'RPC:lexos_nija_insert_piece', 
    'RPC_SUCCESS',
    v_office_id, p_case_id, NULL,
    NULL,
    jsonb_build_object('inserted_id', v_id),
    NULL,
    v_duration_ms
  );
  
  RETURN v_id;

EXCEPTION WHEN OTHERS THEN
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::integer;
  PERFORM lexos_nija_log_event(
    'ERROR', 
    'RPC:lexos_nija_insert_piece', 
    'RPC_EXCEPTION',
    v_office_id, p_case_id, NULL,
    jsonb_build_object('piece_type', p_piece_type),
    NULL,
    jsonb_build_object('message', SQLERRM, 'state', SQLSTATE),
    v_duration_ms
  );
  RAISE;
END;
$$;