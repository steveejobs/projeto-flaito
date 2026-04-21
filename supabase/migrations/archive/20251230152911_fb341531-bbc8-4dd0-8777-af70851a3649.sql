-- ============================================================
-- Atualiza RPCs de Agenda para retornar meeting_url e meeting_provider
-- ============================================================

-- 1. ATUALIZAR get_agenda_range para incluir meeting_url e meeting_provider
CREATE OR REPLACE FUNCTION public.get_agenda_range(
  p_office_id uuid,
  p_from date,
  p_to date,
  p_assigned_to text DEFAULT NULL,
  p_include_done boolean DEFAULT TRUE,
  p_timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE (
  id uuid,
  title text,
  kind text,
  status text,
  local_date date,
  local_time time,
  end_time time,
  location text,
  notes text,
  all_day boolean,
  priority text,
  case_id uuid,
  case_title text,
  client_id uuid,
  client_name text,
  assigned_to text,
  created_at timestamptz,
  updated_at timestamptz,
  meeting_url text,
  meeting_provider text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.title::text,
    b.kind::text,
    b.status::text,
    (b.date AT TIME ZONE p_timezone)::date AS local_date,
    COALESCE(b.start_at::time, b.time::time) AS local_time,
    b.end_at::time AS end_time,
    b.location::text,
    b.notes::text,
    b.all_day,
    b.priority::text,
    b.case_id,
    c.title AS case_title,
    b.client_id,
    cl.full_name AS client_name,
    b.assigned_to::text,
    b.created_at,
    b.updated_at,
    b.meeting_url::text,
    b.meeting_provider::text
  FROM agenda_items b
  LEFT JOIN cases c ON c.id = b.case_id
  LEFT JOIN clients cl ON cl.id = b.client_id
  WHERE b.office_id = p_office_id
    AND (b.date AT TIME ZONE p_timezone)::date BETWEEN p_from AND p_to
    AND (p_assigned_to IS NULL OR b.assigned_to = p_assigned_to)
    AND (p_include_done OR UPPER(b.status) <> 'CONCLUIDO')
  ORDER BY (b.date AT TIME ZONE p_timezone)::date, COALESCE(b.start_at::time, b.time::time) NULLS LAST;
END;
$$;

-- 2. ATUALIZAR get_agenda_week_bundle para incluir meeting_url e meeting_provider nos items
CREATE OR REPLACE FUNCTION public.get_agenda_week_bundle(
  p_office_id uuid,
  p_week_start_local date,
  p_assigned_to text DEFAULT NULL,
  p_include_done boolean DEFAULT TRUE,
  p_include_conflicts boolean DEFAULT TRUE,
  p_timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_week_end date;
  v_items jsonb;
  v_assignees jsonb;
  v_conflicts jsonb;
BEGIN
  v_week_end := p_week_start_local + INTERVAL '6 days';

  -- Items
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'title', r.title,
      'kind', r.kind,
      'status', r.status,
      'local_date', r.local_date,
      'local_time', r.local_time,
      'end_time', r.end_time,
      'location', r.location,
      'notes', r.notes,
      'all_day', r.all_day,
      'priority', r.priority,
      'case_id', r.case_id,
      'case_title', r.case_title,
      'client_id', r.client_id,
      'client_name', r.client_name,
      'assigned_to', r.assigned_to,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'meeting_url', r.meeting_url,
      'meeting_provider', r.meeting_provider
    )
  ), '[]'::jsonb)
  INTO v_items
  FROM get_agenda_range(p_office_id, p_week_start_local, v_week_end, p_assigned_to, p_include_done, p_timezone) r;

  -- Assignees
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('assigned_to', a.assigned_to, 'total', a.total)
  ), '[]'::jsonb)
  INTO v_assignees
  FROM (
    SELECT b.assigned_to, COUNT(*)::int AS total
    FROM agenda_items b
    WHERE b.office_id = p_office_id
      AND (b.date AT TIME ZONE p_timezone)::date BETWEEN p_week_start_local AND v_week_end
      AND (p_include_done OR UPPER(b.status) <> 'CONCLUIDO')
    GROUP BY b.assigned_to
    ORDER BY total DESC
  ) a;

  -- Conflicts (optional)
  IF p_include_conflicts THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'a_id', a_id,
        'b_id', b_id,
        'assigned_to', assigned_to,
        'a_title', a_title,
        'b_title', b_title,
        'a_kind', a_kind,
        'b_kind', b_kind,
        'a_start', a_start,
        'a_end', a_end,
        'b_start', b_start,
        'b_end', b_end,
        'overlap_minutes', overlap_minutes
      )
    ), '[]'::jsonb)
    INTO v_conflicts
    FROM get_agenda_conflicts(p_office_id, p_week_start_local, v_week_end, p_timezone);
  ELSE
    v_conflicts := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'office_id', p_office_id,
    'timezone', p_timezone,
    'week_start_local', p_week_start_local,
    'week_end_local', v_week_end,
    'from', p_week_start_local,
    'to', v_week_end,
    'items', v_items,
    'assignees', v_assignees,
    'conflicts', v_conflicts
  );
