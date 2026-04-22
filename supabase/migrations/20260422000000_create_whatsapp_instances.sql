CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  office_id UUID NOT NULL,
  instance_name TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'Flaito CRM',
  server_url TEXT NOT NULL,
  instance_token TEXT NOT NULL,
  token TEXT NOT NULL,
  webhook_url TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_connection_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS baseadas no office_id e user_id
CREATE POLICY "Users can view instances in their office"
  ON public.whatsapp_instances FOR SELECT
  TO authenticated
  USING (
    office_id IN (
      SELECT office_id FROM public.office_members WHERE user_id = auth.uid()
    ) OR user_id = auth.uid()
  );

CREATE POLICY "Users can insert own instances"
  ON public.whatsapp_instances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update instances in their office"
  ON public.whatsapp_instances FOR UPDATE
  TO authenticated
  USING (
    office_id IN (
      SELECT office_id FROM public.office_members WHERE user_id = auth.uid()
    ) OR user_id = auth.uid()
  );

CREATE POLICY "Users can delete own instances"
  ON public.whatsapp_instances FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
