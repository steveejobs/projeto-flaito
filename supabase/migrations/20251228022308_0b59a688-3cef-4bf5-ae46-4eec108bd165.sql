-- Habilitar RLS nas tabelas que têm políticas mas RLS desabilitado
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;

-- lexos_security_baseline pode não precisar de RLS (é tabela de configuração)
-- mas vamos habilitar por segurança
ALTER TABLE public.lexos_security_baseline ENABLE ROW LEVEL SECURITY;

-- Criar política básica para lexos_security_baseline (somente admins)
CREATE POLICY "Somente admins podem ver baseline de segurança"
ON public.lexos_security_baseline
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM office_members om
    WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);