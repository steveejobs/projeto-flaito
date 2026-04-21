-- 1. Adicionar colunas para integração ZapSign
ALTER TABLE public.e_signatures 
ADD COLUMN IF NOT EXISTS zapsign_doc_token text;

ALTER TABLE public.e_signatures 
ADD COLUMN IF NOT EXISTS zapsign_signer_token text;

ALTER TABLE public.e_signatures 
ADD COLUMN IF NOT EXISTS signature_status text DEFAULT 'COLLECTED';

-- 2. Índice parcial para busca eficiente pelo token ZapSign
CREATE INDEX IF NOT EXISTS idx_e_signatures_zapsign_doc_token 
ON public.e_signatures(zapsign_doc_token) 
WHERE zapsign_doc_token IS NOT NULL;

-- 3. Atualizar view para incluir novas colunas
CREATE OR REPLACE VIEW public.vw_client_signatures AS
SELECT 
  s.id,
  s.client_id,
  c.full_name AS client_name,
  s.office_id,
  s.case_id,
  s.generated_document_id,
  s.signer_type,
  s.signer_name,
  s.signer_doc,
  s.signer_email,
  s.signer_phone,
  s.signature_base64,
  s.signed_hash,
  s.signed_at,
  s.ip,
  s.user_agent,
  s.metadata,
  s.zapsign_doc_token,
  s.zapsign_signer_token,
  s.signature_status
FROM e_signatures s
LEFT JOIN clients c ON c.id = s.client_id;

-- 4. Comentários para documentação
COMMENT ON COLUMN public.e_signatures.zapsign_doc_token IS 'Token do documento criado na ZapSign';
COMMENT ON COLUMN public.e_signatures.zapsign_signer_token IS 'Token do signatário na ZapSign';
COMMENT ON COLUMN public.e_signatures.signature_status IS 'Status: COLLECTED (manual), PENDING (aguardando ZapSign), SIGNED (assinado via ZapSign)';