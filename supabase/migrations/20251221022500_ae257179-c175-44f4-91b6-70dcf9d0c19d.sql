-- Adicionar política para permitir SELECT de documentos vinculados a clientes (sem case_id)
CREATE POLICY "generated_docs_select_by_client"
ON public.generated_docs
FOR SELECT
USING (
  client_id IS NOT NULL 
  AND case_id IS NULL 
  AND is_office_member(office_id)
);

-- Adicionar política para permitir INSERT de documentos vinculados a clientes
CREATE POLICY "generated_docs_insert_client_docs"
ON public.generated_docs
FOR INSERT
WITH CHECK (
  client_id IS NOT NULL 
  AND case_id IS NULL 
  AND is_office_member(office_id)
);

-- Adicionar política para permitir UPDATE de documentos de clientes
CREATE POLICY "generated_docs_update_client_docs"
ON public.generated_docs
FOR UPDATE
USING (
  client_id IS NOT NULL 
  AND case_id IS NULL 
  AND is_office_member(office_id)
);

-- Adicionar política para permitir DELETE de documentos de clientes
CREATE POLICY "generated_docs_delete_client_docs"
ON public.generated_docs
FOR DELETE
USING (
  client_id IS NOT NULL 
  AND case_id IS NULL 
  AND is_office_member(office_id)
);