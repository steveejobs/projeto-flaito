-- Corrigir RPC para preencher campos obrigatórios: tipo e ementa
CREATE OR REPLACE FUNCTION public.lexos_save_legal_precedent(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_id uuid;
  v_office_id uuid;
  v_tipo text;
  v_ementa text;
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

  -- Garante valores para campos obrigatórios
  v_tipo := coalesce(nullif(p->>'kind',''), nullif(p->>'tipo',''), 'Precedente');
  v_ementa := coalesce(nullif(p->>'thesis',''), nullif(p->>'ementa',''), 'Sem ementa');

  -- insere usando nomes corretos das colunas
  insert into public.legal_precedents (
    office_id,
    created_by,
    title,
    tribunal,
    tipo,
    kind,
    numero,
    thesis,
    ementa,
    link,
    source,
    is_curated,
    palavras_chave,
    created_at
  )
  values (
    v_office_id,
    auth.uid(),
    nullif(p->>'title',''),
    coalesce(nullif(p->>'tribunal',''), 'Não especificado'),
    v_tipo,
    v_tipo,
    nullif(p->>'number',''),
    nullif(p->>'thesis',''),
    v_ementa,
    nullif(p->>'url',''),
    coalesce(nullif(p->>'source',''), 'AI_SUGGESTED'),
    coalesce((p->>'is_curated')::boolean, false),
    '{}',
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;