-- Adicionar campos profissionais em office_members
ALTER TABLE public.office_members
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS rg text,
ADD COLUMN IF NOT EXISTS rg_issuer text,
ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'brasileiro(a)',
ADD COLUMN IF NOT EXISTS marital_status text,
ADD COLUMN IF NOT EXISTS profession text DEFAULT 'Advogado',
ADD COLUMN IF NOT EXISTS oab_number text,
ADD COLUMN IF NOT EXISTS oab_uf text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS address_street text,
ADD COLUMN IF NOT EXISTS address_neighborhood text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text,
ADD COLUMN IF NOT EXISTS address_zip_code text;

-- Adicionar campo all_lawyers_assigned em clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS all_lawyers_assigned boolean DEFAULT true;

-- Criar tabela de advogados atribuídos ao cliente
CREATE TABLE IF NOT EXISTS public.client_assigned_lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.office_members(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, member_id)
);

-- Habilitar RLS
ALTER TABLE public.client_assigned_lawyers ENABLE ROW LEVEL SECURITY;

-- Política: membros do escritório podem ver advogados atribuídos aos clientes do escritório
CREATE POLICY "Members can view assigned lawyers for their office clients"
ON public.client_assigned_lawyers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.office_members om ON om.office_id = c.office_id
    WHERE c.id = client_assigned_lawyers.client_id
    AND om.user_id = auth.uid()
    AND om.is_active = true
  )
);

-- Política: membros ativos podem inserir advogados atribuídos
CREATE POLICY "Active members can insert assigned lawyers"
ON public.client_assigned_lawyers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.office_members om ON om.office_id = c.office_id
    WHERE c.id = client_assigned_lawyers.client_id
    AND om.user_id = auth.uid()
    AND om.is_active = true
  )
);

-- Política: membros ativos podem atualizar advogados atribuídos
CREATE POLICY "Active members can update assigned lawyers"
ON public.client_assigned_lawyers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.office_members om ON om.office_id = c.office_id
    WHERE c.id = client_assigned_lawyers.client_id
    AND om.user_id = auth.uid()
    AND om.is_active = true
  )
);

-- Política: membros ativos podem deletar advogados atribuídos
CREATE POLICY "Active members can delete assigned lawyers"
ON public.client_assigned_lawyers
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.office_members om ON om.office_id = c.office_id
    WHERE c.id = client_assigned_lawyers.client_id
    AND om.user_id = auth.uid()
    AND om.is_active = true
  )
);