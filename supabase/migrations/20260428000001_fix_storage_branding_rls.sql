-- Migration: 20260428000001 - Fix Storage Branding Public Access & RLS
-- Objetivo: Tornar o bucket office-branding público para leitura e simplificar RLS de upload para proprietários.

BEGIN;

-- 1. Tornar o bucket público para permitir que as imagens apareçam em documentos
UPDATE storage.buckets 
SET public = true 
WHERE id = 'office-branding';

-- 2. Limpar políticas antigas conflitantes
DROP POLICY IF EXISTS "Office admins can upload branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can update branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can delete branding files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- 3. Permitir Acesso Público de Leitura (Crucial para documentos)
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'office-branding');

-- 4. Permitir que membros do escritório façam upload
-- Simplificamos a regra: se o usuário pertence ao escritório cujo ID é a primeira pasta do caminho, ele pode subir.
-- Isso remove a dependência estrita de 'admin'/'owner' se o usuário estiver configurando seu próprio perfil.
CREATE POLICY "Office members can upload branding"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND om.office_id::text = (storage.foldername(name))[1]
  )
);

-- 5. Permitir Update e Delete para quem subiu ou para Admins do escritório
CREATE POLICY "Office members can manage branding"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND om.office_id::text = (storage.foldername(name))[1]
    AND (LOWER(om.role) IN ('admin', 'owner') OR owner = auth.uid())
  )
);

COMMIT;
