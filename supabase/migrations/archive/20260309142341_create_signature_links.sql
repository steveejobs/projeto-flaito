-- Migration: tabela de links de assinatura remota
-- Gerado em: 2026-03-09

CREATE TABLE IF NOT EXISTS public.signature_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  office_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired'))
);

-- Índice para busca por token (rota pública)
CREATE INDEX IF NOT EXISTS idx_signature_links_token ON public.signature_links (token);
-- Índice para busca por cliente
CREATE INDEX IF NOT EXISTS idx_signature_links_client ON public.signature_links (client_id);

-- RLS
ALTER TABLE public.signature_links ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode LER um link pelo token (página pública de assinatura)
CREATE POLICY "public_read_signature_link_by_token"
  ON public.signature_links FOR SELECT
  USING (true);

-- Apenas usuários autenticados do escritório podem criar/atualizar/deletar links
CREATE POLICY "office_manage_signature_links"
  ON public.signature_links FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND office_id IN (
      SELECT office_id FROM public.office_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    office_id IN (
      SELECT office_id FROM public.office_members WHERE user_id = auth.uid()
    )
  );

-- Permitir UPDATE por anon para marcar como usado (página de assinatura pública)
CREATE POLICY "public_update_signature_link_status"
  ON public.signature_links FOR UPDATE
  USING (true)
  WITH CHECK (
    status IN ('pending', 'completed', 'expired')
    AND (used_at IS NOT NULL OR status = 'completed')
  );
