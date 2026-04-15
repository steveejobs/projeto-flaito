-- Migração: Expansão de Canais WhatsApp
-- Data: 2024-05-01

-- 1. Adicionar novas colunas
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS label TEXT, -- Nome amigável (ex: 'Comercial')
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'zapi', -- Provedor (default zapi)
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true, -- Ativação
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false, -- Instância principal
ADD COLUMN IF NOT EXISTS phone_number TEXT; -- Número conectado formatado

-- 2. Garantir que apenas UMA instância seja primária por escritório
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_primary_unique 
ON public.whatsapp_instances (office_id) 
WHERE (is_primary = true);

-- 3. Índices de busca
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_office_id ON public.whatsapp_instances(office_id);

-- 4. Comentários
COMMENT ON COLUMN public.whatsapp_instances.label IS 'Rótulo amigável para identificação interna do canal.';
COMMENT ON COLUMN public.whatsapp_instances.is_primary IS 'Define se esta é a conexão padrão para envios automáticos do escritório.';

-- 5. Forçar Recarga do Schema no PostgREST (Fix PGRST205)
NOTIFY pgrst, 'reload schema';
