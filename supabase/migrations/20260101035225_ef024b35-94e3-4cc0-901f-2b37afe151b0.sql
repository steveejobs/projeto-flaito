-- =========================================
-- GOVERNANCE DIAMOND - MIGRATION IDEMPOTENTE
-- =========================================

-- 1) Helper: lexos_assert_admin (verifica ADMIN/OWNER)
CREATE OR REPLACE FUNCTION public.lexos_assert_admin(p_office_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role::text INTO v_role
  FROM public.office_members
  WHERE office_id = p_office_id AND user_id = auth.uid()
  LIMIT 1;
  
  RETURN v_role IN ('OWNER', 'ADMIN');
END;
$$;

-- 2) Tabela: frontend_audit_snapshots
CREATE TABLE IF NOT EXISTS public.frontend_audit_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  routes jsonb NOT NULL DEFAULT '[]'::jsonb,
  menu jsonb NOT NULL DEFAULT '[]'::jsonb,
  workflows jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash text NULL
);

CREATE INDEX IF NOT EXISTS frontend_audit_snapshots_office_idx 
ON public.frontend_audit_snapshots (office_id, created_at DESC);

ALTER TABLE public.frontend_audit_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS frontend_audit_snapshots_select ON public.frontend_audit_snapshots;
CREATE POLICY frontend_audit_snapshots_select ON public.frontend_audit_snapshots
FOR SELECT USING (public.lexos_assert_admin(office_id));

DROP POLICY IF EXISTS frontend_audit_snapshots_insert ON public.frontend_audit_snapshots;
CREATE POLICY frontend_audit_snapshots_insert ON public.frontend_audit_snapshots
FOR INSERT WITH CHECK (public.lexos_assert_admin(office_id) AND created_by = auth.uid());

-- 3) Tabela: rebuild_jobs
CREATE TABLE IF NOT EXISTS public.rebuild_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  audit_snapshot_id uuid REFERENCES public.audit_snapshots(id),
  frontend_snapshot_id uuid REFERENCES public.frontend_audit_snapshots(id),
  mode text NOT NULL DEFAULT 'PLAN' CHECK (mode IN ('PLAN', 'APPLY_SAFE', 'EXPORT')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')),
  rebuild_plan_md text,
  schema_sql text,
  rls_sql text,
  functions_sql text,
  error_message text,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS rebuild_jobs_office_idx 
ON public.rebuild_jobs (office_id, created_at DESC);

ALTER TABLE public.rebuild_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rebuild_jobs_select ON public.rebuild_jobs;
CREATE POLICY rebuild_jobs_select ON public.rebuild_jobs
FOR SELECT USING (public.lexos_assert_admin(office_id));

DROP POLICY IF EXISTS rebuild_jobs_insert ON public.rebuild_jobs;
CREATE POLICY rebuild_jobs_insert ON public.rebuild_jobs
FOR INSERT WITH CHECK (public.lexos_assert_admin(office_id) AND created_by = auth.uid());

-- 4) Tabela: system_telemetry
CREATE TABLE IF NOT EXISTS public.system_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  kind text NOT NULL CHECK (kind IN ('UI_ERROR', 'RPC_ERROR', 'EDGE_CALL', 'PERF', 'SECURITY_EVENT', 'TELEMETRY')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  route text,
  duration_ms integer
);

CREATE INDEX IF NOT EXISTS system_telemetry_office_idx 
ON public.system_telemetry (office_id, created_at DESC);

CREATE INDEX IF NOT EXISTS system_telemetry_kind_idx 
ON public.system_telemetry (kind, created_at DESC);

ALTER TABLE public.system_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_telemetry_select ON public.system_telemetry;
CREATE POLICY system_telemetry_select ON public.system_telemetry
FOR SELECT USING (public.lexos_assert_admin(office_id));

DROP POLICY IF EXISTS system_telemetry_insert ON public.system_telemetry;
CREATE POLICY system_telemetry_insert ON public.system_telemetry
FOR INSERT WITH CHECK (office_id IS NULL OR public.lexos_assert_admin(office_id));

