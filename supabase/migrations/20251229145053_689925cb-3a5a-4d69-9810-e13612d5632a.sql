-- Remover políticas existentes do bucket office-branding
DROP POLICY IF EXISTS "Office admins can upload branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can update branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can delete branding files" ON storage.objects;

-- Recriar política de INSERT com LOWER() para case-insensitive
CREATE POLICY "Office admins can upload branding files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND LOWER(om.role) IN ('admin', 'owner')
    AND om.office_id::text = (storage.foldername(name))[1]
  )
);

-- Recriar política de UPDATE com LOWER() para case-insensitive
CREATE POLICY "Office admins can update branding files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND LOWER(om.role) IN ('admin', 'owner')
    AND om.office_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND LOWER(om.role) IN ('admin', 'owner')
    AND om.office_id::text = (storage.foldername(name))[1]
  )
);

-- Recriar política de DELETE com LOWER() para case-insensitive
CREATE POLICY "Office admins can delete branding files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND LOWER(om.role) IN ('admin', 'owner')
    AND om.office_id::text = (storage.foldername(name))[1]
  )
);