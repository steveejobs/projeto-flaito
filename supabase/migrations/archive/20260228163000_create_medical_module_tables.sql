-- ============================================================
-- MÓDULO MÉDICO — Tabelas para Plataforma de Apoio à Decisão Clínica Integrativa
-- ============================================================

-- 1. PACIENTES
CREATE TABLE IF NOT EXISTS public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  data_nascimento DATE,
  sexo TEXT CHECK (sexo IN ('M', 'F', 'Outro')),
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  historico_medico TEXT,
  alergias TEXT,
  medicamentos_em_uso TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'arquivado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. CONSULTAS
CREATE TABLE IF NOT EXISTS public.consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  data_consulta TIMESTAMPTZ DEFAULT now(),
  queixa_principal TEXT,
  sintomas TEXT,
  historico TEXT,
  exame_fisico TEXT,
  conduta TEXT,
  observacoes TEXT,
  profissional_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'realizada' CHECK (status IN ('agendada', 'realizada', 'cancelada')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TRANSCRIÇÕES
CREATE TABLE IF NOT EXISTS public.transcricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  consulta_id UUID REFERENCES public.consultas(id) ON DELETE SET NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  audio_url TEXT,
  transcricao_bruta TEXT,
  queixa_extraida TEXT,
  sintomas_extraidos TEXT,
  historico_extraido TEXT,
  conduta_extraida TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluida', 'erro')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. ANÁLISES CLÍNICAS
CREATE TABLE IF NOT EXISTS public.analises_clinicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  consulta_id UUID REFERENCES public.consultas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('nutricao', 'integrativa', 'neurologia', 'completa')),
  dados_entrada JSONB,
  resultado JSONB,
  hipoteses TEXT,
  abordagens_nutricionais TEXT,
  abordagens_integrativas TEXT,
  sugestoes_investigacao TEXT,
  referencias TEXT,
  disclaimer TEXT DEFAULT 'Este relatório é um suporte à decisão clínica. Não constitui diagnóstico definitivo.',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 5. PROTOCOLOS
CREATE TABLE IF NOT EXISTS public.protocolos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  condicao TEXT NOT NULL,
  descricao TEXT,
  nivel_evidencia TEXT CHECK (nivel_evidencia IN ('A', 'B', 'C', 'D')),
  categoria TEXT CHECK (categoria IN ('nutricao', 'integrativa', 'neurologia', 'geral')),
  conteudo JSONB,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6. REFERÊNCIAS CIENTÍFICAS
CREATE TABLE IF NOT EXISTS public.referencias_cientificas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  protocolo_id UUID REFERENCES public.protocolos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  autores TEXT,
  publicacao TEXT,
  ano INTEGER,
  doi TEXT,
  url TEXT,
  resumo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analises_clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referencias_cientificas ENABLE ROW LEVEL SECURITY;

-- Policies: membros do escritório podem ver/inserir/atualizar seus dados
CREATE POLICY "pacientes_office_access" ON public.pacientes
  FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
  );

CREATE POLICY "consultas_office_access" ON public.consultas
  FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
  );

CREATE POLICY "transcricoes_office_access" ON public.transcricoes
  FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
  );

CREATE POLICY "analises_clinicas_office_access" ON public.analises_clinicas
  FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
  );

CREATE POLICY "protocolos_office_access" ON public.protocolos
  FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
  );

CREATE POLICY "referencias_cientificas_office_access" ON public.referencias_cientificas
  FOR ALL USING (
    office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid())
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pacientes_office ON public.pacientes(office_id);
CREATE INDEX IF NOT EXISTS idx_consultas_office ON public.consultas(office_id);
CREATE INDEX IF NOT EXISTS idx_consultas_paciente ON public.consultas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_transcricoes_office ON public.transcricoes(office_id);
CREATE INDEX IF NOT EXISTS idx_analises_clinicas_office ON public.analises_clinicas(office_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_office ON public.protocolos(office_id);
CREATE INDEX IF NOT EXISTS idx_referencias_office ON public.referencias_cientificas(office_id);
