-- Dropar policy existente se houver
DROP POLICY IF EXISTS "nija_logs_select_office" ON public.nija_logs;

-- Recriar policy de SELECT correta
CREATE POLICY "nija_logs_select_office" ON public.nija_logs
  FOR SELECT
  USING (
    office_id IN (
      SELECT om.office_id 
      FROM public.office_members om 
      WHERE om.user_id = auth.uid()
    )
  );

-- Garantir que RLS está habilitado
ALTER TABLE public.nija_logs ENABLE ROW LEVEL SECURITY;

-- Garantir GRANT de SELECT para authenticated
GRANT SELECT ON public.nija_logs TO authenticated;