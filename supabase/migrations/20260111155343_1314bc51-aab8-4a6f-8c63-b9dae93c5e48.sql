-- =====================================================
-- FSM: Populate States, Transitions, Views & RPC Functions
-- =====================================================

-- 1. Insert default states
INSERT INTO public.lexos_case_states (id, code, name, sort_order, is_terminal, is_active)
VALUES
  ('00000000-0000-0000-0001-000000000001', 'novo', 'Novo', 1, false, true),
  ('00000000-0000-0000-0001-000000000002', 'em_analise', 'Em Análise', 2, false, true),
  ('00000000-0000-0000-0001-000000000003', 'documentacao_pendente', 'Documentação Pendente', 3, false, true),
  ('00000000-0000-0000-0001-000000000004', 'aguardando_cliente', 'Aguardando Cliente', 4, false, true),
  ('00000000-0000-0000-0001-000000000005', 'em_negociacao', 'Em Negociação', 5, false, true),
  ('00000000-0000-0000-0001-000000000006', 'ajuizado', 'Ajuizado', 6, false, true),
  ('00000000-0000-0000-0001-000000000007', 'aguardando_audiencia', 'Aguardando Audiência', 7, false, true),
  ('00000000-0000-0000-0001-000000000008', 'aguardando_sentenca', 'Aguardando Sentença', 8, false, true),
  ('00000000-0000-0000-0001-000000000009', 'em_recurso', 'Em Recurso', 9, false, true),
  ('00000000-0000-0000-0001-000000000010', 'execucao', 'Execução', 10, false, true),
  ('00000000-0000-0000-0001-000000000011', 'encerrado_sucesso', 'Encerrado - Êxito', 11, true, true),
  ('00000000-0000-0000-0001-000000000012', 'encerrado_improcedente', 'Encerrado - Improcedente', 12, true, true),
  ('00000000-0000-0000-0001-000000000013', 'arquivado', 'Arquivado', 13, true, true)
ON CONFLICT (id) DO UPDATE SET 
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_terminal = EXCLUDED.is_terminal,
  is_active = EXCLUDED.is_active;

-- 2. Insert allowed transitions (flexible workflow)
INSERT INTO public.lexos_case_state_transitions (from_state_id, to_state_id, is_active)
VALUES
  -- From Novo
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000002', true), -- Novo -> Em Análise
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000003', true), -- Novo -> Doc Pendente
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000013', true), -- Novo -> Arquivado
  
  -- From Em Análise
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0001-000000000003', true), -- Em Análise -> Doc Pendente
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0001-000000000004', true), -- Em Análise -> Aguard Cliente
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0001-000000000005', true), -- Em Análise -> Em Negociação
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0001-000000000006', true), -- Em Análise -> Ajuizado
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0001-000000000013', true), -- Em Análise -> Arquivado
  
  -- From Documentação Pendente
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0001-000000000002', true), -- Doc Pendente -> Em Análise
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0001-000000000004', true), -- Doc Pendente -> Aguard Cliente
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0001-000000000013', true), -- Doc Pendente -> Arquivado
  
  -- From Aguardando Cliente
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0001-000000000002', true), -- Aguard Cliente -> Em Análise
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0001-000000000003', true), -- Aguard Cliente -> Doc Pendente
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0001-000000000005', true), -- Aguard Cliente -> Em Negociação
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0001-000000000013', true), -- Aguard Cliente -> Arquivado
  
  -- From Em Negociação
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0001-000000000006', true), -- Em Negociação -> Ajuizado
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0001-000000000011', true), -- Em Negociação -> Encerrado Êxito
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0001-000000000013', true), -- Em Negociação -> Arquivado
  
  -- From Ajuizado
  ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0001-000000000007', true), -- Ajuizado -> Aguard Audiência
  ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0001-000000000008', true), -- Ajuizado -> Aguard Sentença
  ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0001-000000000005', true), -- Ajuizado -> Em Negociação (acordo)
  
  -- From Aguardando Audiência
  ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0001-000000000008', true), -- Aguard Audiência -> Aguard Sentença
  ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0001-000000000005', true), -- Aguard Audiência -> Em Negociação
  ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0001-000000000011', true), -- Aguard Audiência -> Encerrado Êxito
  
  -- From Aguardando Sentença
  ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0001-000000000009', true), -- Aguard Sentença -> Em Recurso
  ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0001-000000000010', true), -- Aguard Sentença -> Execução
  ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0001-000000000011', true), -- Aguard Sentença -> Encerrado Êxito
  ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0001-000000000012', true), -- Aguard Sentença -> Encerrado Improcedente
  
  -- From Em Recurso
  ('00000000-0000-0000-0001-000000000009', '00000000-0000-0000-0001-000000000010', true), -- Em Recurso -> Execução
  ('00000000-0000-0000-0001-000000000009', '00000000-0000-0000-0001-000000000011', true), -- Em Recurso -> Encerrado Êxito
  ('00000000-0000-0000-0001-000000000009', '00000000-0000-0000-0001-000000000012', true), -- Em Recurso -> Encerrado Improcedente
  
  -- From Execução
  ('00000000-0000-0000-0001-000000000010', '00000000-0000-0000-0001-000000000011', true), -- Execução -> Encerrado Êxito
  ('00000000-0000-0000-0001-000000000010', '00000000-0000-0000-0001-000000000013', true) -- Execução -> Arquivado
