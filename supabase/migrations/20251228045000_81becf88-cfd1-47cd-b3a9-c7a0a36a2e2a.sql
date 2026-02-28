-- ========================================
-- Correções de RLS para client_files e storage
-- ========================================

-- 1. Adicionar política UPDATE para storage.objects no bucket client-files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Office members can update client files' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Office members can update client files"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'client-files'
      AND (storage.foldername(name))[1] IN (
        SELECT office_id::text FROM office_members WHERE user_id = auth.uid() AND is_active = true
      )
    );
  END IF;
END $$;

-- 2. Verificar e corrigir RLS de client_files para usar current_office_id() (mais performático)
-- Primeiro, dropar as políticas antigas
DROP POLICY IF EXISTS "client_files_select" ON public.client_files;
DROP POLICY IF EXISTS "client_files_insert" ON public.client_files;
DROP POLICY IF EXISTS "client_files_update" ON public.client_files;
DROP POLICY IF EXISTS "client_files_delete" ON public.client_files;

-- Recriar políticas usando current_office_id() para melhor performance
CREATE POLICY "client_files_select" ON public.client_files
FOR SELECT USING (office_id = current_office_id());

CREATE POLICY "client_files_insert" ON public.client_files
FOR INSERT WITH CHECK (office_id = current_office_id());

CREATE POLICY "client_files_update" ON public.client_files
FOR UPDATE USING (office_id = current_office_id());

CREATE POLICY "client_files_delete" ON public.client_files
FOR DELETE USING (office_id = current_office_id());

-- 3. Adicionar política para service role (edge functions) poder inserir em client_files
-- Isso garante que a edge function com service_role_key possa inserir
CREATE POLICY "service_role_full_access" ON public.client_files
FOR ALL USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);