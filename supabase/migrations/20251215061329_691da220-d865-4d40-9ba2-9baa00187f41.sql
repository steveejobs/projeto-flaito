-- Create get_video_chapters RPC function using actual column names
CREATE OR REPLACE FUNCTION public.get_video_chapters(p_video_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  start_seconds integer,
  end_seconds integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT vc.id, vc.resumo as title, vc.inicio_seconds as start_seconds, vc.fim_seconds as end_seconds
  FROM public.video_chapters vc
  WHERE vc.video_id = p_video_id
  ORDER BY vc.inicio_seconds ASC;
$func$;