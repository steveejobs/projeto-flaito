-- Criar tabela para transcrições de vídeos (para indexação de conhecimento)
CREATE TABLE public.video_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.legal_videos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  transcription TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'manual',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_video_transcriptions_office ON public.video_transcriptions(office_id);
CREATE INDEX idx_video_transcriptions_video ON public.video_transcriptions(video_id);

-- RLS
ALTER TABLE public.video_transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transcriptions from their office"
  ON public.video_transcriptions FOR SELECT
  USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert transcriptions for their office"
  ON public.video_transcriptions FOR INSERT
  WITH CHECK (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update transcriptions from their office"
  ON public.video_transcriptions FOR UPDATE
  USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete transcriptions from their office"
  ON public.video_transcriptions FOR DELETE
  USING (office_id IN (SELECT office_id FROM public.office_members WHERE user_id = auth.uid()));