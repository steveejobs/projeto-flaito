-- Atualiza o template CONTRATO da *própria* office (fonte de verdade) para a versão com 11 cláusulas
-- Copia o conteúdo mais recente do template global (office_id IS NULL) para o template office-specific.

DO $$
DECLARE
  v_office_id uuid;
  v_global_content text;
BEGIN
  -- Ajuste: office_id detectado no HTML enviado pelo usuário / bucket office-branding
  v_office_id := '13196431-0967-407c-ba93-8cadce4a51e1';

  SELECT content
    INTO v_global_content
  FROM public.document_templates
  WHERE code = 'CONTRATO'
    AND office_id IS NULL
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_global_content IS NULL THEN
    RAISE EXCEPTION 'Template global CONTRATO não encontrado para copiar conteúdo.';
  END IF;

  UPDATE public.document_templates
     SET content = v_global_content,
         updated_at = now()
   WHERE code = 'CONTRATO'
     AND office_id = v_office_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template office-specific CONTRATO não encontrado para office_id=%', v_office_id;
  END IF;
END $$;
