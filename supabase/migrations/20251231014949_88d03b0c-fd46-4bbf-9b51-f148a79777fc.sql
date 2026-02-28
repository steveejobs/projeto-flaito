-- Grant EXECUTE permission on admin maintenance functions to authenticated users
GRANT EXECUTE ON FUNCTION public.lexos_get_cron_jobs_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_get_db_connection_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lexos_get_top_queries() TO authenticated;