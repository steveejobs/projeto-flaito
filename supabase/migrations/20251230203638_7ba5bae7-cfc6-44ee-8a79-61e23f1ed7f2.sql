-- ============================================
-- FIX: Permissões completas para NIJA (sem nija_tjto_doc_codes)
-- ============================================

-- 1. GRANT direto nas tabelas
GRANT SELECT ON public.nija_eproc_event_dictionary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nija_extractions TO authenticated;

-- 2. nija_eproc_event_dictionary - política de leitura pública para autenticados
ALTER TABLE public.nija_eproc_event_dictionary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nija_eproc_dict_select_authenticated" ON public.nija_eproc_event_dictionary;
CREATE POLICY "nija_eproc_dict_select_authenticated"
ON public.nija_eproc_event_dictionary
FOR SELECT
TO authenticated
USING (true);

-- 3. Recriar políticas de nija_extractions com EXISTS otimizado
DROP POLICY IF EXISTS "nija_extractions_select_policy" ON public.nija_extractions;
DROP POLICY IF EXISTS "nija_extractions_insert_policy" ON public.nija_extractions;
DROP POLICY IF EXISTS "nija_extractions_update_policy" ON public.nija_extractions;
DROP POLICY IF EXISTS "nija_extractions_delete_policy" ON public.nija_extractions;

CREATE POLICY "nija_extractions_select_policy"
ON public.nija_extractions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid() 
    AND om.office_id = nija_extractions.office_id 
    AND om.is_active = true
  )
);

CREATE POLICY "nija_extractions_insert_policy"
ON public.nija_extractions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid() 
    AND om.office_id = nija_extractions.office_id 
    AND om.is_active = true
  )
);

CREATE POLICY "nija_extractions_update_policy"
ON public.nija_extractions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid() 
    AND om.office_id = nija_extractions.office_id 
    AND om.is_active = true
  )
);

CREATE POLICY "nija_extractions_delete_policy"
ON public.nija_extractions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid() 
    AND om.office_id = nija_extractions.office_id 
    AND om.is_active = true
  )
);