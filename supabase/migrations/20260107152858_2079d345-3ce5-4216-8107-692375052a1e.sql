-- Conceder permissões básicas para usuários autenticados na tabela office_invites
GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_invites TO authenticated;

-- Permitir acesso de leitura para anon (para validação de token público na página de aceite)
GRANT SELECT ON public.office_invites TO anon;