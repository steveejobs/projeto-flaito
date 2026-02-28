-- Função para atualizar updated_at (se não existir)
CREATE OR REPLACE FUNCTION public.update_agenda_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabela de itens da agenda (compromissos, audiências, reuniões, prazos, tarefas)
CREATE TABLE public.agenda_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT DEFAULT 'TAREFA', -- AUDIENCIA, REUNIAO, PRAZO, TAREFA
  status TEXT DEFAULT 'PENDENTE', -- PENDENTE, CONCLUIDO, CANCELADO
  date DATE NOT NULL,
  time TIME NULL,
  case_id UUID NULL REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  location TEXT NULL,
  notes TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: apenas membros do escritório podem acessar
CREATE POLICY "Membros do escritório podem ver agenda" 
ON public.agenda_items 
FOR SELECT 
USING (
  office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Membros do escritório podem criar itens na agenda" 
ON public.agenda_items 
FOR INSERT 
WITH CHECK (
  office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Membros do escritório podem atualizar agenda" 
ON public.agenda_items 
FOR UPDATE 
USING (
  office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Membros do escritório podem deletar da agenda" 
ON public.agenda_items 
FOR DELETE 
USING (
  office_id IN (
    SELECT office_id FROM public.office_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Índices para performance
CREATE INDEX idx_agenda_items_office_id ON public.agenda_items(office_id);
CREATE INDEX idx_agenda_items_date ON public.agenda_items(date);
CREATE INDEX idx_agenda_items_case_id ON public.agenda_items(case_id);
CREATE INDEX idx_agenda_items_client_id ON public.agenda_items(client_id);
CREATE INDEX idx_agenda_items_status ON public.agenda_items(status);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_agenda_items_updated_at
BEFORE UPDATE ON public.agenda_items
FOR EACH ROW
EXECUTE FUNCTION public.update_agenda_updated_at();