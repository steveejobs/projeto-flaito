-- Cria tabela signature_links se não existir
-- Usada para links públicos de assinatura remota enviados ao cliente

CREATE TABLE IF NOT EXISTS public.signature_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS signature_links_token_idx ON public.signature_links(token);
CREATE INDEX IF NOT EXISTS signature_links_office_idx ON public.signature_links(office_id);

-- RLS
ALTER TABLE public.signature_links ENABLE ROW LEVEL SECURITY;

-- Política: qualquer um pode ler pelo token (endpoint público de assinatura)
DROP POLICY IF EXISTS "signature_links_public_read" ON public.signature_links;
CREATE POLICY "signature_links_public_read"
  ON public.signature_links
  FOR SELECT
  USING (true);

-- Política: anon pode inserir (gerado no frontend via REST)
DROP POLICY IF EXISTS "signature_links_anon_insert" ON public.signature_links;
CREATE POLICY "signature_links_anon_insert"
  ON public.signature_links
  FOR INSERT
  WITH CHECK (true);

-- Política: anon pode atualizar status/used_at (quando o cliente assina)
DROP POLICY IF EXISTS "signature_links_anon_update" ON public.signature_links;
CREATE POLICY "signature_links_anon_update"
  ON public.signature_links
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
