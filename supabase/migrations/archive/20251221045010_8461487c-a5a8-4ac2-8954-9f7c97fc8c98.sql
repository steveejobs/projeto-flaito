-- Fix ambiguous column reference in template_missing_vars function
CREATE OR REPLACE FUNCTION public.template_missing_vars(p_template_id uuid, p_data jsonb)
 RETURNS TABLE(var text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  DECLARE
    r record;
    v text;
  BEGIN
    FOR r IN SELECT tv.var AS var_name FROM public.template_vars(p_template_id) AS tv
    LOOP
      v := COALESCE(p_data ->> r.var_name, '');
      IF btrim(v) = '' THEN
        var := r.var_name;
        RETURN NEXT;
      END IF;
    END LOOP;
    RETURN;
  END;
$function$;

-- Fix ambiguous column reference in render_template_preview function
CREATE OR REPLACE FUNCTION public.render_template_preview(p_template_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  DECLARE
    v_content text;
    r record;
    v_value text;
    v_missing text[];
  BEGIN
    SELECT content INTO v_content
    FROM public.document_templates
    WHERE id = p_template_id;

    IF v_content IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'template_not_found');
    END IF;

    SELECT array_agg(mv.var) INTO v_missing
    FROM public.template_missing_vars(p_template_id, p_data) AS mv;

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
$function$;