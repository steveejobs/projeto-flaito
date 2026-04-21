-- Corrigir função lexos_normalize_role com search_path
DROP FUNCTION IF EXISTS public.lexos_normalize_role(text);

CREATE OR REPLACE FUNCTION public.lexos_normalize_role(p_role text)
RETURNS office_role
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
  declare
    v text;
  begin
    v := upper(trim(coalesce(p_role,'')));

    if v in ('OWNER','ADMIN','MEMBER') then
      return v::public.office_role;
    end if;

    raise exception 'ROLE_INVALIDA: % (use OWNER|ADMIN|MEMBER)', p_role
      using errcode = '22023';
  end;
$$;

-- Outras funções faltantes
DROP FUNCTION IF EXISTS public.clone_template_for_edit(uuid);

CREATE OR REPLACE FUNCTION public.clone_template_for_edit(p_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_office_id uuid;
BEGIN
  SELECT office_id INTO v_office_id FROM templates WHERE id = p_template_id;
  
  INSERT INTO templates (office_id, name, kind, content, is_default, version)
  SELECT v_office_id, name || ' (cópia)', kind, content, false, 1
  FROM templates WHERE id = p_template_id
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Função get_case_payments
DROP FUNCTION IF EXISTS public.get_case_payments(uuid);

CREATE OR REPLACE FUNCTION public.get_case_payments(p_case_id uuid)
RETURNS TABLE (
  id uuid,
  value numeric,
  status text,
  billing_type text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 
    id,
    value,
    status::text,
    billing_type::text,
    due_date,
    paid_at,
    created_at
  FROM asaas_payments
  WHERE case_id = p_case_id
  ORDER BY created_at DESC;
$$;

-- Função make_precedent_code
DROP FUNCTION IF EXISTS public.make_precedent_code(precedent_kind, text, text);

CREATE OR REPLACE FUNCTION public.make_precedent_code(
  p_kind precedent_kind, 
  p_court text, 
  p_number text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CONCAT(p_kind::text, '_', UPPER(p_court), '_', p_number);
$$;

-- Função sync_stj_sumulas_first_load (stub seguro)
DROP FUNCTION IF EXISTS public.sync_stj_sumulas_first_load();

CREATE OR REPLACE FUNCTION public.sync_stj_sumulas_first_load()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Placeholder para sincronização de súmulas STJ
  RAISE NOTICE 'sync_stj_sumulas_first_load chamada';
END;
$$;

-- Conceder permissões para authenticated nas funções criadas
GRANT EXECUTE ON FUNCTION public.lexos_normalize_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_template_for_edit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_case_payments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.make_precedent_code(precedent_kind, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_stj_sumulas_first_load() TO authenticated;