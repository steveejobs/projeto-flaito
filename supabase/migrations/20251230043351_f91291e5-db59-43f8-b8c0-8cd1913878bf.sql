-- Fix COALESCE type incompatibility: convert start_at to time before coalescing with time column
CREATE OR REPLACE FUNCTION public.get_agenda_week_bundle(
  p_office_id uuid,
  p_week_start date,
  p_assigned_to uuid DEFAULT NULL,
  p_include_done boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_end date;
  v_items jsonb;
  v_conflicts jsonb;
  v_summary jsonb;
BEGIN
  v_week_end := p_week_start + 6;

  -- Fetch items for the week
  SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'date'), (item->>'local_time'), (item->>'title')), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'id', a.id,
      'title', a.title,
      'date', a.date,
      'local_date', to_char(a.date, 'YYYY-MM-DD'),
      'local_time', COALESCE(a.time, a.start_at::time)::text,
      'time', a.time,
      'start_at', a.start_at,
      'end_at', a.end_at,
      'all_day', a.all_day,
      'kind', a.kind,
      'status', a.status,
      'priority', a.priority,
      'location', a.location,
      'notes', a.notes,
      'client_id', a.client_id,
      'case_id', a.case_id,
      'assigned_to', a.assigned_to,
      'visibility', a.visibility
    ) AS item
    FROM agenda_items a
    WHERE a.office_id = p_office_id
      AND a.date >= p_week_start
      AND a.date <= v_week_end
      AND (p_assigned_to IS NULL OR a.assigned_to = p_assigned_to)
      AND (p_include_done = true OR COALESCE(a.status, 'pending') != 'done')
    ORDER BY a.date, COALESCE(a.time, a.start_at::time), a.title
  ) sub;

  -- Detect conflicts (same date+time with multiple items)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', conflict_date,
      'time', conflict_time,
      'count', conflict_count,
      'item_ids', item_ids
    )
  ), '[]'::jsonb)
  INTO v_conflicts
  FROM (
    SELECT 
      a.date AS conflict_date,
      COALESCE(a.time, a.start_at::time) AS conflict_time,
      COUNT(*) AS conflict_count,
      array_agg(a.id) AS item_ids
    FROM agenda_items a
    WHERE a.office_id = p_office_id
      AND a.date >= p_week_start
      AND a.date <= v_week_end
      AND (p_assigned_to IS NULL OR a.assigned_to = p_assigned_to)
      AND COALESCE(a.time, a.start_at::time) IS NOT NULL
      AND a.all_day = false
    GROUP BY a.date, COALESCE(a.time, a.start_at::time)
    HAVING COUNT(*) > 1
  ) conflicts;

  -- Summary counts
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE COALESCE(status, 'pending') = 'pending'),
    'done', COUNT(*) FILTER (WHERE status = 'done'),
    'by_kind', COALESCE(
      jsonb_object_agg(COALESCE(kind, 'other'), kind_count) FILTER (WHERE kind IS NOT NULL),
      '{}'::jsonb
    )
  )
  INTO v_summary
  FROM (
    SELECT status, kind, COUNT(*) OVER (PARTITION BY kind) as kind_count
    FROM agenda_items
    WHERE office_id = p_office_id
      AND date >= p_week_start
      AND date <= v_week_end
      AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
      AND (p_include_done = true OR COALESCE(status, 'pending') != 'done')
  ) stats;

  RETURN jsonb_build_object(
    'items', v_items,
    'conflicts', v_conflicts,
    'summary', v_summary,
    'week_start', p_week_start,
    'week_end', v_week_end
  );
END;
$$;