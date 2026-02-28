-- Ajustar RPC: normalizar também o campo `tipo` conforme constraint legal_precedents_tipo_check
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
  v_kind text;
  v_ementa text;
  v_raw_kind text;
  v_norm text;
begin
  perform public.lexos_assert_admin();

  select om.office_id into v_office_id
  from public.office_members om
  where om.user_id = auth.uid()
    and coalesce(om.is_active,true) = true
  order by om.created_at nulls last
  limit 1;

  if v_office_id is null then
    raise exception 'NO_OFFICE_FOR_USER';
  end if;

  v_raw_kind := coalesce(nullif(p->>'kind',''), nullif(p->>'tipo',''), 'Precedente');

  -- Normalização simples (sem extensão unaccent)
  v_norm := upper(v_raw_kind);
  v_norm := replace(v_norm, 'Ú', 'U');
  v_norm := replace(v_norm, 'Ã', 'A');
  v_norm := replace(v_norm, 'Ç', 'C');
  v_norm := replace(v_norm, 'É', 'E');
  v_norm := replace(v_norm, 'Ê', 'E');
  v_norm := replace(v_norm, 'Í', 'I');
  v_norm := replace(v_norm, 'Ó', 'O');
  v_norm := replace(v_norm, 'Ô', 'O');

  -- kind (constraint: SUMULA, TEMA, PRECEDENTE)
  v_kind := case
    when v_norm like '%SUMULA%' then 'SUMULA'
    when v_norm like '%VINCULANTE%' then 'SUMULA'
    when v_norm like '%TEMA%' then 'TEMA'
    when v_norm like '%REPETITIVO%' then 'TEMA'
    when v_norm like '%REPERCUSSAO%' then 'TEMA'
    else 'PRECEDENTE'
  end;

  -- tipo (constraint: sumula, tema, precedente, repetitivo, irdr, iac)
  v_tipo := case
    when v_norm like '%SUMULA%' then 'sumula'
    when v_norm like '%VINCULANTE%' then 'sumula'
    when v_norm like '%IRDR%' then 'irdr'
    when v_norm like '%IAC%' then 'iac'
    when v_norm like '%REPETITIVO%' then 'repetitivo'
    when v_kind = 'TEMA' then 'tema'
    else 'precedente'
  end;

  v_ementa := coalesce(nullif(p->>'thesis',''), nullif(p->>'ementa',''), 'Sem ementa');

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
    v_kind,
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