-- Migration: Criação da tabela office_integrations para centralizar integrações SaaS.
-- Objetivo V1: Google Calendar (Um por Office)

DROP TABLE IF EXISTS public.office_integrations CASCADE;

CREATE TABLE public.office_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  provider text NOT NULL, -- ex: 'google_calendar'
  provider_account_email text, -- ex: 'contato@clinica.com'
  access_token text,
  refresh_token text NOT NULL,
  scopes jsonb,
  expires_at timestamptz,
  status text DEFAULT 'active', -- 'active', 'paused', 'revoked'
  last_error text,
  calendar_id text, -- O ID interno usado no Google (ex: 'primary')
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unicidade de integração por provedor dentro do escritório
  UNIQUE(office_id, provider)
);

-- Habilitar Row Level Security para segurança nativa
ALTER TABLE public.office_integrations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Leitura restrita aos administradores/membros daquele Office
-- (Depende da lógica de membros da sua tabela 'office_members', usamos 'select' básico como âncora)
-- A Edge Function usará a *Service Role*, ignorando o RLS.
CREATE POLICY "Membros da clínica podem ver suas integrações" 
  ON public.office_integrations 
  FOR SELECT 
  USING (
    exists (
      select 1 from public.office_members
      where office_members.office_id = office_integrations.office_id
      and office_members.user_id = auth.uid()
    )
  );

-- Policy 2: Apenas usuários autenticados da clínica podem criar/atualizar
CREATE POLICY "Membros da clínica gerenciam as integrações" 
  ON public.office_integrations 
  FOR ALL
  USING (
    exists (
      select 1 from public.office_members
      where office_members.office_id = office_integrations.office_id
      and office_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    exists (
      select 1 from public.office_members
      where office_members.office_id = office_integrations.office_id
      and office_members.user_id = auth.uid()
    )
  );

-- Indexes de performance para buscar rápido na Edge Function
CREATE INDEX idx_office_integrations_provider ON public.office_integrations(office_id, provider);
