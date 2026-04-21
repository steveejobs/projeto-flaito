-- Remover políticas antigas do bucket office-branding
DROP POLICY IF EXISTS "Office admins can view branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can upload branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can update branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can delete branding files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated admins can update office branding (scoped)" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated admins can upload office branding (scoped)" ON storage.objects;

-- Criar nova política de INSERT usando office_id
CREATE POLICY "Office admins can upload branding files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (om.role = 'admin' OR om.role = 'owner')
    AND om.office_id::text = (storage.foldername(name))[1]
  )
);

-- Criar nova política de UPDATE usando office_id
CREATE POLICY "Office admins can update branding files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (om.role = 'admin' OR om.role = 'owner')
    AND om.office_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (om.role = 'admin' OR om.role = 'owner')
    AND om.office_id::text = (storage.foldername(name))[1]
  )
);

-- Criar nova política de DELETE usando office_id
CREATE POLICY "Office admins can delete branding files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'office-branding' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (om.role = 'admin' OR om.role = 'owner')
    AND om.office_id::text = (storage.foldername(name))[1]
  )
);