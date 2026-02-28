-- Disable only user triggers (not system triggers)
ALTER TABLE public.case_permissions DISABLE TRIGGER USER;

-- Populate owner permissions for all existing cases
INSERT INTO public.case_permissions (case_id, user_id, role)
SELECT id, created_by, 'owner'
FROM public.cases
WHERE created_by IS NOT NULL
ON CONFLICT (case_id, user_id) DO NOTHING;

-- Re-enable user triggers
ALTER TABLE public.case_permissions ENABLE TRIGGER USER;