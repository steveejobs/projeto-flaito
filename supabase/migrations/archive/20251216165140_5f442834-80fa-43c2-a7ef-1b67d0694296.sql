-- Fix: validate uploaded_by user (not auth.uid()) when uploaded_by is already provided
-- This allows SECURITY DEFINER triggers to insert documents on behalf of users

CREATE OR REPLACE FUNCTION public.trg_documents_set_defaults_validate_and_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user_to_check uuid;
begin
  -- defaults mínimos
  if new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;

  if new.uploaded_at is null then
    new.uploaded_at := now();
  end if;

  -- Determine which user to validate:
  -- If auth.uid() is available, use it (normal user context)
  -- Otherwise, use the provided uploaded_by (Service Role / SECURITY DEFINER context)
  v_user_to_check := coalesce(auth.uid(), new.uploaded_by);

  -- valida office ativo - check the determined user, not just auth.uid()
  if v_user_to_check is null then
    raise exception 'Usuário não identificado para validação de office.';
  end if;

  if not exists (
    select 1 from public.office_members om
    where om.office_id = new.office_id
      and om.user_id = v_user_to_check
      and om.is_active = true
  ) then
    raise exception 'Usuário sem office ativo (office_members.is_active=true).';
  end if;

  -- se locked, bloqueia alterações sensíveis
  if tg_op = 'UPDATE' then
    if coalesce(old.is_locked,false) = true then
      if new.office_id <> old.office_id
         or new.case_id <> old.case_id
         or new.uploaded_by <> old.uploaded_by
         or new.storage_bucket <> old.storage_bucket
         or new.storage_path <> old.storage_path
         or new.mime_type <> old.mime_type then
        raise exception 'Documento bloqueado: alteração não permitida.';
      end if;
    end if;
  end if;

  return new;
end;
$$;