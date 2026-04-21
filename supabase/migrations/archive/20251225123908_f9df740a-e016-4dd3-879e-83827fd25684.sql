-- Tabela de dicionário de eventos do eProc
CREATE TABLE IF NOT EXISTS public.nija_eproc_event_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  meaning TEXT,
  category TEXT DEFAULT 'OUTRO',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_eproc_event_dict_code ON public.nija_eproc_event_dictionary(code);
CREATE INDEX IF NOT EXISTS idx_eproc_event_dict_active ON public.nija_eproc_event_dictionary(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.nija_eproc_event_dictionary ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública (dicionário é público)
CREATE POLICY "eproc_dict_public_read" ON public.nija_eproc_event_dictionary
  FOR SELECT USING (true);

-- Dados iniciais do dicionário eProc (eventos mais comuns)
INSERT INTO public.nija_eproc_event_dictionary (code, label, meaning, category) VALUES
  ('INIC1', 'Petição Inicial', 'Documento que inaugura o processo judicial', 'PROTOCOLO'),
  ('DESP1', 'Despacho', 'Determinação do juiz sem conteúdo decisório', 'DECISAO'),
  ('SENT1', 'Sentença', 'Decisão que resolve o mérito ou extingue o processo', 'SENTENCA'),
  ('CERT1', 'Certidão', 'Declaração de ato ou fato processual pelo cartório', 'OUTRO'),
  ('MAND1', 'Mandado', 'Ordem judicial para cumprimento de determinação', 'OUTRO'),
  ('INTM1', 'Intimação', 'Comunicação processual às partes ou advogados', 'INTIMACAO'),
  ('CITA1', 'Citação', 'Comunicação ao réu para integrar o processo', 'CITACAO'),
  ('CONT1', 'Contestação', 'Resposta do réu à petição inicial', 'OUTRO'),
  ('PETI1', 'Petição', 'Requerimento das partes ao juízo', 'OUTRO'),
  ('DECI1', 'Decisão Interlocutória', 'Decisão que resolve questão incidente', 'DECISAO'),
  ('AUDI1', 'Ata de Audiência', 'Registro de audiência realizada', 'AUDIENCIA'),
  ('BLOC1', 'Bloqueio de Valores', 'Ordem de bloqueio via Bacenjud/Sisbajud', 'PENHORA'),
  ('PENH1', 'Penhora', 'Constrição de bens para garantia da execução', 'PENHORA'),
  ('EMBA1', 'Embargos', 'Recurso ou impugnação à execução', 'OUTRO'),
  ('REPL1', 'Réplica', 'Manifestação do autor sobre a contestação', 'OUTRO'),
  ('ACOR1', 'Acordo', 'Composição amigável entre as partes', 'OUTRO'),
  ('TRAN1', 'Trânsito em Julgado', 'Certificação de que não cabe mais recurso', 'OUTRO'),
  ('ARQU1', 'Arquivamento', 'Encerramento físico do processo', 'OUTRO'),
  ('DISTR', 'Distribuição', 'Protocolo e distribuição do processo', 'PROTOCOLO'),
  ('GUIA1', 'Guia de Custas', 'Documento para pagamento de custas processuais', 'OUTRO'),
  ('LAUDO', 'Laudo Pericial', 'Relatório técnico de perícia', 'OUTRO'),
  ('ALVAR', 'Alvará', 'Autorização judicial para levantamento de valores', 'OUTRO'),
  ('CUMPR', 'Cumprimento de Sentença', 'Início da fase de cumprimento', 'OUTRO'),
  ('EXECU', 'Execução', 'Início da fase executiva', 'OUTRO'),
  ('RENAJ', 'Renajud', 'Consulta/restrição de veículos via Renajud', 'PENHORA'),
  ('SISBA', 'Sisbajud', 'Bloqueio/desbloqueio via Sisbajud', 'PENHORA'),
  ('BACEN', 'Bacenjud', 'Bloqueio/desbloqueio via Bacenjud (legado)', 'PENHORA'),
  ('APELA', 'Apelação', 'Recurso de apelação interposto', 'OUTRO'),
  ('AGRAV', 'Agravo', 'Recurso de agravo interposto', 'OUTRO'),
  ('ACORD', 'Acórdão', 'Decisão colegiada do tribunal', 'SENTENCA')
ON CONFLICT (code) DO NOTHING;