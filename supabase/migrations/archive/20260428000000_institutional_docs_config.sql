-- Migration: 20260428000000 - Configuração Institucional de Documentos (Consolidado)
-- Descrição: Implementa campos institucionais, snapshots e migra dados legados.

BEGIN;

-- 1. Tabela de Logs de Migração (Relatório)
CREATE TABLE IF NOT EXISTS public.system_migration_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name text NOT NULL,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- 2. Evolução da tabela offices
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='offices' AND column_name='legal_name') THEN
        ALTER TABLE public.offices ADD COLUMN legal_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='offices' AND column_name='cnpj') THEN
        ALTER TABLE public.offices ADD COLUMN cnpj text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='offices' AND column_name='branding') THEN
        ALTER TABLE public.offices ADD COLUMN branding jsonb DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='offices' AND column_name='institutional_notes') THEN
        ALTER TABLE public.offices ADD COLUMN institutional_notes text;
    END IF;
END $$;

-- 3. Criação da tabela office_units
CREATE TABLE IF NOT EXISTS public.office_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    name text NOT NULL,
    unit_type text DEFAULT 'CLINICA' CHECK (unit_type IN ('CLINICA', 'ESCRITORIO', 'UNIDADE_MOVEL', 'OUTRO')),
    address_line text,
    city text,
    state text,
    zip_code text,
    phone text,
    email text,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    header_content text, 
    footer_content text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_units_office_id ON public.office_units(office_id);
ALTER TABLE public.office_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Units: Allow read for office members" ON public.office_units;
CREATE POLICY "Units: Allow read for office members" ON public.office_units
    FOR SELECT USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Units: Allow manage for admins" ON public.office_units;
CREATE POLICY "Units: Allow manage for admins" ON public.office_units
    FOR ALL USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN'))
    );

-- 4. Criação da tabela profile_professional_settings
CREATE TABLE IF NOT EXISTS public.profile_professional_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    professional_name text,
    ident_type text CHECK (ident_type IN ('OAB', 'CRM')),
    ident_number text,
    ident_uf text,
    role_title text, 
    signatures jsonb DEFAULT '[]'::jsonb, -- Array de objetos: {role, label, signature_url, rubber_url, stamp_url}
    medical_specific jsonb DEFAULT '{}'::jsonb,
    legal_specific jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, office_id)
);

ALTER TABLE public.profile_professional_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ProfSettings: Allow read for office members" ON public.profile_professional_settings;
CREATE POLICY "ProfSettings: Allow read for office members" ON public.profile_professional_settings
    FOR SELECT USING (
        office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ProfSettings: Allow self manage" ON public.profile_professional_settings;
CREATE POLICY "ProfSettings: Allow self manage" ON public.profile_professional_settings
    FOR ALL USING (auth.uid() = user_id);

-- 5. Adição de snapshot nas tabelas de documentos
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='documents' AND table_schema='public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='institutional_snapshot') THEN
            ALTER TABLE public.documents ADD COLUMN institutional_snapshot jsonb;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='patient_documents' AND table_schema='public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_documents' AND column_name='institutional_snapshot') THEN
            ALTER TABLE public.patient_documents ADD COLUMN institutional_snapshot jsonb;
        END IF;
    END IF;
END $$;

-- 6. RPC: resolve_document_context (Snapshot Fallback)
CREATE OR REPLACE FUNCTION public.resolve_document_context(
    p_office_id uuid,
    p_user_id uuid,
    p_unit_id uuid DEFAULT NULL,
    p_document_id uuid DEFAULT NULL,
    p_is_medical boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_snapshot jsonb;
    v_office jsonb;
    v_unit jsonb;
    v_professional jsonb;
    v_result jsonb;
BEGIN
    -- 1. Tentar Snapshot (Nível 1)
    IF p_document_id IS NOT NULL THEN
        IF p_is_medical THEN
            SELECT institutional_snapshot INTO v_snapshot FROM public.patient_documents WHERE id = p_document_id;
        ELSE
            SELECT institutional_snapshot INTO v_snapshot FROM public.documents WHERE id = p_document_id;
        END IF;
        
        IF v_snapshot IS NOT NULL THEN
            RETURN v_snapshot;
        END IF;
    END IF;

    -- 2. Dados do Office
    SELECT jsonb_build_object(
        'name', name,
        'legal_name', COALESCE(legal_name, name),
        'cnpj', cnpj,
        'branding', branding,
        'institutional_notes', institutional_notes
    ) INTO v_office
    FROM public.offices
    WHERE id = p_office_id;

    -- 3. Dados da Unidade
    IF p_unit_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'id', id, 'name', name, 'address', address_line, 'city', city, 
            'state', state, 'type', unit_type, 'phone', phone
        ) INTO v_unit
        FROM public.office_units
        WHERE id = p_unit_id AND office_id = p_office_id;
    END IF;

    -- 4. Dados do Profissional
    SELECT jsonb_build_object(
        'name', professional_name,
        'ident_type', ident_type,
        'ident_number', ident_number,
        'ident_uf', ident_uf,
        'signatures', signatures,
        'medical', medical_specific,
        'legal', legal_specific
    ) INTO v_professional
    FROM public.profile_professional_settings
    WHERE user_id = p_user_id AND office_id = p_office_id;

    -- Consolidar Final (Fallback)
    v_result := jsonb_build_object(
        'office', v_office,
        'unit', v_unit,
        'professional', v_professional,
        'resolved_at', now(),
        'version', '1.0'
    );

    RETURN v_result;
END;
$$;

-- 7. Migração Automática de user_medical_settings (Idempotente)
DO $$
DECLARE
    v_migrated_count int := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_medical_settings' AND table_schema='public') THEN
        INSERT INTO public.profile_professional_settings (
            user_id, office_id, professional_name, ident_type, ident_number, ident_uf, 
            medical_specific, metadata
        )
        SELECT 
            user_id, 
            office_id, 
            (SELECT full_name FROM public.profiles p WHERE p.id = ums.user_id),
            'CRM',
            crm,
            crm_uf,
            jsonb_build_object('specialty', specialty),
            jsonb_build_object('migrated_from', 'user_medical_settings', 'migrated_at', now())
        FROM public.user_medical_settings ums
        ON CONFLICT (user_id, office_id) DO NOTHING;
        
        GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
        
        INSERT INTO public.system_migration_logs (migration_name, details)
        VALUES ('INSTITUTIONAL_MIGRATION_MEDICAL', jsonb_build_object('migrated_rows', v_migrated_count));
    END IF;
END $$;

COMMIT;
