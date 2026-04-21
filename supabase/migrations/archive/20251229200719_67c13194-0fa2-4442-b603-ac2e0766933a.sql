-- Grant SELECT permission on the view to authenticated users
GRANT SELECT ON public.vw_client_kit_latest_files TO authenticated;

-- Also grant on the vw_client_files view if not already granted
GRANT SELECT ON public.vw_client_files TO authenticated;