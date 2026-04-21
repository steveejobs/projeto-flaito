-- Tabela para auditoria e idempotência de webhooks ZapSign
CREATE TABLE public.zapsign_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id),
  zapsign_event_id text UNIQUE,
  event_type text NOT NULL,
  doc_token text,
  payload jsonb NOT NULL DEFAULT '{}',
  received_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  last_error text
);

-- Índices para performance
CREATE INDEX idx_zapsign_events_doc_token ON public.zapsign_webhook_events(doc_token);
CREATE INDEX idx_zapsign_events_received ON public.zapsign_webhook_events(received_at DESC);

-- RLS - bloqueio total para usuários normais (apenas service role acessa)
ALTER TABLE public.zapsign_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.zapsign_webhook_events
  FOR ALL USING (false);

-- Adicionar coluna zapsign_doc_token em document_sign_requests
ALTER TABLE public.document_sign_requests 
ADD COLUMN IF NOT EXISTS zapsign_doc_token text;

-- Índice para busca rápida por token ZapSign
CREATE INDEX idx_sign_requests_zapsign_token 
ON public.document_sign_requests(zapsign_doc_token) 
WHERE zapsign_doc_token IS NOT NULL;