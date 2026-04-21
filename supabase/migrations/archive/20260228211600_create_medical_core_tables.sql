-- ============================================================
-- MÓDULO MÉDICO — Tabelas do Core Clínico (PEP, Agenda, Prescrição)
-- ============================================================

-- 1. AGENDA MÉDICA
CREATE TABLE IF NOT EXISTS public.agenda_medica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES auth.users(id),
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER DEFAULT 30,
  tipo_consulta TEXT DEFAULT 'primeira_vez' CHECK (tipo_consulta IN ('primeira_vez', 'retorno', 'procedimento')),
  status TEXT DEFAULT 'agendado' CHECK (status IN ('agendado', 'espera', 'em_atendimento', 'finalizado', 'cancelado', 'falta')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. PRESCRIÇÕES MÉDICAS (Receita completa)
CREATE TABLE IF NOT EXISTS public.prescricoes_medicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  consulta_id UUID REFERENCES public.consultas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES auth.users(id),
  dados_prescricao JSONB NOT NULL, -- Array de medicamentos e posologias
  orientacoes_gerais TEXT,
  pdf_url TEXT,
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'vencida')),
  validade_dias INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MODELOS MÉDICOS (Atalhos, Kits de Prescrição, Textos Padrão)
CREATE TABLE IF NOT EXISTS public.modelos_medicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES auth.users(id), -- Se nulo, é modelo da clínica toda
  tipo TEXT NOT NULL CHECK (tipo IN ('kit_prescricao', 'texto_exame_fisico', 'texto_anamnese', 'atestado_padrao', 'pedido_exame')),
  titulo TEXT NOT NULL,
  atalho TEXT, -- Ex: "/normal" para exame físico normal
  conteudo JSONB NOT NULL, -- Estrutura varia conforme o tipo
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

ALTER TABLE public.agenda_medica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescricoes_medicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_medicos ENABLE ROW LEVEL SECURITY;

-- Policies: membros do escritório podem acessar os dados da clínica
CREATE POLICY "agenda_medica_office_access" ON public.agenda_medica
  FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "prescricoes_medicas_office_access" ON public.prescricoes_medicas
  FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "modelos_medicos_office_access" ON public.modelos_medicos
  FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid() AND is_active = true)
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_agenda_medica_office ON public.agenda_medica(office_id);
CREATE INDEX IF NOT EXISTS idx_agenda_medica_data ON public.agenda_medica(data_hora);
CREATE INDEX IF NOT EXISTS idx_agenda_medica_status ON public.agenda_medica(status);
CREATE INDEX IF NOT EXISTS idx_agenda_medica_paciente ON public.agenda_medica(paciente_id);

CREATE INDEX IF NOT EXISTS idx_prescricoes_office ON public.prescricoes_medicas(office_id);
CREATE INDEX IF NOT EXISTS idx_prescricoes_consulta ON public.prescricoes_medicas(consulta_id);
CREATE INDEX IF NOT EXISTS idx_prescricoes_paciente ON public.prescricoes_medicas(paciente_id);

CREATE INDEX IF NOT EXISTS idx_modelos_office ON public.modelos_medicos(office_id);
CREATE INDEX IF NOT EXISTS idx_modelos_profissional ON public.modelos_medicos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_modelos_tipo ON public.modelos_medicos(tipo);
