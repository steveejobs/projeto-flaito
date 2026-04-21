-- Conceder permissão de execução na função lexos_nija_create_case para usuários autenticados
GRANT EXECUTE ON FUNCTION public.lexos_nija_create_case(uuid, public.case_side, text, text, uuid) TO authenticated;

-- Também garantir que a função tenha SECURITY DEFINER para acessar tabelas com RLS
-- (Recriar a função com SECURITY DEFINER caso não tenha)
CREATE OR REPLACE FUNCTION public.lexos_nija_create_case(
  p_client_id uuid,
  p_side public.case_side,
  p_title text,
  p_stage text DEFAULT 'pre_processual',
  p_subject_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
  v_user_id uuid;
  v_case_id uuid;
BEGIN
  -- Obter user_id e office_id do usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Buscar office_id do usuário
  SELECT office_id INTO v_office_id
  FROM public.office_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhum escritório';
  END IF;

  -- Inserir o caso
  INSERT INTO public.cases (
    client_id,
    side,
    title,
    stage,
    subject_id,
    office_id,
    created_by,
    status
  ) VALUES (
    p_client_id,
    p_side,
    p_title,
    p_stage,
    p_subject_id,
    v_office_id,
    v_user_id,
    'ativo'
  )
  RETURNING id INTO v_case_id;

  RETURN v_case_id;
END;
$$;

-- Garantir permissão após recriar
GRANT EXECUTE ON FUNCTION public.lexos_nija_create_case(uuid, public.case_side, text, text, uuid) TO authenticated;