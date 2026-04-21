-- Migração: Motor de Templates V2 (Robust & Versioned)

-- 1. Tabela de Templates Mestre
CREATE TABLE IF NOT EXISTS public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE, -- NULL para templates de sistema
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 'Contratos', 'Petições', 'Médico', etc.
    vertical TEXT NOT NULL CHECK (vertical IN ('LEGAL', 'MEDICAL', 'BOTH')),
    current_version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Versões (Imutabilidade)
CREATE TABLE IF NOT EXISTS public.template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL, -- O conteúdo com {{variaveis}}
    change_log TEXT,
    published_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(template_id, version)
);

-- 3. Dicionário de Variáveis (Metadados)
CREATE TABLE IF NOT EXISTS public.template_variables (
    key TEXT PRIMARY KEY, -- ex: 'client.full_name'
    label TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'date', 'currency', 'long_text', 'boolean')),
    source_type TEXT DEFAULT 'system' CHECK (source_type IN ('system', 'custom')),
    required BOOLEAN DEFAULT false,
    default_value TEXT,
    vertical TEXT DEFAULT 'BOTH',
    category TEXT,
    help_text TEXT,
    is_active BOOLEAN DEFAULT true
);

-- 4. Documentos Gerados (Histórico & Auditoria)
CREATE TABLE IF NOT EXISTS public.generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
    template_version INTEGER NOT NULL,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    client_id UUID, -- Referência flexível para clients ou pacientes
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    vertical TEXT NOT NULL,
    content TEXT NOT NULL, -- O texto final processado
    used_variables JSONB NOT NULL DEFAULT '{}', -- Snapshot dos valores usados
    generation_mode TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- Políticas Básicas (Simplificadas para execução)
CREATE POLICY "Templates visíveis por escritório ou sistema" ON public.document_templates
    FOR SELECT USING (office_id IS NULL OR office_id = (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Documentos gerados restritos ao escritório" ON public.generated_documents
    FOR ALL USING (office_id = (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() LIMIT 1));
