-- Fix office-branding storage policies: qualify objects.name to avoid collision with offices.name
DROP POLICY IF EXISTS "Office admins can view branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can upload branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can update branding files" ON storage.objects;
DROP POLICY IF EXISTS "Office admins can delete branding files" ON storage.objects;

CREATE POLICY "Office admins can view branding files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'office-branding'
  AND EXISTS (
    SELECT 1
    FROM public.office_members om
    JOIN public.offices o ON o.id = om.office_id
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
      AND (om.role = 'admin' OR om.role = 'owner')
      AND o.slug = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Office admins can upload branding files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'office-branding'
  AND EXISTS (
    SELECT 1
    FROM public.office_members om
    JOIN public.offices o ON o.id = om.office_id
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
      AND (om.role = 'admin' OR om.role = 'owner')
      AND o.slug = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Office admins can update branding files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'office-branding'
  AND EXISTS (
    SELECT 1
    FROM public.office_members om
    JOIN public.offices o ON o.id = om.office_id
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
      AND (om.role = 'admin' OR om.role = 'owner')
      AND o.slug = (storage.foldername(storage.objects.name))[1]
  )
)
WITH CHECK (
  bucket_id = 'office-branding'
  AND EXISTS (
    SELECT 1
    FROM public.office_members om
    JOIN public.offices o ON o.id = om.office_id
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
      AND (om.role = 'admin' OR om.role = 'owner')
      AND o.slug = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Office admins can delete branding files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'office-branding'
  AND EXISTS (
    SELECT 1
    FROM public.office_members om
    JOIN public.offices o ON o.id = om.office_id
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
      AND (om.role = 'admin' OR om.role = 'owner')
      AND o.slug = (storage.foldername(storage.objects.name))[1]
  )
);
