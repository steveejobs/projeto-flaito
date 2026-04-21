-- Primeiro dropar a função existente para poder recriá-la
DROP FUNCTION IF EXISTS public.render_template_preview(uuid, jsonb);

-- Recriar função com suporte a triple braces {{{var}}} e condicionais {{#if}}
CREATE OR REPLACE FUNCTION public.render_template_preview(p_template_id uuid, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content text;
  v_value text;
  r record;
BEGIN
  -- Obter conteúdo do template
  SELECT content INTO v_content FROM document_templates WHERE id = p_template_id;
  
  IF v_content IS NULL THEN
    RETURN NULL;
  END IF;

  -- Processar blocos condicionais {{#if var}}...{{/if}} PRIMEIRO
  -- Remove o bloco inteiro se a variável estiver vazia ou não existir
  FOR r IN SELECT tv.var AS var_name FROM public.template_vars(p_template_id) AS tv
  LOOP
    v_value := COALESCE(NULLIF(TRIM(p_data ->> r.var_name), ''), NULL);
    
    IF v_value IS NULL OR v_value = '' THEN
      -- Se valor vazio, remove o bloco {{#if var}}...{{/if}} inteiro
      v_content := regexp_replace(
        v_content,
        '\{\{#if\s+' || regexp_replace(r.var_name, '([.[\]])', '\\\1', 'g') || '\s*\}\}.*?\{\{/if\}\}',
        '',
        'gis'
      );
    ELSE
      -- Se valor presente, remove apenas as tags {{#if}} e {{/if}}, mantendo o conteúdo
      v_content := regexp_replace(
        v_content,
        '\{\{#if\s+' || regexp_replace(r.var_name, '([.[\]])', '\\\1', 'g') || '\s*\}\}',
        '',
        'gi'
      );
    END IF;
  END LOOP;
  
  -- Remover todas as tags {{/if}} restantes
  v_content := regexp_replace(v_content, '\{\{/if\}\}', '', 'gi');

  -- Substituir variáveis do template
  FOR r IN SELECT tv.var AS var_name FROM public.template_vars(p_template_id) AS tv
  LOOP
    v_value := COALESCE(p_data ->> r.var_name, '');
    
    -- Primeiro substituir triple braces {{{var}}} (HTML não escapado - Handlebars syntax)
    v_content := regexp_replace(
      v_content,
      '\{\{\{\s*' || regexp_replace(r.var_name, '([.[\]])', '\\\1', 'g') || '\s*\}\}\}',
      replace(replace(v_value, '\', '\\'), E'\n', '<br>'),
      'gi'
    );
    
    -- Depois substituir double braces {{var}}
    v_content := regexp_replace(
      v_content,
      '\{\{\s*' || regexp_replace(r.var_name, '([.[\]])', '\\\1', 'g') || '\s*\}\}',
      replace(replace(v_value, '\', '\\'), E'\n', '<br>'),
      'gi'
    );
  END LOOP;

  -- Limpar quaisquer tags de template restantes não processadas
  v_content := regexp_replace(v_content, '\{\{\{[^}]+\}\}\}', '', 'g');
  v_content := regexp_replace(v_content, '\{\{#if\s+[^}]+\}\}', '', 'gi');
  v_content := regexp_replace(v_content, '\{\{/if\}\}', '', 'gi');
  v_content := regexp_replace(v_content, '\{\{[^}]+\}\}', '', 'g');

  RETURN v_content;
END;
$$;