ON CONFLICT DO NOTHING;

-- 3. Create or replace the view for current state
CREATE OR REPLACE VIEW public.vw_case_current_state AS
SELECT 
  c.id AS case_id,
  c.office_id,
  c.state_id AS current_state_id,
  h.changed_at AS current_state_changed_at,
  h.changed_by AS current_state_changed_by,
  h.note AS current_state_note
FROM public.cases c
LEFT JOIN LATERAL (
  SELECT changed_at, changed_by, note
  FROM public.lexos_case_state_history
  WHERE case_id = c.id
  ORDER BY changed_at DESC
  LIMIT 1
) h ON true
WHERE c.deleted_at IS NULL;

-- 4. Create or replace the timeline view
CREATE OR REPLACE VIEW public.vw_case_state_timeline AS
SELECT 
  h.id AS history_id,
  h.case_id,
  h.from_state_id,
  fs.code AS from_state_code,
  fs.name AS from_state_name,
  h.to_state_id,
  ts.code AS to_state_code,
  ts.name AS to_state_name,
  h.changed_at,
  h.changed_by,
  h.note
FROM public.lexos_case_state_history h
LEFT JOIN public.lexos_case_states fs ON fs.id = h.from_state_id
LEFT JOIN public.lexos_case_states ts ON ts.id = h.to_state_id
ORDER BY h.changed_at DESC;

-- 5. Create RPC function to get next states for a case
CREATE OR REPLACE FUNCTION public.lexos_next_states_for_case(p_case_id uuid)
RETURNS TABLE (
  to_state_id uuid,
  to_state_code text,
  to_state_name text,
  sort_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_state_id uuid;
  v_office_id uuid;
BEGIN
  -- Get current state and office
  SELECT c.state_id, c.office_id INTO v_current_state_id, v_office_id
  FROM public.cases c
  WHERE c.id = p_case_id AND c.deleted_at IS NULL;
  
  -- Validate access
  IF v_office_id IS NULL THEN
    RETURN;
  END IF;
  
  IF NOT lexos_is_member(v_office_id) THEN
    RETURN;
  END IF;
  
  -- If no current state, return all initial states
  IF v_current_state_id IS NULL THEN
    RETURN QUERY
    SELECT s.id, s.code, s.name, s.sort_order
    FROM public.lexos_case_states s
    WHERE s.is_active = true AND s.is_terminal = false
    ORDER BY s.sort_order;
    RETURN;
  END IF;
  
  -- Return valid transitions from current state
  RETURN QUERY
  SELECT s.id, s.code, s.name, s.sort_order
  FROM public.lexos_case_state_transitions t
  JOIN public.lexos_case_states s ON s.id = t.to_state_id
  WHERE t.from_state_id = v_current_state_id
    AND t.is_active = true
    AND s.is_active = true
  ORDER BY s.sort_order;
END;
$$;

-- 6. Create RPC function to transition case state
CREATE OR REPLACE FUNCTION public.lexos_transition_case_state(
  p_case_id uuid,
  p_to_state_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_state_id uuid;
  v_office_id uuid;
  v_history_id uuid;
  v_is_valid boolean;
BEGIN
  -- Get current state and office
  SELECT c.state_id, c.office_id INTO v_current_state_id, v_office_id
  FROM public.cases c
  WHERE c.id = p_case_id AND c.deleted_at IS NULL;
  
  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Caso não encontrado';
  END IF;
  
  IF NOT lexos_is_member(v_office_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  
  -- Validate transition (allow any transition if no current state)
  IF v_current_state_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.lexos_case_state_transitions t
      WHERE t.from_state_id = v_current_state_id
        AND t.to_state_id = p_to_state_id
        AND t.is_active = true
    ) INTO v_is_valid;
    
    IF NOT v_is_valid THEN
      RAISE EXCEPTION 'Transição inválida: transição não permitida a partir do estado atual';
    END IF;
  END IF;
  
  -- Insert history record
  INSERT INTO public.lexos_case_state_history (
    case_id, office_id, from_state_id, to_state_id, changed_by, note
  ) VALUES (
    p_case_id, v_office_id, v_current_state_id, p_to_state_id, auth.uid(), p_note
  ) RETURNING id INTO v_history_id;
  
  -- Update case state
  UPDATE public.cases
  SET state_id = p_to_state_id, updated_at = now()
  WHERE id = p_case_id;
  
  RETURN v_history_id;
END;
$$;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.lexos_next_states_for_case(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_transition_case_state(uuid, uuid, text) TO authenticated;

-- 8. Enable RLS on state tables (for SELECT)
ALTER TABLE public.lexos_case_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexos_case_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexos_case_state_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read states and transitions
CREATE POLICY "States are readable by authenticated users"
ON public.lexos_case_states FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Transitions are readable by authenticated users"
ON public.lexos_case_state_transitions FOR SELECT
TO authenticated
USING (true);

-- History is readable by office members
CREATE POLICY "History is readable by office members"
ON public.lexos_case_state_history FOR SELECT
TO authenticated
USING (lexos_is_member(office_id));

-- History insert is allowed via RPC only (SECURITY DEFINER)