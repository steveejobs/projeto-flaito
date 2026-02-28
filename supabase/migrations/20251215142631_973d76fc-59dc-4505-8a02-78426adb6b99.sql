ALTER TABLE public.clients
ADD COLUMN nationality text,
ADD COLUMN marital_status text,
ADD COLUMN profession text,
ADD COLUMN rg text,
ADD COLUMN rg_issuer text;

COMMENT ON COLUMN public.clients.nationality IS 'Nacionalidade do cliente (ex: brasileiro)';
COMMENT ON COLUMN public.clients.marital_status IS 'Estado civil (solteiro, casado, divorciado, viúvo, união estável)';
COMMENT ON COLUMN public.clients.profession IS 'Profissão do cliente';
COMMENT ON COLUMN public.clients.rg IS 'Número do RG';
COMMENT ON COLUMN public.clients.rg_issuer IS 'Órgão emissor do RG (ex: SSP/SP)';