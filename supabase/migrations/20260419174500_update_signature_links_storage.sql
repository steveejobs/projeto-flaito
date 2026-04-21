-- Adiciona coluna para armazenar a assinatura temporária no link remoto
ALTER TABLE public.signature_links ADD COLUMN IF NOT EXISTS signature_base64 TEXT;
ALTER TABLE public.signature_links ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- Atualiza políticas para permitir leitura/escrita da assinatura
DROP POLICY IF EXISTS "sig_links_update" ON public.signature_links;
CREATE POLICY "sig_links_update" ON public.signature_links 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);
