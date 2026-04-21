-- Fix render_template_preview to properly handle variables with dots in conditionals
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
  v_block_start int;
  v_block_end int;
  v_if_tag text;
  v_endif_tag text;
  v_block_content text;
  v_full_block text;
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

  -- Process {{#if variable}}...{{/if}} blocks iteratively
  -- Use a simple string-based approach instead of complex regex
  LOOP
    -- Find the start of an #if block
    v_block_start := position('{{#if ' in v_content);
    
    IF v_block_start = 0 THEN
      EXIT; -- No more #if blocks
    END IF;
    
    -- Find the end of the #if tag (the closing }})
    v_block_end := position('}}' in substring(v_content from v_block_start));
    IF v_block_end = 0 THEN
      EXIT;
    END IF;
    
    -- Extract the full #if tag
    v_if_tag := substring(v_content from v_block_start for v_block_end + 1);
    
    -- Extract variable name from {{#if variable_name}}
    v_condition_name := trim(regexp_replace(v_if_tag, '\{\{#if\s+([^\s\}]+)\s*\}\}', '\1'));
    
    -- Find the matching {{/if}}
    v_endif_tag := '{{/if}}';
    v_block_end := position(v_endif_tag in substring(v_content from v_block_start));
    
    IF v_block_end = 0 THEN
      EXIT; -- Malformed template, no closing tag
    END IF;
    
    -- Extract the full block including tags
    v_full_block := substring(v_content from v_block_start for v_block_end + length(v_endif_tag) - 1);
    
    -- Extract content between #if and /if
    v_block_content := substring(v_full_block from length(v_if_tag) + 1 for length(v_full_block) - length(v_if_tag) - length(v_endif_tag));
    
    -- Get the value for this condition from JSONB
    v_condition_value := p_data ->> v_condition_name;
    
    -- If the value is truthy, keep the content; otherwise remove the entire block
    IF v_condition_value IS NOT NULL AND v_condition_value != '' AND v_condition_value != 'null' THEN
      -- Replace the entire block with just the content
      v_content := substring(v_content from 1 for v_block_start - 1) 
                   || v_block_content 
                   || substring(v_content from v_block_start + length(v_full_block));
    ELSE
      -- Remove the entire block
      v_content := substring(v_content from 1 for v_block_start - 1) 
                   || substring(v_content from v_block_start + length(v_full_block));
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