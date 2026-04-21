-- Fix: Allow text/html uploads to client-files bucket for generated document kits
UPDATE storage.buckets 
SET allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/html']
WHERE name = 'client-files';