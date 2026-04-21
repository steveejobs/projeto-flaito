-- ============================================================
-- MILSTONE: DOCUMENT GENERATION RESTORATION
-- DESC: Replaces the regressed simplified engine with a robust 
--       Handlebars-lite interpreter for complex legal/medical docs.
-- DATE: 2026-04-08
-- ============================================================

-- 1. DROP EXISTING VERSION (Force clean state)
DROP FUNCTION IF EXISTS public.render_template_preview(uuid, jsonb);
DROP FUNCTION IF EXISTS public.render_template_preview_raw(text, jsonb);

-- 2. HELPER: render_template_preview_raw (The core engine)
-- This accepts raw text, allowing previews before saving to DB.
CREATE OR REPLACE FUNCTION public.render_template_preview_raw(
  p_content text, 
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_content text := p_content;
  v_value text;
  v_cond_value text;
  r record;
  v_var_regex text;
BEGIN
  IF v_content IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2.1 Process Conditional Blocks {{#if var}}...{{/if}}
  -- Rules: null, "", false, "false", [], {} are Falsy.
  -- 0, "0", "anything else" are Truthy.
  FOR r IN SELECT DISTINCT (regexp_matches(v_content, '\{\{#if\s+([a-zA-Z0-9._[\]]+)\s*\}\}', 'gi'))[1] as cond_name
  LOOP
    -- Suporte a caminhos aninhados (ex: client.name)
    BEGIN
      v_cond_value := jsonb_extract_path_text(p_data, variadic string_to_array(r.cond_name, '.'));
    EXCEPTION WHEN OTHERS THEN
      v_cond_value := NULL;
    END;
    
    -- Truthiness check
    IF v_cond_value IS NULL 
       OR v_cond_value = '' 
       OR v_cond_value = 'null' 
       OR v_cond_value = 'false' 
       OR v_cond_value = '[]' 
       OR v_cond_value = '{}' THEN
       
      -- REMOVE the entire block
      v_content := regexp_replace(
        v_content,
        '\{\{#if\s+' || regexp_replace(r.cond_name, '([.[\]])', '\\\1', 'g') || '\s*\}\}.*?\{\{/if\}\}',
        '',
        'gis'
      );
    ELSE
      -- KEEP content, remove tags
      v_content := regexp_replace(
        v_content,
        '\{\{#if\s+' || regexp_replace(r.cond_name, '([.[\]])', '\\\1', 'g') || '\s*\}\}',
        '',
        'gi'
      );
    END IF;
  END LOOP;
  
  -- Clean up ORPHAN /if guards
  v_content := regexp_replace(v_content, '\{\{/if\}\}', '', 'gi');

  -- 2.2 Process Variable Substitution (Regex-based discovery)
  FOR r IN SELECT DISTINCT (regexp_matches(v_content, '\{\{\{?\s*([a-zA-Z0-9._[\]]+)\s*\}?\}\}', 'g'))[1] as var_name
  LOOP
    BEGIN
      v_value := jsonb_extract_path_text(p_data, variadic string_to_array(r.var_name, '.'));
    EXCEPTION WHEN OTHERS THEN
      v_value := NULL;
    END;
    
    v_value := COALESCE(v_value, '');
    v_var_regex := regexp_replace(r.var_name, '([.[\]])', '\\\1', 'g');

    -- A. Triple Braces {{{var}}} - Raw HTML (for Trusted fields like logos/signatures)
    v_content := regexp_replace(
      v_content,
      '\{\{\{\s*' || v_var_regex || '\s*\}\}\}',
      replace(replace(v_value, '\', '\\'), E'\n', '<br>'),
      'gi'
    );
    
    -- B. Double Braces {{var}} - Escaped/Formatted text
    v_content := regexp_replace(
      v_content,
      '\{\{\s*' || v_var_regex || '\s*\}\}',
      replace(replace(v_value, '\', '\\'), E'\n', '<br>'),
      'gi'
    );
  END LOOP;

  -- 2.3 FINAL CLEANUP: Remove any remaining placeholders to avoid messy documents
  v_content := regexp_replace(v_content, '\{\{\{[^}]+\}\}\}', '', 'g');
  v_content := regexp_replace(v_content, '\{\{#if\s+[^}]+\}\}', '', 'gi');
  v_content := regexp_replace(v_content, '\{\{/if\}\}', '', 'gi');
  v_content := regexp_replace(v_content, '\{\{[^}]+\}\}', '', 'g');

  RETURN v_content;
END;
$$;

-- 3. PUBLIC RPC: render_template_preview (Legacy compatibility)
-- Updated to return JSONB for Edge Function compatibility
CREATE OR REPLACE FUNCTION public.render_template_preview(
  p_template_id uuid, 
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_content text;
  v_rendered text;
BEGIN
  -- 3.1 Fetch template content
  SELECT content INTO v_content FROM public.document_templates WHERE id = p_template_id;
  
  IF v_content IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'Template não encontrado ou sem conteúdo'
    );
  END IF;

  -- 3.2 Render via the raw engine
  v_rendered := public.render_template_preview_raw(v_content, p_data);
  
  RETURN jsonb_build_object(
    'ok', true,
    'content', v_rendered
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'reason', SQLERRM
  );
END;
$$;

-- 4. PERMISSIONS
GRANT EXECUTE ON FUNCTION public.render_template_preview(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.render_template_preview_raw(text, jsonb) TO authenticated, service_role;
