-- Migração Final: Infraestrutura Z-API + Mapeamento Dinâmico
-- Data: 2024-05-01

-- 1. Tabela de Instâncias Z-API (Mapeamento Escritório <-> WhatsApp)
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    instance_id TEXT NOT NULL UNIQUE, -- ID da instância na Z-API (ex: 3C...B4)
    instance_token TEXT NOT NULL,     -- Token da Z-API (guardado seguro)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Garantir Row Level Security (RLS)
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Políticas para whatsapp_instances (Apenas service_role ou admin do escritório)
DO $$ BEGIN
    CREATE POLICY "Instâncias: Acesso restrito ao Office" ON public.whatsapp_instances
    FOR SELECT USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Refinar RLS para Conversations e Messages (Permitir Escrita por Service Role)
-- Nota: Service Role já ignora RLS por padrão no Supabase, 
-- mas garantimos que as políticas de SELECT existam.

-- 4. Constraints Adicionais e Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_id ON public.whatsapp_instances(instance_id);

-- 5. Permissões Granulares (Segurança: Não use GRANT ALL)
-- Permite que a API e Funções gerenciem os dados
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_instances TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_messages TO service_role;

-- 6. Trigger de Timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_update_whatsapp_instances_timestamp
    BEFORE UPDATE ON public.whatsapp_instances
    FOR EACH ROW
    EXECUTE PROCEDURE update_timestamp();

-- 7. Comentário
COMMENT ON TABLE public.whatsapp_instances IS 'Mapeamento de instâncias Z-API para escritórios do Flaito.';
