-- Concede SELECT na view vw_client_kit_latest_files para usuários autenticados
GRANT SELECT ON public.vw_client_kit_latest_files TO authenticated;

-- Comentário explicativo
COMMENT ON VIEW public.vw_client_kit_latest_files IS 'View para listar os documentos mais recentes do kit inicial do cliente (PROC, DECL, CONTRATO). Requer autenticação e respeita RLS da tabela client_files.';