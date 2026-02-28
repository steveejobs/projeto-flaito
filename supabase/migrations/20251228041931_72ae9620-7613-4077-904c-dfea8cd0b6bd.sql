-- Fix: allow authenticated users to read their own office membership
-- and allow calling onboarding status RPC without permission errors during initial app load.

-- 1) RLS policy for office_members (read own rows)
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'office_members'
      AND policyname = 'Users can view their own office membership'
  ) THEN
    CREATE POLICY "Users can view their own office membership"
    ON public.office_members
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Ensure RPC functions are callable (PostgREST needs EXECUTE privilege)
GRANT EXECUTE ON FUNCTION public.get_office_onboarding_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_office_for_user() TO anon, authenticated;
