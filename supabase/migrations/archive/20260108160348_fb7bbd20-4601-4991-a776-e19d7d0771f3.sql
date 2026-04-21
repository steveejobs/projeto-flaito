-- Permitir signed_at como nullable para suportar status PENDING
ALTER TABLE public.e_signatures 
ALTER COLUMN signed_at DROP NOT NULL;

-- Remover default now() para evitar que assinaturas pendentes tenham data automática
ALTER TABLE public.e_signatures 
ALTER COLUMN signed_at DROP DEFAULT;

COMMENT ON COLUMN public.e_signatures.signed_at IS 'Data/hora da assinatura - NULL quando status é PENDING';