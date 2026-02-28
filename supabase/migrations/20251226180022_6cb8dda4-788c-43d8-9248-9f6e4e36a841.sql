-- Tabela case_event_segments para auditoria forense de segmentos de eventos
CREATE TABLE IF NOT EXISTS public.case_event_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.case_events(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.offices(id),
  seq INTEGER NOT NULL,
  event_date DATE,
  raw_description TEXT NOT NULL,
  document_nature TEXT NOT NULL CHECK (document_nature IN ('peticao', 'decisao', 'comunicacao', 'prova', 'sistemico', 'procuracao', 'anexo')),
  label TEXT NOT NULL,
  tjto_code TEXT,
  excerpt TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')) DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_case_event_segments_case_id ON public.case_event_segments(case_id);
CREATE INDEX IF NOT EXISTS idx_case_event_segments_event_id ON public.case_event_segments(event_id);
CREATE INDEX IF NOT EXISTS idx_case_event_segments_office_id ON public.case_event_segments(office_id);
CREATE INDEX IF NOT EXISTS idx_case_event_segments_nature ON public.case_event_segments(document_nature);

-- Habilitar RLS
ALTER TABLE public.case_event_segments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Segments são visíveis por membros do escritório"
ON public.case_event_segments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = case_event_segments.office_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Segments podem ser inseridos por membros do escritório"
ON public.case_event_segments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = case_event_segments.office_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Segments podem ser atualizados por membros do escritório"
ON public.case_event_segments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = case_event_segments.office_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Segments podem ser deletados por membros do escritório"
ON public.case_event_segments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = case_event_segments.office_id
    AND om.user_id = auth.uid()
  )
);

-- Coluna is_image_pdf na tabela documents (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'is_image_pdf'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN is_image_pdf BOOLEAN DEFAULT FALSE;
  END IF;
END $$;