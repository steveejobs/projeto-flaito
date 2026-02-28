-- Concede permissões básicas para a tabela generated_docs_legacy
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_docs_legacy TO authenticated;

-- Garante que sequências também tenham permissão (caso existam)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;