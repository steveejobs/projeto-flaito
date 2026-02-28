-- Create a worker state table for robust locking
CREATE TABLE IF NOT EXISTS public.worker_state (
  id TEXT PRIMARY KEY DEFAULT 'precedents-worker',
  locked_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  locked_by TEXT
);

-- Insert default row if not exists
INSERT INTO public.worker_state (id, locked_at, locked_until, locked_by)
VALUES ('precedents-worker', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.worker_state ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage worker state"
ON public.worker_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Drop old functions
DROP FUNCTION IF EXISTS public.worker_lock_try();
DROP FUNCTION IF EXISTS public.worker_lock_release();

-- New worker_lock_try using table-based locking with timeout
CREATE OR REPLACE FUNCTION public.worker_lock_try(p_lock_duration_seconds INT DEFAULT 120)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Try to acquire lock: either it's not locked, or lock has expired
  UPDATE worker_state
  SET locked_at = v_now,
      locked_until = v_now + (p_lock_duration_seconds || ' seconds')::INTERVAL,
      locked_by = gen_random_uuid()::TEXT
  WHERE id = 'precedents-worker'
    AND (locked_until IS NULL OR locked_until < v_now);
  
  RETURN FOUND;
END;
$$;

-- New worker_lock_release
CREATE OR REPLACE FUNCTION public.worker_lock_release()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE worker_state
  SET locked_at = NULL,
      locked_until = NULL,
      locked_by = NULL
  WHERE id = 'precedents-worker';
END;
$$;