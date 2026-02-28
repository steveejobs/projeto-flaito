-- Fix timeline permissions and RLS for client events

-- 1. Ensure clients table has proper SELECT policy for office members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clients' 
    AND policyname = 'clients_select_office_member'
  ) THEN
    CREATE POLICY "clients_select_office_member" 
    ON public.clients
    FOR SELECT TO authenticated
    USING (office_id = current_office_id());
  END IF;
END $$;

-- 2. Ensure client_events has proper SELECT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'client_events' 
    AND policyname = 'client_events_select_office'
  ) THEN
    CREATE POLICY "client_events_select_office" 
    ON public.client_events
    FOR SELECT TO authenticated
    USING (office_id = current_office_id());
  END IF;
END $$;

-- 3. Grant SELECT on timeline views to authenticated role
GRANT SELECT ON public.vw_lexos_timeline TO authenticated;
GRANT SELECT ON public.vw_lexos_timeline_plus TO authenticated;

-- 4. Grant SELECT on client_events to authenticated (if not already)
GRANT SELECT ON public.client_events TO authenticated;