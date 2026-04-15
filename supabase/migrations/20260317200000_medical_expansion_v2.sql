-- Migration: Medical Expansion V2.0
-- Specialized tables for Iridology, Protocols, and Dietetics

-- 1. Iridologia: Avaliações (Imagens e dados brutos)
CREATE TABLE IF NOT EXISTS public.iridologia_avaliacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    olho_direito_url TEXT,
    olho_esquerdo_url TEXT,
    vitalidade_index NUMERIC,
    stress_index NUMERIC,
    constitution_type TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Iridologia: Laudos Detalhados (Análise técnica)
CREATE TABLE IF NOT EXISTS public.iridologia_laudos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avaliacao_id UUID NOT NULL REFERENCES public.iridologia_avaliacoes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('ALEMA', 'AMERICANA')),
    conclusao_tecnica TEXT,
    conteudo_json JSONB, -- Mapa de órgãos, sinais iridológicos, etc.
    sugestoes_ia JSONB, -- Sugestões brutas da IA para revisão
    pdf_url TEXT,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 3. Protocolos Terapêuticos (Recomendações baseadas nos laudos)
CREATE TABLE IF NOT EXISTS public.protocolos_terapeuticos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    laudo_id UUID REFERENCES public.iridologia_laudos(id) ON DELETE SET NULL,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    diagnostico TEXT,
    recomendacao TEXT,
    dosagem TEXT,
    duracao TEXT,
    categoria TEXT CHECK (categoria IN ('INJETAVEIS', 'NUTRACEUTICOS', 'FITOTERAPICOS', 'SUPLEMENTOS', 'OUTRO')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 4. Receitas e Dietas (Prescrição alimentar)
CREATE TABLE IF NOT EXISTS public.receitas_dietas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    metodo TEXT CHECK (metodo IN ('TROFOLOGIA', 'NATUROLOGIA', 'IRIDOLOGIA', 'NUTRICAO_CLINICA', 'OUTRO')),
    protocolo_alimentar TEXT,
    restricoes TEXT,
    recomendacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 5. Especialidades Médicas / Áreas de Atendimento
CREATE TABLE IF NOT EXISTS public.medical_specialties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- INSERIR ESPECIALIDADES BASE
INSERT INTO public.medical_specialties (name, description) VALUES
('Naturologia', 'Abordagem natural e holística da saúde.'),
('Neuropsicologia', 'Estudo das relações entre o cérebro e o comportamento.'),
('Neuropsicanálise', 'Integração da neurociência com a psicanálise.'),
('Medicina Integrativa', 'Abordagem que combina medicina convencional e terapias complementares.'),
('Nutrição Clínica', 'Foco no tratamento de doenças através da alimentação.'),
('Nutrição Esportiva', 'Foco na performance e saúde de atletas.')
ON CONFLICT (name) DO NOTHING;

-- RLS POLICIES (Seguindo o padrão de Medical User)
ALTER TABLE public.iridologia_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iridologia_laudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolos_terapeuticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas_dietas ENABLE ROW LEVEL SECURITY;

-- Política Genérica: Usuários vinculados ao Office_ID com role adequada
-- Como os membros médicos geralmente têm acesso ao office, usamos office_members

CREATE POLICY "Medical users can access iridologia_avaliacoes"
    ON public.iridologia_avaliacoes FOR ALL
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Medical users can access iridologia_laudos"
    ON public.iridologia_laudos FOR ALL
    USING (avaliacao_id IN (SELECT id FROM public.iridologia_avaliacoes WHERE office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)));

CREATE POLICY "Medical users can access protocolos_terapeuticos"
    ON public.protocolos_terapeuticos FOR ALL
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Medical users can access receitas_dietas"
    ON public.receitas_dietas FOR ALL
    USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true));

-- Especialidades: Leitura pública para autenticados
ALTER TABLE public.medical_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view specialties" ON public.medical_specialties FOR SELECT TO authenticated USING (true);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_iridologia_paciente ON public.iridologia_avaliacoes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_iridologia_laudo_avaliacao ON public.iridologia_laudos(avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_paciente ON public.protocolos_terapeuticos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_receitas_paciente ON public.receitas_dietas(paciente_id);
