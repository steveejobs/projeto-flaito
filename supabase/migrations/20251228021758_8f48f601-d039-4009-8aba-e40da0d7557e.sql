-- Corrigir permissões das funções usadas em RLS policies

-- Função case_belongs_to_current_office
GRANT EXECUTE ON FUNCTION public.case_belongs_to_current_office(uuid) TO authenticated;

-- Funções has_office_role (ambas versões)
GRANT EXECUTE ON FUNCTION public.has_office_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_office_role(uuid, text[]) TO authenticated;