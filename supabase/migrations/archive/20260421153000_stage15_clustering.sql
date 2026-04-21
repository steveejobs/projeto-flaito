-- ============================================================
-- Migration: Stage 15 — Wave 4: Clustering & Automation
-- File: 20260421153000_stage15_clustering.sql
-- ============================================================

BEGIN;

-- 1. INCIDENT CLUSTERS TABLE
CREATE TABLE IF NOT EXISTS public.incident_clusters (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_key     TEXT        UNIQUE NOT NULL, -- deterministic signature
    
    title           TEXT        NOT NULL,
    root_cause_class TEXT,                        -- 'timeout', 'auth_failure', 'logic_gap', 'concurrency'
    subsystem       TEXT        NOT NULL,
    
    incident_count  INTEGER     NOT NULL DEFAULT 0,
    
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    metadata        JSONB       DEFAULT '{}'
);

-- RLS
ALTER TABLE public.incident_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_clusters" ON public.incident_clusters FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "admins_view_clusters" ON public.incident_clusters FOR SELECT USING (EXISTS (SELECT 1 FROM public.office_members WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')));

-- 2. AUTOMATIC CLUSTERING TRIGGER
-- When an incident is created, link or create a cluster.

CREATE OR REPLACE FUNCTION public.fn_cluster_production_incident()
RETURNS TRIGGER AS $$
DECLARE
    v_cluster_key TEXT;
    v_cluster_id  UUID;
BEGIN
    -- Only cluster if we have a subsystem and trigger_type
    IF NEW.subsystem IS NOT NULL AND NEW.trigger_type IS NOT NULL THEN
        
        -- Deterministic Key: signature + trigger + subsystem (hashed if long, but here we keep it readable)
        v_cluster_key := md5(COALESCE(NEW.error_signature, 'no_sig') || '|' || NEW.trigger_type || '|' || NEW.subsystem);
        
        -- Insert or sync cluster
        INSERT INTO public.incident_clusters (
            cluster_key, title, subsystem, incident_count, first_seen_at, last_seen_at
        ) VALUES (
            v_cluster_key, NEW.title, NEW.subsystem, 1, NEW.created_at, NEW.created_at
        )
        ON CONFLICT (cluster_key) DO UPDATE
        SET incident_count = incident_clusters.incident_count + 1,
            last_seen_at   = NEW.created_at,
            title          = CASE 
                               WHEN incident_clusters.incident_count > 10 THEN incident_clusters.title -- Keep original title if established
                               ELSE NEW.title 
                             END
        RETURNING id INTO v_cluster_id;

        -- Store linked cluster ID in source_metadata for easy access
        NEW.source_metadata := NEW.source_metadata || jsonb_build_object('cluster_id', v_cluster_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cluster_production_incident
    BEFORE INSERT ON public.production_incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cluster_production_incident();

-- 3. ANALYSIS RPCs
CREATE OR REPLACE FUNCTION public.detect_incident_regression_gaps()
RETURNS TABLE (
    cluster_id       UUID,
    cluster_title    TEXT,
    incident_count   INTEGER,
    last_seen_at     TIMESTAMPTZ,
    missing_test_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.title,
        c.incident_count,
        c.last_seen_at,
        c.incident_count as missing_test_count -- Simplified: all incidents in cluster lack a verified link
    FROM public.incident_clusters c
    WHERE NOT EXISTS (
        -- Check if ANY incident in this cluster has a verified regression link
        SELECT 1 
        FROM public.production_incidents i
        JOIN public.incident_regression_links rl ON rl.incident_id = i.id
        WHERE (i.source_metadata->>'cluster_id')::UUID = c.id
          AND rl.status = 'verified'
    )
    AND c.incident_count > 1
    ORDER BY c.incident_count DESC;
END;
$$;

COMMIT;
