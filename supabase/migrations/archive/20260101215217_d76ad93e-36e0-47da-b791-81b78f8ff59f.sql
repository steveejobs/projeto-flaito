-- Tabela para convites de membros do escritório
CREATE TABLE public.office_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'ADMIN')),
  invited_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_office_invites_office_id ON public.office_invites(office_id);
CREATE INDEX idx_office_invites_token ON public.office_invites(token);
CREATE INDEX idx_office_invites_expires_at ON public.office_invites(expires_at) WHERE accepted_at IS NULL;

-- Enable RLS
ALTER TABLE public.office_invites ENABLE ROW LEVEL SECURITY;

-- Policy: OWNER e ADMIN podem ver convites do próprio escritório
CREATE POLICY "Office admins can view invites"
ON public.office_invites
FOR SELECT
USING (
  office_id IN (
    SELECT om.office_id FROM public.office_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('OWNER', 'ADMIN') AND om.is_active = true
  )
);

-- Policy: OWNER e ADMIN podem criar convites
CREATE POLICY "Office admins can create invites"
ON public.office_invites
FOR INSERT
WITH CHECK (
  office_id IN (
    SELECT om.office_id FROM public.office_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('OWNER', 'ADMIN') AND om.is_active = true
  )
  AND invited_by = auth.uid()
);

-- Policy: OWNER e ADMIN podem deletar convites pendentes
CREATE POLICY "Office admins can delete pending invites"
ON public.office_invites
FOR DELETE
USING (
  accepted_at IS NULL
  AND office_id IN (
    SELECT om.office_id FROM public.office_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('OWNER', 'ADMIN') AND om.is_active = true
  )
);

-- Policy: Qualquer usuário autenticado pode ver convite pelo token (para aceitar)
CREATE POLICY "Users can view invite by token"
ON public.office_invites
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Policy: Usuário pode atualizar convite para aceitar (marcar accepted_at)
CREATE POLICY "Users can accept invites"
ON public.office_invites
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND accepted_at IS NULL
  AND expires_at > now()
)
WITH CHECK (
  accepted_by = auth.uid()
  AND accepted_at IS NOT NULL
);