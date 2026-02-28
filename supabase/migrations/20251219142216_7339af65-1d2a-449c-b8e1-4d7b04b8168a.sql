-- Criar tabela para documentos de análise solta (sem caso)
CREATE TABLE public.nija_loose_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  storage_bucket TEXT NOT NULL DEFAULT 'nija_tmp',
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca por sessão
CREATE INDEX idx_nija_loose_docs_session ON public.nija_loose_docs(session_id);

-- Enable RLS
ALTER TABLE public.nija_loose_docs ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados gerenciarem seus próprios documentos
CREATE POLICY "Users can view their own loose docs"
ON public.nija_loose_docs
FOR SELECT
USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can insert their own loose docs"
ON public.nija_loose_docs
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their own loose docs"
ON public.nija_loose_docs
FOR UPDATE
USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own loose docs"
ON public.nija_loose_docs
FOR DELETE
USING (auth.uid() = uploaded_by);

-- Criar bucket para arquivos temporários do NIJA
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('nija_tmp', 'nija_tmp', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para o bucket nija_tmp
CREATE POLICY "Users can upload to nija_tmp"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'nija_tmp' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their nija_tmp files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'nija_tmp' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their nija_tmp files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'nija_tmp' AND auth.uid() IS NOT NULL);