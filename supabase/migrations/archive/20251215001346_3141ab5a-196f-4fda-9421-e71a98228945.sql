-- Fix trg_audit_generic to include required 'entity' column
CREATE OR REPLACE FUNCTION public.trg_audit_generic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_action text;
  v_table text;
  v_record_id uuid;
  v_office uuid;
  v_before jsonb;
  v_after jsonb;
begin
  v_table := tg_table_name;

  if (tg_op = 'INSERT') then
    v_action := 'INSERT';
    v_record_id := new.id;
    v_office := new.office_id;
    v_before := null;
    v_after := to_jsonb(new);
  elsif (tg_op = 'UPDATE') then
    v_action := 'UPDATE';
    v_record_id := new.id;
    v_office := new.office_id;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  elsif (tg_op = 'DELETE') then
    v_action := 'DELETE';
    v_record_id := old.id;
    v_office := old.office_id;
    v_before := to_jsonb(old);
    v_after := null;
  else
    return null;
  end if;

  insert into public.audit_logs (
    office_id,
    actor_user_id,
    action,
    entity,
    entity_id,
    table_name,
    record_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_office,
    auth.uid(),
    v_action,
    v_table,
    v_record_id,
    v_table,
    v_record_id,
    v_before,
    v_after,
    '{}'::jsonb
  );

  if (tg_op = 'DELETE') then
    return old;
  end if;

  return new;
end;
$$;