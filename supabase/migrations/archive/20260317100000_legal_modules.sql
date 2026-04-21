-- Migration: Legal Modules Expansion
-- Tables for Banco Jurídico, Contatos Judiciários, and Delegacias

-- 1. Banco Jurídico (Petições, Teses, Doutrinas, Súmulas)
CREATE TABLE IF NOT EXISTS public.banco_juridico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('PETICAO', 'TESE', 'DOUTRINA', 'SUMULA')),
    titulo TEXT NOT NULL,
    descricao TEXT,
    area_direito TEXT, -- Ex: Civil, Penal, Trabalhista
    texto_completo TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    autor TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Contatos do Judiciário
CREATE TABLE IF NOT EXISTS public.contatos_judiciario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_vara TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('CIVIL', 'PENAL', 'FAMILIA', 'CRIMINAL', 'TABELIONATO', 'OUTRO')),
    tribunal TEXT,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Delegacias
CREATE TABLE IF NOT EXISTS public.delegacias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('CIVIL', 'PENAL', 'MULHER', 'MILITAR', 'FEDERAL', 'OUTRO')),
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    coordenadas_json JSONB, -- Para futura geolocalização simples
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Audit Table (Global pattern)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICIES

-- Banco Jurídico: Office-bound
ALTER TABLE public.banco_juridico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view banco_juridico from their office"
    ON public.banco_juridico FOR SELECT
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can insert banco_juridico to their office"
    ON public.banco_juridico FOR INSERT
    WITH CHECK (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can update banco_juridico in their office"
    ON public.banco_juridico FOR UPDATE
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

-- Contatos Judiciário: Public Read (Global shared data), Admin Edit
ALTER TABLE public.contatos_judiciario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view judiciary contacts"
    ON public.contatos_judiciario FOR SELECT
    TO authenticated
    USING (true);

-- Delegacias: Public Read (Global shared data)
ALTER TABLE public.delegacias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view delegacias"
    ON public.delegacias FOR SELECT
    TO authenticated
    USING (true);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_banco_juridico_office_id ON public.banco_juridico(office_id);
CREATE INDEX IF NOT EXISTS idx_banco_juridico_tipo ON public.banco_juridico(tipo);
CREATE INDEX IF NOT EXISTS idx_delegacias_cidade_estado ON public.delegacias(cidade, estado);
CREATE INDEX IF NOT EXISTS idx_contatos_judiciario_cidade ON public.contatos_judiciario(cidade);

-- 5. Territorial Trigger logic
CREATE OR REPLACE FUNCTION public.associate_client_delegacia()
RETURNS TRIGGER AS $$
DECLARE
    v_delegacia_id UUID;
BEGIN
    -- 1. Try exact match Cidade/UF
    SELECT id INTO v_delegacia_id FROM public.delegacias 
    WHERE lower(cidade) = lower(NEW.city) AND lower(estado) = lower(NEW.state)
    LIMIT 1;
    
    -- 2. If not found, try by state-wide catch-all or region if we had that detail
    -- (Expanding logic here if needed)

    IF v_delegacia_id IS NOT NULL THEN
        -- Store in metadata for now or pivot table
        NEW.metadata = coalesce(NEW.metadata, '{}'::jsonb) || jsonb_build_object('suggested_delegacia_id', v_delegacia_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_associate_delegacia ON public.clients;
CREATE TRIGGER tg_associate_delegacia
BEFORE INSERT OR UPDATE OF city, state ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.associate_client_delegacia();
