-- =============================================
-- PLAUD INTEGRATION: Full idempotent migration
-- =============================================

-- 1. Create office_integrations table for storing integration configs
CREATE TABLE IF NOT EXISTS public.office_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(office_id, integration_key)
);

-- RLS: apenas ADMIN/OWNER podem acessar
ALTER TABLE public.office_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS office_integrations_admin_access ON public.office_integrations;
CREATE POLICY office_integrations_admin_access ON public.office_integrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM office_members m
      WHERE m.office_id = office_integrations.office_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role IN ('ADMIN', 'OWNER')
    )
  );

-- 2. Add missing columns to plaud_assets
ALTER TABLE public.plaud_assets 
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS duration integer,
  ADD COLUMN IF NOT EXISTS received_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at_source timestamptz;

-- 3. Drop old constraint and create new UNIQUE on (office_id, external_id)
DROP INDEX IF EXISTS ux_plaud_assets_external_id;
DROP INDEX IF EXISTS ux_plaud_assets_office_external;
CREATE UNIQUE INDEX ux_plaud_assets_office_external 
  ON public.plaud_assets (office_id, external_id);

-- 4. Create optimized indexes
CREATE INDEX IF NOT EXISTS ix_plaud_assets_office_received 
  ON public.plaud_assets (office_id, received_at DESC);

DROP INDEX IF EXISTS ix_plaud_assets_case_received;
CREATE INDEX ix_plaud_assets_case_received 
  ON public.plaud_assets (case_id, received_at DESC) 
  WHERE case_id IS NOT NULL;

-- 5. Create plaud_analysis_jobs table (queue for AI processing)
CREATE TABLE IF NOT EXISTS public.plaud_analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  plaud_asset_id uuid NOT NULL REFERENCES public.plaud_assets(id) ON DELETE CASCADE,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  error text,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE(plaud_asset_id)
);

CREATE INDEX IF NOT EXISTS ix_plaud_jobs_status 
  ON public.plaud_analysis_jobs (status, created_at);

-- RLS: leitura por membros do office
ALTER TABLE public.plaud_analysis_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plaud_jobs_read ON public.plaud_analysis_jobs;
CREATE POLICY plaud_jobs_read ON public.plaud_analysis_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM office_members m
      WHERE m.office_id = plaud_analysis_jobs.office_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

-- 6. Create plaud_asset_analysis table for NIJA results
CREATE TABLE IF NOT EXISTS public.plaud_asset_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plaud_asset_id uuid NOT NULL REFERENCES public.plaud_assets(id) ON DELETE CASCADE,
  analysis jsonb NOT NULL DEFAULT '{}',
  model_used text,
  tokens_used integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plaud_asset_id)
);

ALTER TABLE public.plaud_asset_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plaud_analysis_read ON public.plaud_asset_analysis;
CREATE POLICY plaud_analysis_read ON public.plaud_asset_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plaud_assets pa
      JOIN office_members m ON m.office_id = pa.office_id
      WHERE pa.id = plaud_asset_analysis.plaud_asset_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

-- 7. Create trigger function to enqueue AI analysis jobs
CREATE OR REPLACE FUNCTION fn_enqueue_plaud_analysis()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enqueue if transcript is not empty (at least 50 chars)
  IF NEW.transcript IS NOT NULL AND length(trim(NEW.transcript)) > 50 THEN
    INSERT INTO plaud_analysis_jobs (office_id, case_id, plaud_asset_id)
    VALUES (NEW.office_id, NEW.case_id, NEW.id)
    ON CONFLICT (plaud_asset_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger on plaud_assets
DROP TRIGGER IF EXISTS trg_enqueue_plaud_analysis ON plaud_assets;
CREATE TRIGGER trg_enqueue_plaud_analysis
  AFTER INSERT ON plaud_assets
  FOR EACH ROW EXECUTE FUNCTION fn_enqueue_plaud_analysis();

-- 9. Enable Realtime for plaud_assets
ALTER TABLE public.plaud_assets REPLICA IDENTITY FULL;

-- 10. Add plaud_assets to realtime publication if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'plaud_assets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE plaud_assets;
  END IF;
END $$;

-- 11. Policy for UPDATE case_id on plaud_assets
DROP POLICY IF EXISTS plaud_assets_update_case ON public.plaud_assets;
CREATE POLICY plaud_assets_update_case ON public.plaud_assets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM office_members m
      WHERE m.office_id = plaud_assets.office_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );