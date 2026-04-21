-- Create client-files bucket for storing client documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-files', 'client-files', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);

-- Create storage policies for client-files bucket
-- Allow authenticated users to upload to their office's folder
CREATE POLICY "Office members can upload client files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT office_id::text FROM office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow authenticated users to view files from their office
CREATE POLICY "Office members can view client files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT office_id::text FROM office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow authenticated users to delete files from their office
CREATE POLICY "Office members can delete client files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT office_id::text FROM office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);