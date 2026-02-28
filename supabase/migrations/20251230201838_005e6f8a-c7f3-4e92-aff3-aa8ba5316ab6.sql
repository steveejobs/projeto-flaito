-- Conceder permissão de execução na função lexos_nija_update_case_metadata para usuários autenticados
GRANT EXECUTE ON FUNCTION public.lexos_nija_update_case_metadata(uuid, jsonb) TO authenticated;

-- Conceder permissões de leitura/escrita na tabela nija_extractions para usuários autenticados
-- Garantir que RLS está habilitado
ALTER TABLE IF EXISTS public.nija_extractions ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes antes de recriar (evita erros de duplicação)
DROP POLICY IF EXISTS "nija_extractions_select_policy" ON public.nija_extractions;
DROP POLICY IF EXISTS "nija_extractions_insert_policy" ON public.nija_extractions;
DROP POLICY IF EXISTS "nija_extractions_update_policy" ON public.nija_extractions;
DROP POLICY IF EXISTS "nija_extractions_delete_policy" ON public.nija_extractions;

-- Criar políticas de acesso para nija_extractions baseadas em office_id
CREATE POLICY "nija_extractions_select_policy"
ON public.nija_extractions
FOR SELECT
TO authenticated
USING (
  office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "nija_extractions_insert_policy"
ON public.nija_extractions
FOR INSERT
TO authenticated
WITH CHECK (
  office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "nija_extractions_update_policy"
ON public.nija_extractions
FOR UPDATE
TO authenticated
USING (
  office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "nija_extractions_delete_policy"
ON public.nija_extractions
FOR DELETE
TO authenticated
USING (
  office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);