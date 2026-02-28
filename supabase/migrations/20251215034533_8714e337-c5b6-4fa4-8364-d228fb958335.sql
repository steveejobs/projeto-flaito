-- Remove the conflicting RLS policy that blocks new case creation
DROP POLICY IF EXISTS cases_insert_owner_only ON public.cases;

-- Create a trigger function to auto-grant owner permission after case insert
CREATE OR REPLACE FUNCTION public.auto_grant_case_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.case_permissions (case_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (case_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS after_case_insert_grant_owner ON public.cases;

-- Create the trigger
CREATE TRIGGER after_case_insert_grant_owner
AFTER INSERT ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.auto_grant_case_owner();