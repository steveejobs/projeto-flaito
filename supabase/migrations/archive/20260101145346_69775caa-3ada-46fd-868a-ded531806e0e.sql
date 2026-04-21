-- Grant execute permissions for client management functions
GRANT EXECUTE ON FUNCTION public.archive_client(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_client(uuid) TO authenticated;

-- Update archive_client to use case-insensitive role comparison
CREATE OR REPLACE FUNCTION public.archive_client(p_client_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
BEGIN
  -- Get the office_id for the client
  SELECT office_id INTO v_office_id
  FROM public.clients
  WHERE id = p_client_id;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  -- Check if user is owner or admin (case-insensitive)
  IF NOT EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = v_office_id
      AND om.user_id = auth.uid()
      AND lower(om.role::text) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Archive the client
  UPDATE public.clients
  SET 
    status = 'archived',
    updated_at = now()
  WHERE id = p_client_id;

  -- Log the action
  INSERT INTO public.audit_logs (
    actor_user_id,
    office_id,
    entity,
    entity_id,
    action,
    details
  ) VALUES (
    auth.uid(),
    v_office_id,
    'client',
    p_client_id,
    'archive',
    jsonb_build_object('reason', p_reason)
  );
END;
$$;