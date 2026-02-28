-- Criar função de atualização do updated_at se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela para armazenar termos contratuais do cliente
CREATE TABLE public.client_contract_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  
  -- Tipo de remuneração
  tipo_remuneracao TEXT NOT NULL DEFAULT 'valor_fixo',
  percentual_honorarios NUMERIC(5,2),
  valor_fixo_honorarios NUMERIC(12,2),
  
  -- Forma de pagamento
  forma_pagamento TEXT NOT NULL DEFAULT 'a_vista',
  valor_entrada NUMERIC(12,2),
  numero_parcelas INTEGER,
  valor_parcela NUMERIC(12,2),
  data_primeira_parcela DATE,
  datas_parcelas JSONB,
  
  -- Método de pagamento
  metodo_pagamento TEXT NOT NULL DEFAULT 'pix',
  chave_pix TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Apenas um registro por cliente
CREATE UNIQUE INDEX idx_client_contract_terms_client ON public.client_contract_terms(client_id);

-- RLS
ALTER TABLE public.client_contract_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem termos do proprio escritorio"
  ON public.client_contract_terms FOR SELECT
  USING (office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Usuarios inserem termos no proprio escritorio"
  ON public.client_contract_terms FOR INSERT
  WITH CHECK (office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Usuarios atualizam termos do proprio escritorio"
  ON public.client_contract_terms FOR UPDATE
  USING (office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  ));

-- Trigger para updated_at
CREATE TRIGGER update_client_contract_terms_updated_at
  BEFORE UPDATE ON public.client_contract_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();