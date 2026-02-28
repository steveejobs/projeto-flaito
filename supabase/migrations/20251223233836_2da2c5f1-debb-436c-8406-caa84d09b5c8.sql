CREATE OR REPLACE FUNCTION public.lexos_save_legal_precedent(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_id uuid;
  v_office_id uuid;
begin
  perform public.lexos_assert_admin();

  -- tenta obter office_id do usuário
  select om.office_id into v_office_id
  from public.office_members om
  where om.user_id = auth.uid()
    and coalesce(om.is_active,true) = true
  order by om.created_at nulls last
  limit 1;

  if v_office_id is null then
    raise exception 'NO_OFFICE_FOR_USER';
  end if;

  -- insere usando nomes corretos das colunas
  insert into public.legal_precedents (
    office_id,
    created_by,
    title,
    tribunal,
    kind,
    numero,
    thesis,
    link,
    source,
    is_curated,
    created_at
  )
  values (
    v_office_id,
    auth.uid(),
    nullif(p->>'title',''),
    nullif(p->>'tribunal',''),
    nullif(p->>'kind',''),
    nullif(p->>'number',''),
    nullif(p->>'thesis',''),
    nullif(p->>'url',''),
    coalesce(nullif(p->>'source',''), 'AI_SUGGESTED'),
    coalesce((p->>'is_curated')::boolean, false),
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;