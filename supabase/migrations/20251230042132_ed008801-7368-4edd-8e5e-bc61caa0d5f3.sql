-- RPC: get_agenda_week_bundle
-- Retorna todos os itens da agenda de uma semana específica com dados denormalizados

CREATE OR REPLACE FUNCTION public.get_agenda_week_bundle(
  p_office_id uuid,
  p_week_start_local date,
  p_assigned_to uuid DEFAULT NULL,
  p_include_done boolean DEFAULT true,
  p_include_conflicts boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_end date;
  v_items jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_assignees jsonb := '[]'::jsonb;
BEGIN
  -- Calcula fim da semana (domingo)
  v_week_end := p_week_start_local + INTERVAL '6 days';

  -- Busca itens da semana com dados denormalizados
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'title', a.title,
      'kind', a.kind,
      'status', a.status,
      'local_date', a.date::text,
      'local_time', COALESCE(a.time::text, a.start_at::text),
      'end_time', a.end_at::text,
      'location', a.location,
      'notes', a.notes,
      'all_day', a.all_day,
      'priority', a.priority,
      'case_id', a.case_id,
      'case_title', c.title,
      'client_id', a.client_id,
      'client_name', cl.full_name,
      'assigned_to', a.assigned_to,
      'created_at', a.created_at,
      'updated_at', a.updated_at
    ) ORDER BY a.date, COALESCE(a.time, a.start_at), a.title
  ), '[]'::jsonb)
  INTO v_items
  FROM agenda_items a
  LEFT JOIN cases c ON c.id = a.case_id AND c.deleted_at IS NULL
  LEFT JOIN clients cl ON cl.id = a.client_id AND cl.deleted_at IS NULL
  WHERE a.office_id = p_office_id
    AND a.date >= p_week_start_local
    AND a.date <= v_week_end
    AND (p_assigned_to IS NULL OR a.assigned_to = p_assigned_to)
    AND (p_include_done OR COALESCE(a.status, 'PENDENTE') != 'CONCLUIDO');

  -- Busca assignees únicos para chips
  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'user_id', a.assigned_to,
    'count', 1
  )), '[]'::jsonb)
  INTO v_assignees
  FROM agenda_items a
  WHERE a.office_id = p_office_id
    AND a.date >= p_week_start_local
    AND a.date <= v_week_end
    AND a.assigned_to IS NOT NULL;

  -- Detecta conflitos de horário (mesmo dia, mesmo horário, itens diferentes)
  IF p_include_conflicts THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'date', conflict_date,
        'time', conflict_time,
        'items', conflict_items
      )
    ), '[]'::jsonb)
    INTO v_conflicts
    FROM (
      SELECT 
        a.date AS conflict_date,
        COALESCE(a.time, a.start_at) AS conflict_time,
        jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title)) AS conflict_items
      FROM agenda_items a
      WHERE a.office_id = p_office_id
        AND a.date >= p_week_start_local
        AND a.date <= v_week_end
        AND COALESCE(a.time, a.start_at) IS NOT NULL
        AND COALESCE(a.status, 'PENDENTE') != 'CANCELADO'
      GROUP BY a.date, COALESCE(a.time, a.start_at)
      HAVING COUNT(*) > 1
    ) conflicts;
  END IF;

  RETURN jsonb_build_object(
    'week_start', p_week_start_local,
    'week_end', v_week_end,
    'total', jsonb_array_length(v_items),
    'items', v_items,
    'conflicts', v_conflicts,
    'assignees', v_assignees
  );
END;
$$;

-- Garante que apenas membros do escritório podem chamar
COMMENT ON FUNCTION public.get_agenda_week_bundle IS 'Retorna bundle completo da agenda semanal com itens denormalizados, conflitos e assignees';