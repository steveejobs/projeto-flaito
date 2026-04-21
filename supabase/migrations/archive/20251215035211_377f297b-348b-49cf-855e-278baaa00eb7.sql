-- Fix current_office_id() to use SECURITY DEFINER so it can bypass RLS when called from triggers
CREATE OR REPLACE FUNCTION public.current_office_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $$
  SELECT office_id
  FROM public.office_members
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;