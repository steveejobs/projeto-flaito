-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-documents', 'case-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Office members can upload case documents" ON storage.objects;
DROP POLICY IF EXISTS "Office members can view case documents" ON storage.objects;
DROP POLICY IF EXISTS "Office members can update case documents" ON storage.objects;
DROP POLICY IF EXISTS "Office members can delete case documents" ON storage.objects;

-- Policy to allow office members to upload files
-- Path format: {office_id}/{document_id}/{filename}
CREATE POLICY "Office members can upload case documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'case-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT om.office_id::text
    FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
  )
);

-- Policy to allow office members to view files
CREATE POLICY "Office members can view case documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'case-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT om.office_id::text
    FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
  )
);

-- Policy to allow office members to update files
CREATE POLICY "Office members can update case documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'case-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT om.office_id::text
    FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
  )
);

-- Policy to allow office members to delete files
CREATE POLICY "Office members can delete case documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'case-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT om.office_id::text
    FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
  )
);