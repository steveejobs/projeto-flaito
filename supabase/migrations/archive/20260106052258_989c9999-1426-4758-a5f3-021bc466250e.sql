-- Fix timeline auth.users dependency by using a SECURITY DEFINER function
-- Must DROP views first due to column type change (varchar(255) -> text)

-- 1. Create SECURITY DEFINER function to safely get user email from auth.users
-- Cast to varchar(255) to match original column type
CREATE OR REPLACE FUNCTION public.get_auth_user_email(p_user_id uuid)
RETURNS varchar(255)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT email FROM auth.users WHERE id = p_user_id;
$$;

-- 2. Grant execute permission to authenticated role
GRANT EXECUTE ON FUNCTION public.get_auth_user_email(uuid) TO authenticated;

-- 3. Drop dependent views first (order matters: plus depends on timeline)
DROP VIEW IF EXISTS public.vw_lexos_timeline_plus;
DROP VIEW IF EXISTS public.vw_lexos_timeline;

-- 4. Recreate vw_lexos_timeline using the function instead of direct auth.users join
CREATE VIEW public.vw_lexos_timeline AS
SELECT (l.id)::text AS log_id,
    'CASE_STAGE'::text AS kind,
    'CASE_STAGE'::text AS item_type,
    c.client_id,
    l.case_id,
    c.title AS case_title,
    NULL::uuid AS document_id,
    NULL::uuid AS generated_doc_id,
    l.old_stage AS old_status,
    l.new_stage AS new_status,
    l.changed_at,
    l.changed_by,
    public.get_auth_user_email(l.changed_by) AS changed_by_email
   FROM case_stage_logs l
     JOIN cases c ON c.id = l.case_id
UNION ALL
 SELECT (l.id)::text AS log_id,
    'CASE'::text AS kind,
    'CASE'::text AS item_type,
    c.client_id,
    l.case_id,
    c.title AS case_title,
    NULL::uuid AS document_id,
    NULL::uuid AS generated_doc_id,
    l.old_status,
    l.new_status,
    l.changed_at,
    l.changed_by,
    public.get_auth_user_email(l.changed_by) AS changed_by_email
   FROM case_status_logs l
     JOIN cases c ON c.id = l.case_id
UNION ALL
 SELECT (l.id)::text AS log_id,
    'DOCUMENT'::text AS kind,
    'DOCUMENT'::text AS item_type,
    c.client_id,
    d.case_id,
    c.title AS case_title,
    l.document_id,
    NULL::uuid AS generated_doc_id,
    l.old_status,
    l.new_status,
    l.changed_at,
    l.changed_by,
    public.get_auth_user_email(l.changed_by) AS changed_by_email
   FROM document_status_logs l
     JOIN documents d ON d.id = l.document_id
     LEFT JOIN cases c ON c.id = d.case_id
UNION ALL
 SELECT (l.id)::text AS log_id,
    'GENERATED_DOC'::text AS kind,
    'GENERATED_DOC'::text AS item_type,
    c.client_id,
    g.case_id,
    c.title AS case_title,
    NULL::uuid AS document_id,
    l.generated_doc_id,
    l.old_status,
    l.new_status,
    l.changed_at,
    l.changed_by,
    public.get_auth_user_email(l.changed_by) AS changed_by_email
   FROM document_status_logs l
     JOIN generated_docs_legacy g ON g.id = l.generated_doc_id
     LEFT JOIN cases c ON c.id = g.case_id;

-- 5. Recreate vw_lexos_timeline_plus
CREATE VIEW public.vw_lexos_timeline_plus AS
SELECT vw_lexos_timeline.log_id,
    vw_lexos_timeline.kind,
    vw_lexos_timeline.item_type,
    (vw_lexos_timeline.client_id)::text AS client_id,
    (vw_lexos_timeline.case_id)::text AS case_id,
    vw_lexos_timeline.case_title,
    (vw_lexos_timeline.document_id)::text AS document_id,
    (vw_lexos_timeline.generated_doc_id)::text AS generated_doc_id,
    vw_lexos_timeline.old_status,
    vw_lexos_timeline.new_status,
    (vw_lexos_timeline.changed_at)::text AS changed_at,
    (vw_lexos_timeline.changed_by)::text AS changed_by,
    (vw_lexos_timeline.changed_by_email)::text AS changed_by_email
   FROM vw_lexos_timeline
UNION ALL
 SELECT (ce.id)::text AS log_id,
    'CLIENT'::text AS kind,
    'CLIENT'::text AS item_type,
    (ce.client_id)::text AS client_id,
    NULL::text AS case_id,
    NULL::text AS case_title,
    NULL::text AS document_id,
    NULL::text AS generated_doc_id,
    ce.old_status,
    COALESCE(ce.new_status, ce.event_type) AS new_status,
    (ce.changed_at)::text AS changed_at,
    (ce.changed_by)::text AS changed_by,
    ce.changed_by_email
   FROM client_events ce;

-- 6. Ensure grants are in place
GRANT SELECT ON public.vw_lexos_timeline TO authenticated;
GRANT SELECT ON public.vw_lexos_timeline_plus TO authenticated;