END;
$$;

-- 3. ATUALIZAR get_agenda_month_bundle para incluir meeting_url e meeting_provider nos items
CREATE OR REPLACE FUNCTION public.get_agenda_month_bundle(
  p_office_id uuid,
  p_month_local date,
  p_assigned_to text DEFAULT NULL,
  p_include_done boolean DEFAULT TRUE,
  p_include_conflicts boolean DEFAULT FALSE,
  p_timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_first_day date;
  v_last_day date;
  v_grid_start date;
  v_grid_end date;
  v_today date;
  v_days jsonb;
  v_items jsonb;
  v_assignees jsonb;
BEGIN
  -- Primeiro e último dia do mês
  v_first_day := date_trunc('month', p_month_local)::date;
  v_last_day := (date_trunc('month', p_month_local) + INTERVAL '1 month - 1 day')::date;

  -- Ajustar grid para começar na segunda-feira
  v_grid_start := v_first_day - ((EXTRACT(DOW FROM v_first_day)::int + 6) % 7);
  -- Grid termina no domingo (6 semanas = 42 dias)
  v_grid_end := v_grid_start + INTERVAL '41 days';

  v_today := (NOW() AT TIME ZONE p_timezone)::date;

  -- Generate days array
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', d::date,
      'dow', EXTRACT(DOW FROM d)::int,
      'in_month', d >= v_first_day AND d <= v_last_day,
      'is_today', d = v_today
    )
    ORDER BY d
  ), '[]'::jsonb)
  INTO v_days
  FROM generate_series(v_grid_start, v_grid_end, INTERVAL '1 day') d;

  -- Items
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'title', r.title,
      'kind', r.kind,
      'status', r.status,
      'local_date', r.local_date,
      'local_time', r.local_time,
      'end_time', r.end_time,
      'location', r.location,
      'notes', r.notes,
      'all_day', r.all_day,
      'priority', r.priority,
      'case_id', r.case_id,
      'case_title', r.case_title,
      'client_id', r.client_id,
      'client_name', r.client_name,
      'assigned_to', r.assigned_to,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'meeting_url', r.meeting_url,
      'meeting_provider', r.meeting_provider
    )
  ), '[]'::jsonb)
  INTO v_items
  FROM get_agenda_range(p_office_id, v_grid_start, v_grid_end, p_assigned_to, p_include_done, p_timezone) r;

  -- Assignees
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('assigned_to', a.assigned_to, 'total', a.total)
  ), '[]'::jsonb)
  INTO v_assignees
  FROM (
    SELECT b.assigned_to, COUNT(*)::int AS total
    FROM agenda_items b
    WHERE b.office_id = p_office_id
      AND (b.date AT TIME ZONE p_timezone)::date BETWEEN v_grid_start AND v_grid_end
      AND (p_include_done OR UPPER(b.status) <> 'CONCLUIDO')
    GROUP BY b.assigned_to
    ORDER BY total DESC
  ) a;

  RETURN jsonb_build_object(
    'office_id', p_office_id,
    'timezone', p_timezone,
    'month_local', v_first_day,
    'from', v_grid_start,
    'to', v_grid_end,
    'days', v_days,
    'items', v_items,
    'assignees', v_assignees
  );
END;
$$;