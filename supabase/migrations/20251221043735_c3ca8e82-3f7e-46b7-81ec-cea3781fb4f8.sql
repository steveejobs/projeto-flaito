-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the documents bucket
-- Allow authenticated users to upload files to their office's folder
CREATE POLICY "Users can upload files to their office folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (storage.foldername(name))[2] = om.office_id::text
  )
);

-- Allow authenticated users to view files from their office
CREATE POLICY "Users can view files from their office"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (storage.foldername(name))[2] = om.office_id::text
  )
);

-- Allow authenticated users to delete files from their office
CREATE POLICY "Users can delete files from their office"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.user_id = auth.uid()
    AND om.is_active = true
    AND (storage.foldername(name))[2] = om.office_id::text
  )
);