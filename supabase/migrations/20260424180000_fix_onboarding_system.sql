-- Migration: 20260424180000_fix_onboarding_system.sql
-- Goal: Restore the critical onboarding flow logic and infrastructure

-- 1. Ensure Table Exists
CREATE TABLE IF NOT EXISTS public.office_onboarding_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    step_key text NOT NULL,
    completed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(office_id, step_key)
);

-- 2. Row Level Security
ALTER TABLE public.office_onboarding_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem ver passos do escritório" ON public.office_onboarding_steps;
CREATE POLICY "Membros podem ver passos do escritório"
ON public.office_onboarding_steps
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.office_members om
        WHERE om.office_id = office_onboarding_steps.office_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
);

DROP POLICY IF EXISTS "Admins podem atualizar passos" ON public.office_onboarding_steps;
CREATE POLICY "Admins podem atualizar passos"
ON public.office_onboarding_steps
FOR UPDATE
TO authenticated
USING (
    public.is_office_admin(office_id)
)
WITH CHECK (
    public.is_office_admin(office_id)
);

-- 3. Initialize Function
CREATE OR REPLACE FUNCTION public.init_office_onboarding_steps(p_office_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.office_onboarding_steps (office_id, step_key, completed)
    VALUES 
        (p_office_id, 'institutional_config', false),
        (p_office_id, 'office_info', false),
        (p_office_id, 'first_client', false),
        (p_office_id, 'first_case', false),
        (p_office_id, 'first_template', false)
    ON CONFLICT (office_id, step_key) DO NOTHING;
END;
$$;

-- 4. Status Retrieval Function
CREATE OR REPLACE FUNCTION public.get_office_onboarding_status()
RETURNS TABLE(step_key text, completed boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT step_key, completed
    FROM public.office_onboarding_steps
    WHERE office_id = public.get_active_office_for_user()
    ORDER BY step_key;
$$;

-- 5. Completion Function (The missing piece)
CREATE OR REPLACE FUNCTION public.complete_onboarding_step(p_step text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_office_id uuid;
BEGIN
    v_office_id := public.get_active_office_for_user();
    
    IF v_office_id IS NULL THEN
        RAISE EXCEPTION 'Usuário sem escritório ativo.';
    END IF;

    UPDATE public.office_onboarding_steps
    SET 
        completed = true,
        updated_at = now()
    WHERE office_id = v_office_id
    AND step_key = p_step;
END;
$$;

-- 6. Permissions
GRANT EXECUTE ON FUNCTION public.get_office_onboarding_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_step(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.init_office_onboarding_steps(uuid) TO authenticated;

-- 7. Seed Existing Offices
-- Garantir que todos os escritórios atuais tenham seus passos inicializados
SELECT public.init_office_onboarding_steps(id) FROM public.offices;
