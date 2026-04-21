-- Fix: Make get_office_onboarding_status SECURITY DEFINER to bypass RLS
-- This is safe because the function already uses get_active_office_for_user() which validates auth.uid()

CREATE OR REPLACE FUNCTION public.get_office_onboarding_status()
RETURNS TABLE(step_key text, completed boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT step_key, completed
    FROM public.office_onboarding_steps
    WHERE office_id = public.get_active_office_for_user()
    ORDER BY step_key;
$$;