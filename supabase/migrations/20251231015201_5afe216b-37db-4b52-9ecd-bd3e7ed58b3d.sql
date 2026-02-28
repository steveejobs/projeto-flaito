-- Grant EXECUTE permission on lexos_assert_admin to authenticated users
GRANT EXECUTE ON FUNCTION public.lexos_assert_admin() TO authenticated;