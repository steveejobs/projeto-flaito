-- Create policies for office-branding bucket
-- Allow office admins/owners to read files from their office folder
CREATE POLICY "Office admins can view branding files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'office-branding'
  AND EXISTS (
    SELECT 1 FROM office_members om
    JOIN offices o ON o.id = om.office_id
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (om.role = 'admin' OR om.role = 'owner')
    AND o.slug = (storage.foldername(name))[1]
  )
);

-- Allow office admins/owners to upload files to their office folder
CREATE POLICY "Office admins can upload branding files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'office-branding'
  AND EXISTS (
    SELECT 1 FROM office_members om
    JOIN offices o ON o.id = om.office_id
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (om.role = 'admin' OR om.role = 'owner')
    AND o.slug = (storage.foldername(name))[1]
  )
);

-- Allow office admins/owners to update files in their office folder
CREATE POLICY "Office admins can update branding files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'office-branding'
  AND EXISTS (
    SELECT 1 FROM office_members om
    JOIN offices o ON o.id = om.office_id
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (om.role = 'admin' OR om.role = 'owner')
    AND o.slug = (storage.foldername(name))[1]
  )
);

-- Allow office admins/owners to delete files from their office folder
CREATE POLICY "Office admins can delete branding files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'office-branding'
  AND EXISTS (
    SELECT 1 FROM office_members om
    JOIN offices o ON o.id = om.office_id
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (om.role = 'admin' OR om.role = 'owner')
    AND o.slug = (storage.foldername(name))[1]
  )
);