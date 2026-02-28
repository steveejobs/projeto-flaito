-- Drop and recreate render_template_preview to handle Handlebars conditionals
CREATE OR REPLACE FUNCTION public.render_template_preview(
  p_template_id UUID,
  p_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content text;
  r record;
  v_value text;
  v_missing text[];
  v_condition_name text;
  v_condition_value text;
  v_pattern text;
  v_match text;
BEGIN
  SELECT content INTO v_content
  FROM public.document_templates
  WHERE id = p_template_id;

  IF v_content IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'template_not_found');
  END IF;

  -- Get missing vars
  SELECT array_agg(mv.var) INTO v_missing
  FROM public.template_missing_vars(p_template_id, p_data) AS mv;

  -- First, process {{#if variable}}...{{/if}} blocks
  -- Find all #if blocks and process them
  LOOP
    -- Match pattern: {{#if var_name}}content{{/if}}
    -- Using a simple approach for single-level conditionals
    v_pattern := '\{\{#if\s+([a-zA-Z0-9_\.]+)\s*\}\}(.*?)\{\{/if\}\}';
    
    IF NOT v_content ~ v_pattern THEN
      EXIT;
    END IF;
    
    -- Extract the condition name
    v_condition_name := (regexp_match(v_content, v_pattern, 's'))[1];
    
    IF v_condition_name IS NULL THEN
      EXIT;
    END IF;
    
    -- Get the value for this condition
    v_condition_value := p_data ->> v_condition_name;
    
    -- If the value is truthy (not null/empty), keep the content, otherwise remove the block
    IF v_condition_value IS NOT NULL AND v_condition_value != '' AND v_condition_value != 'null' THEN
      -- Keep the content between if/endif, remove the if/endif tags
      v_content := regexp_replace(
        v_content,
        '\{\{#if\s+' || regexp_replace(v_condition_name, '\.', '\.', 'g') || '\s*\}\}(.*?)\{\{/if\}\}',
        '\1',
        'gs'
      );
    ELSE
      -- Remove the entire block including content
      v_content := regexp_replace(
        v_content,
        '\{\{#if\s+' || regexp_replace(v_condition_name, '\.', '\.', 'g') || '\s*\}\}.*?\{\{/if\}\}',
        '',
        'gs'
      );
    END IF;
  END LOOP;

  -- Then process simple variable substitutions
  FOR r IN SELECT tv.var AS var_name FROM public.template_vars(p_template_id) AS tv
  LOOP
    v_value := COALESCE(p_data ->> r.var_name, '');
    v_content := regexp_replace(
      v_content,
      '\{\{\s*' || regexp_replace(r.var_name, '\.', '\.', 'g') || '\s*\}\}',
      replace(v_value, '\', '\\'),
      'g'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'missing', COALESCE(to_jsonb(v_missing), '[]'::jsonb),
    'content', v_content
  );
END;
$$;