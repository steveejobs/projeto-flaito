-- FIX: Adicionar política SELECT para anon no dicionário (erro 401)
DROP POLICY IF EXISTS "nija_eproc_dict_read_all" ON public.nija_eproc_event_dictionary;
DROP POLICY IF EXISTS "nija_eproc_dict_read_anon" ON public.nija_eproc_event_dictionary;

-- Política para authenticated
CREATE POLICY "nija_eproc_dict_read_authenticated"
ON public.nija_eproc_event_dictionary
FOR SELECT
TO authenticated
USING (true);

-- Política para anon (resolve 401)
CREATE POLICY "nija_eproc_dict_read_anon"
ON public.nija_eproc_event_dictionary
FOR SELECT
TO anon
USING (true);

-- Garantir GRANTs
GRANT SELECT ON public.nija_eproc_event_dictionary TO authenticated;
GRANT SELECT ON public.nija_eproc_event_dictionary TO anon;