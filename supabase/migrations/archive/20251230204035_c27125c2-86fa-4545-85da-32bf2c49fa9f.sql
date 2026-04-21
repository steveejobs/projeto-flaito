-- FIX: Erro 401 no dicionário - forçar RLS e política de leitura
ALTER TABLE public.nija_eproc_event_dictionary ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "nija_eproc_dict_select_authenticated" ON public.nija_eproc_event_dictionary;
DROP POLICY IF EXISTS "nija_eproc_dict_select_public" ON public.nija_eproc_event_dictionary;

-- Criar política de leitura para usuários autenticados
CREATE POLICY "nija_eproc_dict_read_all"
ON public.nija_eproc_event_dictionary
FOR SELECT
TO authenticated
USING (true);

-- Garantir GRANT também
GRANT SELECT ON public.nija_eproc_event_dictionary TO authenticated;