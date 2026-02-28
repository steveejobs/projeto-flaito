-- Make office-branding bucket public so logos and signatures can be displayed without signed URLs
UPDATE storage.buckets 
SET public = true 
WHERE id = 'office-branding';

-- Create RLS policy to allow authenticated users to upload to their office folder
CREATE POLICY "Authenticated users can upload office branding" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'office-branding');

-- Create RLS policy to allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update office branding" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'office-branding');

-- Create RLS policy to allow anyone to view public office branding
CREATE POLICY "Anyone can view office branding" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'office-branding');