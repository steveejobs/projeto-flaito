-- Corrigir função para usar SECURITY DEFINER (necessário para acessar office_members)
CREATE OR REPLACE FUNCTION public.lexos_is_owner_or_admin(p_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.office_members 
    WHERE office_id = p_office_id 
      AND user_id = auth.uid() 
      AND role IN ('OWNER', 'ADMIN')
  );
$$;

-- Garantir que authenticated tenha SELECT na tabela
GRANT SELECT ON public.audit_snapshots TO authenticated;
GRANT INSERT ON public.audit_snapshots TO authenticated;