-- Recriar a função save_template_version com SECURITY DEFINER para bypassar RLS
CREATE OR REPLACE FUNCTION public.save_template_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last int;
BEGIN
  SELECT COALESCE(MAX(version),0) INTO v_last
  FROM public.document_template_versions
  WHERE template_id = NEW.id;

  INSERT INTO public.document_template_versions (template_id, version, content, created_by)
  VALUES (NEW.id, v_last + 1, NEW.content, auth.uid());

  RETURN NEW;
END;
$$;