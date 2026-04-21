-- Adicionar coluna avatar_url na tabela office_members
ALTER TABLE office_members 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN office_members.avatar_url IS 'URL da foto de perfil do membro';

-- Criar bucket member-avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-avatars',
  'member-avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para o bucket
CREATE POLICY "member_avatars_select" ON storage.objects
FOR SELECT USING (bucket_id = 'member-avatars');

CREATE POLICY "member_avatars_insert" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'member-avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "member_avatars_update" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'member-avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "member_avatars_delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'member-avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);