-- Fix: trg_audit_generic should not require auth.uid() (Service Role deletes)
-- It now falls back to common user columns (created_by / uploaded_by / deleted_by) and skips logging if none.

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
  v_actor uuid;
  j_new jsonb;
  j_old jsonb;
begin
  v_table := tg_table_name;

  if (tg_op = 'INSERT') then
    v_action := 'INSERT';
    v_record_id := new.id;
    v_office := new.office_id;
    v_before := null;
    v_after := to_jsonb(new);
    j_new := v_after;
    j_old := null;
  elsif (tg_op = 'UPDATE') then
    v_action := 'UPDATE';
    v_record_id := new.id;
    v_office := new.office_id;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    j_new := v_after;
    j_old := v_before;
  elsif (tg_op = 'DELETE') then
    v_action := 'DELETE';
    v_record_id := old.id;
    v_office := old.office_id;
    v_before := to_jsonb(old);
    v_after := null;
    j_new := null;
    j_old := v_before;
  else
    return null;
  end if;

  -- Determine actor:
  -- 1) auth.uid() when called in user context
  -- 2) fall back to common columns present in many tables (created_by/uploaded_by/deleted_by)
  -- NOTE: If none is available, we skip audit log to avoid NOT NULL constraint violation.
  v_actor := coalesce(
    auth.uid(),
    nullif(j_new->>'uploaded_by', '')::uuid,
    nullif(j_new->>'created_by', '')::uuid,
    nullif(j_new->>'deleted_by', '')::uuid,
    nullif(j_old->>'uploaded_by', '')::uuid,
    nullif(j_old->>'created_by', '')::uuid,
    nullif(j_old->>'deleted_by', '')::uuid
  );

  if v_actor is not null then
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
      v_actor,
      v_action,
      v_table,
      v_record_id,
      v_table,
      v_record_id,
      v_before,
      v_after,
      '{}'::jsonb
    );
  end if;

  if (tg_op = 'DELETE') then
    return old;
  end if;

  return new;
end;
$$;