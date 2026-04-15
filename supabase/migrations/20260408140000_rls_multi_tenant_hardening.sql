-- Migration: 20260408140000_rls_multi_tenant_hardening.sql
-- Goal: Production-grade RLS and RPC security for Multi-Tenant isolation

BEGIN;

-- ============================================================
-- 1. HARDENING: medical_safety_audits
-- ============================================================
ALTER TABLE public.medical_safety_audits ENABLE ROW LEVEL SECURITY;

-- Cleanup legacy policies (Drop before replace to avoid OR bypass)
DROP POLICY IF EXISTS "Admins can view safety audits for their office" ON public.medical_safety_audits;
DROP POLICY IF EXISTS "Allow authenticated insert for safety audits" ON public.medical_safety_audits;

-- SELECT: Restrito a Admins/Owners do MESMO escritório
CREATE POLICY "safety_audits_select_secure" ON public.medical_safety_audits
FOR SELECT TO authenticated
USING (
  office_id IN (
    SELECT om.office_id FROM public.office_members om
    WHERE om.user_id = auth.uid() 
      AND om.is_active = true 
      AND om.role IN ('owner', 'admin')
  )
);

-- INSERT: Restrito a membros ATIVOS do MESMO escritório (Zero Trust via WITH CHECK)
CREATE POLICY "safety_audits_insert_secure" ON public.medical_safety_audits
FOR INSERT TO authenticated
WITH CHECK (
  office_id IN (
    SELECT om.office_id FROM public.office_members om
    WHERE om.user_id = auth.uid() 
      AND om.is_active = true
  )
);


-- ============================================================
-- 2. HARDENING: medical_governance_recommendations
-- ============================================================
ALTER TABLE public.medical_governance_recommendations ENABLE ROW LEVEL SECURITY;

-- Cleanup legacy policies
DROP POLICY IF EXISTS "governance_recommendations_office_access" ON public.medical_governance_recommendations;
DROP POLICY IF EXISTS "governance_admin_all" ON public.medical_governance_recommendations;

-- SELECT: Qualquer membro do escritório
CREATE POLICY "gov_rec_select_secure" ON public.medical_governance_recommendations
FOR SELECT TO authenticated
USING (
  office_id IN (
    SELECT om.office_id FROM public.office_members om
    WHERE om.user_id = auth.uid() 
      AND om.is_active = true
  )
);

-- ALL (INSERT/UPDATE/DELETE): Restrito a Admins/Owners do MESMO escritório
CREATE POLICY "gov_rec_admin_modify_secure" ON public.medical_governance_recommendations
FOR ALL TO authenticated
USING (
  office_id IN (
    SELECT om.office_id FROM public.office_members om
    WHERE om.user_id = auth.uid() 
      AND om.is_active = true 
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  office_id IN (
    SELECT om.office_id FROM public.office_members om
    WHERE om.user_id = auth.uid() 
      AND om.is_active = true 
      AND om.role IN ('owner', 'admin')
  )
);


-- ============================================================
-- 3. HARDENING: medical_governance_snapshots
-- ============================================================
ALTER TABLE public.medical_governance_snapshots ENABLE ROW LEVEL SECURITY;

-- Cleanup legacy policies
DROP POLICY IF EXISTS "governance_snapshots_office_access" ON public.medical_governance_snapshots;

-- SELECT: Qualquer membro do escritório
CREATE POLICY "gov_snap_select_secure" ON public.medical_governance_snapshots
FOR SELECT TO authenticated
USING (
  office_id IN (
    SELECT om.office_id FROM public.office_members om
    WHERE om.user_id = auth.uid() 
      AND om.is_active = true
  )
);


-- ============================================================
-- 4. HARDENING RPC: get_agenda_month_bundle
-- ============================================================
-- Recriação da função com guards de segurança robustos
CREATE OR REPLACE FUNCTION public.get_agenda_month_bundle(
  p_office_id uuid,
  p_year int,
  p_month int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Prevenção de Search Path Hijacking
AS $$
DECLARE
  v_start_date date;
  v_end_date date;
  v_is_member boolean;
BEGIN
  -- SEGURANÇA: Validar membership antes de qualquer processamento (Fail-Fast)
  SELECT EXISTS (
    SELECT 1 FROM public.office_members
    WHERE office_id = p_office_id
      AND user_id = auth.uid()
      AND is_active = true
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'BLOQUEIO DE SEGURANÇA: Usuário não pertence ao escritório solicitado (%ID: %)', p_office_id, auth.uid();
  END IF;

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

-- Ajuste de privilégios (Least Privilege)
REVOKE ALL ON FUNCTION public.get_agenda_month_bundle(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agenda_month_bundle(uuid, int, int) TO authenticated;


COMMIT;
