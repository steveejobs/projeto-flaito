-- Create a secure RPC function to get invite details by token
-- This avoids RLS/permission issues with direct table SELECT
CREATE OR REPLACE FUNCTION public.get_office_invite_public(p_token text)
RETURNS TABLE (
  invite_id uuid,
  email text,
  role text,
  office_id uuid,
  office_name text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.id AS invite_id,
    oi.email,
    oi.role,
    oi.office_id,
    o.name AS office_name,
    oi.expires_at
  FROM office_invites oi
  LEFT JOIN offices o ON o.id = oi.office_id
  WHERE oi.token = p_token
    AND oi.accepted_at IS NULL
    AND oi.expires_at > now();
END;
$$;

-- Grant execute to anon (for signup page) and authenticated
GRANT EXECUTE ON FUNCTION public.get_office_invite_public(text) TO anon, authenticated;

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';