-- ============================================================
-- BASELINE MÍNIMA: MÓDULO MÉDICO
-- ============================================================

-- 1. AGENDA MÉDICA
CREATE TABLE IF NOT EXISTS public.agenda_medica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER DEFAULT 30,
  tipo_consulta TEXT CHECK (tipo_consulta IN ('primeira_vez', 'retorno', 'procedimento')),
  status TEXT DEFAULT 'agendado' CHECK (status IN ('agendado', 'espera', 'em_atendimento', 'finalizado', 'cancelado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. IRIDOLOGIA (ANALISES)
CREATE TABLE IF NOT EXISTS public.iris_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  right_image_id UUID,
  left_image_id UUID,
  analysis_type TEXT DEFAULT 'complete',
  status TEXT DEFAULT 'completed',
  clinical_data TEXT,
  ai_response JSONB,
  findings JSONB DEFAULT '[]'::jsonb,
  critical_alerts JSONB DEFAULT '[]'::jsonb,
  anamnesis_questions JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PROTOCOLOS TERAPÊUTICOS
CREATE TABLE IF NOT EXISTS public.protocolos_terapeuticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  condicao TEXT NOT NULL,
  categoria TEXT CHECK (categoria IN ('nutricao', 'integrativa', 'neurologia', 'geral')),
  nivel_evidencia TEXT CHECK (nivel_evidencia IN ('A', 'B', 'C', 'D')),
  descricao TEXT,
  conteudo JSONB DEFAULT '[]'::jsonb,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RECEITAS E DIETAS
CREATE TABLE IF NOT EXISTS public.receitas_dietas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  itens JSONB DEFAULT '[]'::jsonb,
  orientacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS — Políticas Básicas por Office — Habilitação
ALTER TABLE public.agenda_medica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iris_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolos_terapeuticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas_dietas ENABLE ROW LEVEL SECURITY;

-- Verificação e criação de políticas de acesso
DO $$ 
BEGIN
    -- Agenda Médica
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'office_access_agenda_medica' AND tablename = 'agenda_medica') THEN
        CREATE POLICY "office_access_agenda_medica" ON public.agenda_medica FOR ALL USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));
    END IF;
    
    -- Iris Analyses
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'office_access_iris_analyses' AND tablename = 'iris_analyses') THEN
        CREATE POLICY "office_access_iris_analyses" ON public.iris_analyses FOR ALL USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));
    END IF;
    
    -- Protocolos Terapêuticos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'office_access_protocolos_terapeuticos' AND tablename = 'protocolos_terapeuticos') THEN
        CREATE POLICY "office_access_protocolos_terapeuticos" ON public.protocolos_terapeuticos FOR ALL USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));
    END IF;
    
    -- Receitas e Dietas
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'office_access_receitas_dietas' AND tablename = 'receitas_dietas') THEN
        CREATE POLICY "office_access_receitas_dietas" ON public.receitas_dietas FOR ALL USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));
    END IF;
END $$;
