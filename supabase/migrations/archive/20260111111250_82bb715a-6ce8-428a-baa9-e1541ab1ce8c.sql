-- Fase 1: Adicionar códigos faltantes ao dicionário TJTO
-- Usando categorias válidas: ANEXO, ATO_CARTORARIO, COMPROVANTE, COMUNICACAO_PROCESSUAL, 
-- PECA_PROCESSUAL, PRONUNCIAMENTO_JUDICIAL, PROVA_DOCUMENTAL, REPRESENTACAO

INSERT INTO public.nija_tjto_document_dictionary (code, label, legal_desc, category, active)
VALUES 
  -- Procurações e substabelecimentos
  ('PROC2', 'Procuração - Segunda via', 'Instrumento de procuração adicional ou substitutivo', 'REPRESENTACAO', true),
  ('SUBS1', 'Substabelecimento', 'Transferência de poderes a outro advogado', 'REPRESENTACAO', true),
  ('SUBS2', 'Substabelecimento - Segunda via', 'Segundo substabelecimento no processo', 'REPRESENTACAO', true),
  ('SUBS3', 'Substabelecimento - Terceira via', 'Terceiro substabelecimento no processo', 'REPRESENTACAO', true),
  
  -- Outros anexos
  ('OUT1', 'Outros Documentos 1', 'Documento anexo não categorizado', 'ANEXO', true),
  ('OUT2', 'Outros Documentos 2', 'Documento anexo não categorizado', 'ANEXO', true),
  ('OUT3', 'Outros Documentos 3', 'Documento anexo não categorizado', 'ANEXO', true),
  ('OUT4', 'Outros Documentos 4', 'Documento anexo não categorizado', 'ANEXO', true),
  
  -- Contratos
  ('CONTR1', 'Contrato Principal', 'Instrumento contratual base da relação jurídica', 'PROVA_DOCUMENTAL', true),
  ('CONTR2', 'Contrato Aditivo', 'Aditamento contratual', 'PROVA_DOCUMENTAL', true),
  ('CONTR3', 'Contrato de Confissão de Dívida', 'Instrumento de confissão de dívida', 'PROVA_DOCUMENTAL', true),
  ('CONTR4', 'Contrato de Garantia', 'Contrato acessório de garantia', 'PROVA_DOCUMENTAL', true),
  ('CONTR5', 'Cédula de Crédito Bancário', 'CCB - Título de crédito bancário', 'PROVA_DOCUMENTAL', true),
  
  -- Planilhas de cálculo
  ('PLAN1', 'Planilha de Cálculo Principal', 'Demonstrativo de débito atualizado', 'PROVA_DOCUMENTAL', true),
  ('PLAN2', 'Planilha de Cálculo Complementar', 'Complemento do demonstrativo de débito', 'PROVA_DOCUMENTAL', true),
  ('PLAN3', 'Planilha de Evolução do Débito', 'Demonstrativo de evolução da dívida', 'PROVA_DOCUMENTAL', true),
  ('PLAN6', 'Memória de Cálculo Atualizada', 'Memória de cálculo com atualização monetária', 'PROVA_DOCUMENTAL', true),
  
  -- Guias e custas
  ('DAJ1', 'Guia de Custas Iniciais', 'Comprovante de recolhimento de custas iniciais', 'COMPROVANTE', true),
  ('DAJ2', 'Guia de Custas Complementar', 'Comprovante de recolhimento de custas complementares', 'COMPROVANTE', true),
  ('DAJ7', 'Guia de Preparo Recursal', 'Comprovante de preparo de recurso', 'COMPROVANTE', true),
  
  -- Títulos de crédito
  ('PROM1', 'Nota Promissória', 'Título de crédito cambial', 'PROVA_DOCUMENTAL', true),
  ('PROM2', 'Nota Promissória - Segunda via', 'Segunda nota promissória do processo', 'PROVA_DOCUMENTAL', true),
  ('CHQ1', 'Cheque', 'Ordem de pagamento à vista', 'PROVA_DOCUMENTAL', true),
  ('DUP1', 'Duplicata', 'Título de crédito mercantil', 'PROVA_DOCUMENTAL', true),
  
  -- Notificações
  ('NOTIF1', 'Notificação Extrajudicial', 'Notificação prévia ao ajuizamento', 'COMUNICACAO_PROCESSUAL', true),
  ('NOTIF2', 'Notificação de Protesto', 'Instrumento de protesto de título', 'COMUNICACAO_PROCESSUAL', true)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  legal_desc = EXCLUDED.legal_desc,
  category = EXCLUDED.category,
  active = EXCLUDED.active,
  updated_at = now();

-- Criar tabela para códigos desconhecidos (para revisão pelo admin)
CREATE TABLE IF NOT EXISTS public.nija_tjto_unknown_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL,
  raw_text TEXT,
  source_document VARCHAR(255),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  action_taken VARCHAR(50) -- 'ADDED_TO_DICT', 'IGNORED', 'PENDING'
);

-- Índice para busca rápida de códigos pendentes
CREATE INDEX IF NOT EXISTS idx_tjto_unknown_codes_pending 
ON public.nija_tjto_unknown_codes(office_id, action_taken) 
WHERE action_taken = 'PENDING' OR action_taken IS NULL;

-- RLS para nija_tjto_unknown_codes
ALTER TABLE public.nija_tjto_unknown_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view unknown codes from their office" ON public.nija_tjto_unknown_codes;
CREATE POLICY "Users can view unknown codes from their office"
ON public.nija_tjto_unknown_codes FOR SELECT
USING (
  office_id IN (
    SELECT office_id FROM public.office_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert unknown codes for their office" ON public.nija_tjto_unknown_codes;
CREATE POLICY "Users can insert unknown codes for their office"
ON public.nija_tjto_unknown_codes FOR INSERT
WITH CHECK (
  office_id IN (
    SELECT office_id FROM public.office_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can update unknown codes" ON public.nija_tjto_unknown_codes;
CREATE POLICY "Admins can update unknown codes"
ON public.nija_tjto_unknown_codes FOR UPDATE
USING (
  office_id IN (
    SELECT om.office_id FROM public.office_members om 
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);