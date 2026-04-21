-- Adicionar colunas que a captação já tenta usar mas não existem
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS representative_rg_issuer text;

COMMENT ON COLUMN public.clients.trade_name IS 'Nome fantasia para clientes PJ';
COMMENT ON COLUMN public.clients.representative_rg_issuer IS 'Órgão emissor do RG do representante legal (PJ)';