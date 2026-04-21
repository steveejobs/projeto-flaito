-- Fix: audit_logs trigger should use the record's user field when auth.uid() is NULL
-- This allows SECURITY DEFINER triggers in Service Role context to work properly

-- First, let's update the trigger function that logs to audit_logs for documents table
CREATE OR REPLACE FUNCTION public.trg_audit_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid;
  v_action text;
BEGIN
  -- Determine the actor: prefer auth.uid(), fallback to record's uploaded_by
  IF TG_OP = 'DELETE' THEN
    v_actor_user_id := coalesce(auth.uid(), OLD.uploaded_by);
    v_action := 'DELETE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_actor_user_id := coalesce(auth.uid(), NEW.uploaded_by);
    v_action := 'UPDATE';
  ELSE
    v_actor_user_id := coalesce(auth.uid(), NEW.uploaded_by);
    v_action := 'INSERT';
  END IF;

  -- Only log if we have a valid actor
  IF v_actor_user_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      actor_user_id,
      office_id,
      entity,
      entity_id,
      action,
      table_name,
      record_id,
      before_data,
      after_data
    ) VALUES (
      v_actor_user_id,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.office_id ELSE NEW.office_id END,
      'documents',
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      v_action,
      'documents',
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Drop the existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trg_audit_documents ON public.documents;

CREATE TRIGGER trg_audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_documents();