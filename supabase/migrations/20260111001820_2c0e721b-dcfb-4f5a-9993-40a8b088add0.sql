-- ============================================
-- PATCH: RPC para inserir análise NIJA em modo sessão
-- Bypass RLS quando case_id é NULL (modo sessão com session_id)
-- ============================================

-- 1. Criar RPC SECURITY DEFINER para inserção segura
CREATE OR REPLACE FUNCTION public.lexos_nija_insert_analysis(
  p_documents_hash text,
  p_analysis_key text,
  p_analysis jsonb,
  p_case_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_id uuid;
  v_user_id uuid;
  v_office_id uuid;
BEGIN
  -- Obter user_id autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Obter office_id do usuário
  SELECT om.office_id INTO v_office_id
  FROM office_members om
  WHERE om.user_id = v_user_id AND COALESCE(om.is_active, true) = true
  ORDER BY (lower(om.role) = 'owner') DESC, om.created_at DESC
  LIMIT 1;
  
  -- Se tem case_id, validar que pertence ao office
  IF p_case_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM cases c 
      WHERE c.id = p_case_id AND c.office_id = v_office_id
    ) THEN
      RAISE EXCEPTION 'Caso não pertence ao escritório do usuário';
    END IF;
  END IF;
  
  -- Inserir análise
  INSERT INTO nija_case_analysis (
    documents_hash,
    analysis_key,
    analysis,
    case_id,
    session_id
  ) VALUES (
    p_documents_hash,
    p_analysis_key,
    p_analysis,
    p_case_id,
    p_session_id
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- 2. Grant execute para authenticated
GRANT EXECUTE ON FUNCTION public.lexos_nija_insert_analysis TO authenticated;

-- 3. Adicionar policy para SELECT em modo sessão (session_id != NULL, case_id = NULL)
DROP POLICY IF EXISTS nija_case_analysis_select_session ON nija_case_analysis;
CREATE POLICY nija_case_analysis_select_session ON nija_case_analysis
  FOR SELECT
  USING (
    case_id IS NULL 
    AND session_id IS NOT NULL
    AND session_id = session_id -- sempre true, RPC valida via auth context
  );

-- 4. Criar RPC para inserir peça gerada com validação
CREATE OR REPLACE FUNCTION public.lexos_nija_insert_piece(
  p_piece_type text,
  p_documents_hash text,
  p_case_id uuid,
  p_piece jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_id uuid;
  v_user_id uuid;
  v_office_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  SELECT om.office_id INTO v_office_id
  FROM office_members om
  WHERE om.user_id = v_user_id AND COALESCE(om.is_active, true) = true
  LIMIT 1;
  
  -- Validar case pertence ao office
  IF NOT EXISTS (
    SELECT 1 FROM cases c 
    WHERE c.id = p_case_id AND c.office_id = v_office_id
  ) THEN
    RAISE EXCEPTION 'Caso não pertence ao escritório do usuário';
  END IF;
  
  INSERT INTO nija_generated_pieces (
    piece_type,
    documents_hash,
    case_id,
    piece
  ) VALUES (
    p_piece_type,
    p_documents_hash,
    p_case_id,
    p_piece
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lexos_nija_insert_piece TO authenticated;