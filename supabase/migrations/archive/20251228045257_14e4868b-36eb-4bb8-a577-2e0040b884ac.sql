-- Conceder permissão de execução da função render_template_preview para service_role
GRANT EXECUTE ON FUNCTION public.render_template_preview(uuid, jsonb) TO service_role;

-- Também garantir para authenticated (usuários logados)
GRANT EXECUTE ON FUNCTION public.render_template_preview(uuid, jsonb) TO authenticated;