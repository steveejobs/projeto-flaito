-- Fix lexos_audit_trigger function to use correct column name and table
CREATE OR REPLACE FUNCTION public.lexos_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_office uuid;
  v_uid uuid;
  v_pk text;
begin
  v_uid := auth.uid();

  -- tenta extrair office_id se existir no registro
  if tg_op in ('INSERT','UPDATE') then
    if to_jsonb(new) ? 'office_id' then v_office := (new).office_id; end if;
  else
    if to_jsonb(old) ? 'office_id' then v_office := (old).office_id; end if;
  end if;

  -- tenta extrair um "id" padrão como pk (se existir)
  if tg_op in ('INSERT','UPDATE') then
    if to_jsonb(new) ? 'id' then v_pk := (new).id::text; end if;
  else
    if to_jsonb(old) ? 'id' then v_pk := (old).id::text; end if;
  end if;

  -- Insert into audit_logs table (not view) with correct column name actor_user_id
  INSERT INTO public.audit_logs (
    office_id,
    actor_user_id,
    table_name,
    entity,
    entity_id,
    action,
    record_id,
    before_data,
    after_data
  ) VALUES (
    v_office,
    v_uid,
    tg_table_name,
    tg_table_name,
    v_pk::uuid,
    tg_op,
    v_pk::uuid,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  return case when tg_op='DELETE' then old else new end;
end;
$$;