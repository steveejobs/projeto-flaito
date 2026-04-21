-- Fix user's Procuração template content (office-specific) by syncing from global default template
DO $$
DECLARE
  v_source_id uuid := 'c7f7b944-5e74-43dc-91f3-2f4934be5fb3'::uuid;
  v_target_id uuid := 'd3b435d2-c4c8-4d09-b8d2-f738d6979729'::uuid;
BEGIN
  UPDATE public.document_templates t
  SET content = s.content,
      category = s.category,
      code = s.code,
      updated_at = now()
  FROM public.document_templates s
  WHERE t.id = v_target_id
    AND s.id = v_source_id;
END $$;