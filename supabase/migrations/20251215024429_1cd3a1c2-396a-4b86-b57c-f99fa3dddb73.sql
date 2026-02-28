-- Add NIJA usage tracking columns to offices table
ALTER TABLE public.offices
ADD COLUMN IF NOT EXISTS nija_runs_monthly integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS nija_limit_monthly integer NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS nija_runs_reset_at timestamp with time zone NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month';

-- Create function to increment NIJA counter and auto-reset if new month
CREATE OR REPLACE FUNCTION public.increment_nija_counter(p_office_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_count integer;
  v_limit integer;
  v_reset_at timestamptz;
BEGIN
  -- Get current values
  SELECT nija_runs_monthly, nija_limit_monthly, nija_runs_reset_at
  INTO v_current_count, v_limit, v_reset_at
  FROM public.offices
  WHERE id = p_office_id;

  -- Check if we need to reset (new month)
  IF now() >= v_reset_at THEN
    UPDATE public.offices
    SET 
      nija_runs_monthly = 1,
      nija_runs_reset_at = date_trunc('month', now()) + interval '1 month'
    WHERE id = p_office_id
    RETURNING nija_runs_monthly, nija_limit_monthly INTO v_current_count, v_limit;
  ELSE
    -- Increment counter
    UPDATE public.offices
    SET nija_runs_monthly = nija_runs_monthly + 1
    WHERE id = p_office_id
    RETURNING nija_runs_monthly INTO v_current_count;
  END IF;

  RETURN jsonb_build_object(
    'current', v_current_count,
    'limit', v_limit,
    'percentage', ROUND((v_current_count::numeric / NULLIF(v_limit, 0)::numeric) * 100, 1)
  );
END;
$$;

-- Create function to get current NIJA usage stats
CREATE OR REPLACE FUNCTION public.get_nija_usage(p_office_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_count integer;
  v_limit integer;
  v_reset_at timestamptz;
BEGIN
  SELECT nija_runs_monthly, nija_limit_monthly, nija_runs_reset_at
  INTO v_current_count, v_limit, v_reset_at
  FROM public.offices
  WHERE id = p_office_id;

  -- If reset time has passed, return 0 (will be reset on next increment)
  IF now() >= v_reset_at THEN
    v_current_count := 0;
  END IF;

  RETURN jsonb_build_object(
    'current', COALESCE(v_current_count, 0),
    'limit', COALESCE(v_limit, 100),
    'percentage', ROUND((COALESCE(v_current_count, 0)::numeric / NULLIF(COALESCE(v_limit, 100), 0)::numeric) * 100, 1)
  );
END;
$$;