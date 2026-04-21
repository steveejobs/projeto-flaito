-- Add soft delete columns to generated_docs
ALTER TABLE public.generated_docs 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_reason TEXT DEFAULT NULL;

-- Create soft delete RPC for generated_docs
CREATE OR REPLACE FUNCTION public.soft_delete_document(p_document_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_office UUID;
  v_doc_office UUID;
BEGIN
  -- Check if user is admin/owner
  IF NOT public.has_office_role('admin') THEN
    RAISE EXCEPTION 'Sem permissão para excluir documento.';
  END IF;

  v_office := public.current_office_id();
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'Usuário sem office ativo.';
  END IF;

  -- Check document belongs to user's office
  SELECT office_id INTO v_doc_office
  FROM public.generated_docs
  WHERE id = p_document_id;

  IF v_doc_office IS NULL THEN
    RAISE EXCEPTION 'Documento não encontrado.';
  END IF;

  IF v_doc_office <> v_office THEN
    RAISE EXCEPTION 'Documento pertence a outro escritório.';
  END IF;

  -- Soft delete
  UPDATE public.generated_docs
  SET 
    deleted_at = NOW(),
    deleted_by = auth.uid(),
    deleted_reason = p_reason
  WHERE id = p_document_id;
END;
$$;

-- Create restore RPC for generated_docs
CREATE OR REPLACE FUNCTION public.restore_soft_deleted_document(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_office UUID;
  v_doc_office UUID;
BEGIN
  -- Check if user is admin/owner
  IF NOT public.has_office_role('admin') THEN
    RAISE EXCEPTION 'Sem permissão para restaurar documento.';
  END IF;

  v_office := public.current_office_id();
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'Usuário sem office ativo.';
  END IF;

  -- Check document belongs to user's office
  SELECT office_id INTO v_doc_office
  FROM public.generated_docs
  WHERE id = p_document_id;

  IF v_doc_office IS NULL THEN
    RAISE EXCEPTION 'Documento não encontrado.';
  END IF;

  IF v_doc_office <> v_office THEN
    RAISE EXCEPTION 'Documento pertence a outro escritório.';
  END IF;

  -- Restore
  UPDATE public.generated_docs
  SET 
    deleted_at = NULL,
    deleted_by = NULL,
    deleted_reason = NULL
  WHERE id = p_document_id;
END;
$$;

-- Create can_for_generated_doc_type to check permissions for generated_docs
CREATE OR REPLACE FUNCTION public.can_for_generated_doc_type(p_type_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN p_action = 'view' THEN dtp.can_view
      WHEN p_action = 'upload' THEN dtp.can_upload
      WHEN p_action = 'download' THEN dtp.can_download
      WHEN p_action = 'delete' THEN dtp.can_delete
      ELSE false
    END
    FROM public.document_type_permissions dtp
    WHERE dtp.office_id = public.current_office_id()
      AND dtp.type_id = p_type_id
      AND dtp.role = public.current_office_role()
    LIMIT 1
  ), true);
$$;