-- Fix Storage RLS policies for client-files bucket to support both path patterns
-- Legacy pattern: {office_id}/{client_id}/...
-- New pattern: offices/{office_id}/clients/{client_id}/...

-- Drop existing policies
DROP POLICY IF EXISTS "Office members can view client files" ON storage.objects;
DROP POLICY IF EXISTS "Office members can update client files" ON storage.objects;
DROP POLICY IF EXISTS "Office members can delete client files" ON storage.objects;

-- Create new SELECT policy that handles both path patterns
CREATE POLICY "Office members can view client files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-files' 
  AND (
    -- Legacy pattern: first folder is office_id
    (storage.foldername(name))[1] IN (
      SELECT office_id::text FROM public.office_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR
    -- New pattern: offices/{office_id}/clients/...
    (
      (storage.foldername(name))[1] = 'offices' 
      AND (storage.foldername(name))[2] IN (
        SELECT office_id::text FROM public.office_members 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  )
);

-- Create new UPDATE policy that handles both path patterns
CREATE POLICY "Office members can update client files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-files' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT office_id::text FROM public.office_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR
    (
      (storage.foldername(name))[1] = 'offices' 
      AND (storage.foldername(name))[2] IN (
        SELECT office_id::text FROM public.office_members 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  )
);

-- Create new DELETE policy that handles both path patterns
CREATE POLICY "Office members can delete client files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-files' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT office_id::text FROM public.office_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR
    (
      (storage.foldername(name))[1] = 'offices' 
      AND (storage.foldername(name))[2] IN (
        SELECT office_id::text FROM public.office_members 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  )
);