-- ============================================================
-- BLOCO E — AGENDA
-- Executar no: Supabase SQL Editor
-- Projeto: ccvbosbjtlxewqybvwqj
-- Objetos: get_agenda_month_bundle
-- Dependências externas: case_deadlines, cases (existem)
-- ============================================================

BEGIN;

-- 1. RPC: get_agenda_month_bundle
CREATE OR REPLACE FUNCTION public.get_agenda_month_bundle(
  p_office_id uuid,
  p_year int,
  p_month int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date date;
  v_end_date date;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + interval '1 month' - interval '1 day')::date;

  RETURN jsonb_build_object(
    'events', (
      SELECT COALESCE(json_agg(e), '[]'::json)
      FROM (
        SELECT
          cd.id,
          cd.title,
          cd.description,
          cd.due_date AS event_date,
          cd.priority,
          cd.status,
          cd.case_id,
          c.title AS case_title
        FROM public.case_deadlines cd
        LEFT JOIN public.cases c ON c.id = cd.case_id
        WHERE cd.office_id = p_office_id
          AND cd.due_date BETWEEN v_start_date AND v_end_date
        ORDER BY cd.due_date
      ) e
    ),
    'year', p_year,
    'month', p_month
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_agenda_month_bundle(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agenda_month_bundle(uuid, int, int) TO authenticated;

COMMIT;

-- ============================================================
-- VALIDAÇÃO TÉCNICA — Bloco E
-- ============================================================

-- Deve retornar jsonb com {events: [], year: 2026, month: 4}
SELECT get_agenda_month_bundle('00000000-0000-0000-0000-000000000000', 2026, 4);

-- ============================================================
-- ROLLBACK — Bloco E (executar se necessário)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.get_agenda_month_bundle(uuid, int, int) CASCADE;
