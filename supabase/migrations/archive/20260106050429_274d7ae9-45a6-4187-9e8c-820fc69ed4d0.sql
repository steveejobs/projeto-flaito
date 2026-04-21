-- 1. Habilitar RLS na tabela client_events
ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

-- 2. Política de leitura baseada no office_id
CREATE POLICY "client_events_select" ON public.client_events
  FOR SELECT TO authenticated
  USING (office_id = public.current_office_id());

-- 3. Política de inserção
CREATE POLICY "client_events_insert" ON public.client_events
  FOR INSERT TO authenticated
  WITH CHECK (office_id = public.current_office_id());

-- 4. Política de update
CREATE POLICY "client_events_update" ON public.client_events
  FOR UPDATE TO authenticated
  USING (office_id = public.current_office_id());

-- 5. Política de delete
CREATE POLICY "client_events_delete" ON public.client_events
  FOR DELETE TO authenticated
  USING (office_id = public.current_office_id());

-- 6. Garantir permissões nas views
GRANT SELECT ON public.vw_lexos_timeline TO authenticated;
GRANT SELECT ON public.vw_lexos_timeline_plus TO authenticated;