-- 1. Tornar case_id nullable em generated_docs
ALTER TABLE public.generated_docs 
ALTER COLUMN case_id DROP NOT NULL;

-- 2. Adicionar client_id para documentos avulsos
ALTER TABLE public.generated_docs 
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- 3. Criar índice para client_id
CREATE INDEX IF NOT EXISTS idx_generated_docs_client_id ON public.generated_docs(client_id);

-- 4. Implementar a função create_initial_client_docs
CREATE OR REPLACE FUNCTION public.create_initial_client_docs(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
  v_template RECORD;
  v_template_codes text[] := ARRAY['PROC', 'DECL', 'CONTRATO'];
  v_code text;
BEGIN
  -- Verificar se o cliente existe
  SELECT id, office_id, created_by, full_name
  INTO v_client
  FROM public.clients
  WHERE id = p_client_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado: %', p_client_id;
  END IF;

  -- Para cada template do kit inicial
  FOREACH v_code IN ARRAY v_template_codes
  LOOP
    -- Buscar template: primeiro do office, depois global (is_default = true)
    SELECT id, name, content
    INTO v_template
    FROM public.document_templates
    WHERE code = v_code
      AND (office_id = v_client.office_id OR (office_id IS NULL AND is_default = true))
    ORDER BY 
      CASE WHEN office_id = v_client.office_id THEN 0 ELSE 1 END
    LIMIT 1;

    -- Se encontrou o template, criar o documento
    IF FOUND THEN
      INSERT INTO public.generated_docs (
        office_id,
        client_id,
        case_id,
        kind,
        title,
        version,
        content,
        source_template_id,
        metadata,
        created_by,
        status
      ) VALUES (
        v_client.office_id,
        p_client_id,
        NULL,
        'template',
        v_template.name || ' - ' || v_client.full_name,
        1,
        v_template.content,
        v_template.id,
        jsonb_build_object('auto_generated', true, 'kit_inicial', true),
        v_client.created_by,
        'RASCUNHO'
      );
    END IF;
  END LOOP;
END;
$$;

-- 5. Garantir que lexos_create_initial_client_docs chama a função correta
CREATE OR REPLACE FUNCTION public.lexos_create_initial_client_docs(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.create_initial_client_docs(p_client_id);
END;
$$;