-- 5) Garantir metadata em offices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'offices' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.offices ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 6) RPC: lexos_audit_db_snapshot
CREATE OR REPLACE FUNCTION public.lexos_audit_db_snapshot(p_office_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, extensions, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_tables jsonb;
  v_policies jsonb;
  v_functions jsonb;
  v_grants jsonb;
BEGIN
  -- Verificar permissão
  IF NOT public.lexos_assert_admin(p_office_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas ADMIN/OWNER';
  END IF;

  -- Tabelas com RLS
  SELECT jsonb_agg(jsonb_build_object(
    'name', c.relname,
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity,
    'kind', CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' WHEN 'm' THEN 'matview' WHEN 'p' THEN 'partitioned' END
  ))
  INTO v_tables
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm');

  -- Policies
  SELECT jsonb_agg(jsonb_build_object(
    'table', tablename,
    'name', policyname,
    'cmd', cmd,
    'permissive', permissive,
    'roles', roles,
    'qual', qual,
    'with_check', with_check
  ))
  INTO v_policies
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public';

  -- Funções
  SELECT jsonb_agg(jsonb_build_object(
    'name', p.proname,
    'args', pg_catalog.pg_get_function_identity_arguments(p.oid),
    'security_definer', p.prosecdef,
    'config', p.proconfig,
    'volatile', p.provolatile
  ))
  INTO v_functions
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public';

  -- Grants de funções
  SELECT jsonb_agg(jsonb_build_object(
    'routine', routine_name,
    'grantee', grantee,
    'privilege', privilege_type
  ))
  INTO v_grants
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public' AND privilege_type = 'EXECUTE';

  v_result := jsonb_build_object(
    'tables', COALESCE(v_tables, '[]'::jsonb),
    'policies', COALESCE(v_policies, '[]'::jsonb),
    'functions', COALESCE(v_functions, '[]'::jsonb),
    'grants', COALESCE(v_grants, '[]'::jsonb),
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;

-- 7) RPC: lexos_audit_matrix_access
CREATE OR REPLACE FUNCTION public.lexos_audit_matrix_access(p_office_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, extensions, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_tables jsonb;
  v_roles text[] := ARRAY['OWNER', 'ADMIN', 'MEMBER', 'anon', 'authenticated'];
BEGIN
  IF NOT public.lexos_assert_admin(p_office_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas ADMIN/OWNER';
  END IF;

  -- Matriz de acesso por tabela
  SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'rls_enabled', c.relrowsecurity,
    'policies', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', p.policyname,
        'cmd', p.cmd,
        'roles', p.roles
      ))
      FROM pg_catalog.pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
    )
  ))
  INTO v_tables
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';

  v_result := jsonb_build_object(
    'matrix', COALESCE(v_tables, '[]'::jsonb),
    'roles', to_jsonb(v_roles),
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;

-- 8) RPC: lexos_audit_health
CREATE OR REPLACE FUNCTION public.lexos_audit_health(p_office_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, extensions, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_kpis jsonb;
  v_errors jsonb;
BEGIN
  IF NOT public.lexos_assert_admin(p_office_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas ADMIN/OWNER';
  END IF;

  -- KPIs básicos
  SELECT jsonb_build_object(
    'clients_count', (SELECT count(*) FROM public.clients WHERE office_id = p_office_id),
    'cases_count', (SELECT count(*) FROM public.cases WHERE office_id = p_office_id AND deleted_at IS NULL),
    'documents_count', (SELECT count(*) FROM public.documents WHERE office_id = p_office_id),
    'members_count', (SELECT count(*) FROM public.office_members WHERE office_id = p_office_id)
  ) INTO v_kpis;

  -- Últimos erros de telemetria
  SELECT jsonb_agg(jsonb_build_object(
    'kind', kind,
    'payload', payload,
    'created_at', created_at
  ))
  INTO v_errors
  FROM (
    SELECT kind, payload, created_at
    FROM public.system_telemetry
    WHERE office_id = p_office_id AND kind IN ('UI_ERROR', 'RPC_ERROR')
    ORDER BY created_at DESC
    LIMIT 20
  ) sub;

  v_result := jsonb_build_object(
    'kpis', v_kpis,
    'recent_errors', COALESCE(v_errors, '[]'::jsonb),
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;

-- 9) RPC: lexos_audit_save_full_snapshot
CREATE OR REPLACE FUNCTION public.lexos_audit_save_full_snapshot(
  p_office_id uuid,
  p_frontend_manifest jsonb,
  p_edge_manifest jsonb,
  p_mode text DEFAULT 'FULL'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, extensions, pg_temp
AS $$
DECLARE
  v_db_snapshot jsonb;
  v_snapshot_id uuid;
  v_frontend_id uuid;
  v_report text;
  v_risks jsonb;
  v_meta jsonb;
BEGIN
  IF NOT public.lexos_assert_admin(p_office_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas ADMIN/OWNER';
  END IF;

  -- Coletar DB snapshot
  v_db_snapshot := public.lexos_audit_db_snapshot(p_office_id);

  -- Salvar frontend snapshot
  INSERT INTO public.frontend_audit_snapshots (office_id, created_by, manifest, routes, menu, workflows)
  VALUES (
    p_office_id,
    auth.uid(),
    p_frontend_manifest,
    COALESCE(p_frontend_manifest->'routes', '[]'::jsonb),
    COALESCE(p_frontend_manifest->'menu', '[]'::jsonb),
    COALESCE(p_frontend_manifest->'workflows', '{}'::jsonb)
  )
  RETURNING id INTO v_frontend_id;

  -- Construir meta e riscos
  v_meta := jsonb_build_object(
    'frontend_snapshot_id', v_frontend_id,
    'db_snapshot', v_db_snapshot,
    'edge_manifest', p_edge_manifest,
    'mode', p_mode
  );

  v_risks := jsonb_build_object(
    'critico', 0,
    'alto', 0,
    'medio', 0,
    'baixo', 0
  );

  v_report := '# Snapshot de Governança' || E'\n\n' ||
    '**Gerado em:** ' || now()::text || E'\n' ||
    '**Modo:** ' || p_mode || E'\n\n' ||
    '## Resumo' || E'\n' ||
    '- Tabelas: ' || jsonb_array_length(COALESCE(v_db_snapshot->'tables', '[]'::jsonb))::text || E'\n' ||
    '- Policies: ' || jsonb_array_length(COALESCE(v_db_snapshot->'policies', '[]'::jsonb))::text || E'\n' ||
    '- Funções: ' || jsonb_array_length(COALESCE(v_db_snapshot->'functions', '[]'::jsonb))::text || E'\n';

  -- Salvar audit_snapshots
  INSERT INTO public.audit_snapshots (office_id, created_by, status, report_md, meta, risk, source)
  VALUES (p_office_id, auth.uid(), 'DONE', v_report, v_meta, v_risks, 'governance')
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;

-- 10) RPC: lexos_policy_simulate
CREATE OR REPLACE FUNCTION public.lexos_policy_simulate(
  p_office_id uuid,
  p_role text,
  p_user_id uuid DEFAULT NULL,
  p_case_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, extensions, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_tables jsonb;
  v_functions jsonb;
  v_routes jsonb;
BEGIN
  IF NOT public.lexos_assert_admin(p_office_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas ADMIN/OWNER';
  END IF;

  -- Simular acesso a tabelas baseado no role
  SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'rls_enabled', c.relrowsecurity,
    'select', CASE WHEN c.relrowsecurity THEN 'depende_policy' ELSE 'permitido' END,
    'insert', CASE WHEN c.relrowsecurity THEN 'depende_policy' ELSE 'permitido' END,
    'update', CASE WHEN c.relrowsecurity THEN 'depende_policy' ELSE 'permitido' END,
    'delete', CASE WHEN c.relrowsecurity THEN 'depende_policy' ELSE 'permitido' END,
    'policies_count', (
      SELECT count(*) FROM pg_catalog.pg_policies p 
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
    )
  ))
  INTO v_tables
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';

  -- Funções com EXECUTE para o role
  SELECT jsonb_agg(jsonb_build_object(
    'function', routine_name,
    'grantee', grantee,
    'can_execute', true
  ))
  INTO v_functions
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public' 
    AND privilege_type = 'EXECUTE'
    AND (
      grantee = 'PUBLIC' 
      OR grantee = 'authenticated'
      OR (p_role = 'anon' AND grantee = 'anon')
    );

  -- Rotas simuladas baseadas no role
  v_routes := jsonb_build_array(
    jsonb_build_object('path', '/dashboard', 'min_role', 'MEMBER', 'allowed', p_role IN ('MEMBER', 'ADMIN', 'OWNER')),
    jsonb_build_object('path', '/system/governanca', 'min_role', 'ADMIN', 'allowed', p_role IN ('ADMIN', 'OWNER')),
    jsonb_build_object('path', '/system/environments', 'min_role', 'OWNER', 'allowed', p_role = 'OWNER')
  );

  v_result := jsonb_build_object(
    'simulated_role', p_role,
    'user_id', p_user_id,
    'case_id', p_case_id,
    'tables', COALESCE(v_tables, '[]'::jsonb),
    'functions', COALESCE(v_functions, '[]'::jsonb),
    'routes', v_routes,
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;

-- 11) RPC: lexos_promote_release
CREATE OR REPLACE FUNCTION public.lexos_promote_release(
  p_office_id uuid,
  p_snapshot_id uuid,
  p_target text DEFAULT 'PROD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, extensions, pg_temp
AS $$
DECLARE
  v_role text;
  v_snapshot record;
  v_health jsonb;
BEGIN
  -- Verificar se é OWNER
  SELECT role::text INTO v_role
  FROM public.office_members
  WHERE office_id = p_office_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_role != 'OWNER' THEN
    RAISE EXCEPTION 'Apenas OWNER pode promover releases';
  END IF;

  -- Verificar snapshot
  SELECT * INTO v_snapshot
  FROM public.audit_snapshots
  WHERE id = p_snapshot_id AND office_id = p_office_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot não encontrado';
  END IF;

  IF v_snapshot.status != 'DONE' THEN
    RAISE EXCEPTION 'Snapshot deve estar com status DONE';
  END IF;

  -- Verificar health
  v_health := public.lexos_audit_health(p_office_id);

  -- Registrar evento de promoção
  INSERT INTO public.system_telemetry (office_id, user_id, kind, payload)
  VALUES (
    p_office_id,
    auth.uid(),
    'SECURITY_EVENT',
    jsonb_build_object(
      'event', 'RELEASE_PROMOTED',
      'target', p_target,
      'snapshot_id', p_snapshot_id,
      'health', v_health
    )
  );

  -- Atualizar metadata do office
  UPDATE public.offices
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{release}',
    jsonb_build_object(
      'promoted_at', now(),
      'promoted_by', auth.uid(),
      'snapshot_id', p_snapshot_id,
      'target', p_target
    )
  )
  WHERE id = p_office_id;

  RETURN jsonb_build_object(
    'success', true,
    'promoted_at', now(),
    'target', p_target,
    'snapshot_id', p_snapshot_id
  );
END;
$$;

-- 12) RPC: lexos_telemetry_log
CREATE OR REPLACE FUNCTION public.lexos_telemetry_log(
  p_office_id uuid,
  p_kind text,
  p_payload jsonb,
  p_route text DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.system_telemetry (office_id, user_id, kind, payload, route, duration_ms)
  VALUES (p_office_id, auth.uid(), p_kind, p_payload, p_route, p_duration_ms)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- 13) View: vw_lexos_risks
CREATE OR REPLACE VIEW public.vw_lexos_risks AS
SELECT 
  'table_no_rls' AS risk_type,
  'ALTO' AS severity,
  c.relname AS object_name,
  'Tabela sem RLS habilitado' AS description
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r' 
  AND NOT c.relrowsecurity
  AND c.relname IN ('clients', 'cases', 'documents', 'generated_docs', 'agenda_items', 'office_members')

UNION ALL

SELECT 
  'function_security_definer' AS risk_type,
  'MEDIO' AS severity,
  p.proname AS object_name,
  'Função com SECURITY DEFINER' AS description
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = true

UNION ALL

SELECT 
  'function_no_search_path' AS risk_type,
  'ALTO' AS severity,
  p.proname AS object_name,
  'Função sem search_path fixo' AS description
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.prosecdef = true 
  AND (p.proconfig IS NULL OR NOT 'search_path' = ANY(SELECT split_part(unnest(p.proconfig), '=', 1)));

-- Grants
GRANT EXECUTE ON FUNCTION public.lexos_assert_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_audit_db_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_audit_matrix_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_audit_health(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_audit_save_full_snapshot(uuid, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_policy_simulate(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_promote_release(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_telemetry_log(uuid, text, jsonb, text, integer) TO authenticated;
GRANT SELECT ON public.vw_lexos_risks TO authenticated;