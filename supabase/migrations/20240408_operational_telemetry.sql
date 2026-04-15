-- 
-- FASE 24: MONITORAMENTO E AUTO-RECUPERAÇÃO
-- 

-- 1. Ampliação da Tabela de Saúde com Telemetria
ALTER TABLE service_health 
ADD COLUMN IF NOT EXISTS total_calls BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_errors BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_timeouts BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_latency_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failure_reason TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Tabela de Auditoria de Reconciliação Automática
CREATE TABLE IF NOT EXISTS operational_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    domain TEXT NOT NULL, -- 'billing', 'notifications', 'documents'
    resource_id TEXT NOT NULL, -- ID do pagamento, documento, etc
    initial_state TEXT NOT NULL,
    final_state TEXT NOT NULL,
    resolution_status TEXT NOT NULL, -- 'FIXED', 'FAILED', 'NO_ACTION'
    external_provider_response JSONB,
    correlation_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Habilitar RLS
ALTER TABLE operational_reconciliations ENABLE ROW LEVEL SECURITY;

-- Política de visualização para admins
CREATE POLICY "Admins can view operational reconciliations" 
ON operational_reconciliations FOR SELECT 
TO authenticated 
USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ADMIN', 'OWNER')
));

-- 3. View Consolidada para Dashboard Operacional
CREATE OR REPLACE VIEW v_operational_dashboard AS
SELECT 
    service_name,
    state,
    total_calls,
    total_errors,
    total_timeouts,
    avg_latency_ms,
    last_failure_reason,
    last_failure_at,
    (total_errors::float / NULLIF(total_calls, 0) * 100)::numeric(5,2) as error_rate_percent,
    (total_timeouts::float / NULLIF(total_calls, 0) * 100)::numeric(5,2) as timeout_rate_percent
FROM service_health;

-- 4. Funções auxiliares para contadores (atômicos)
CREATE OR REPLACE FUNCTION increment_service_telemetry(
    target_service TEXT,
    is_error BOOLEAN,
    is_timeout BOOLEAN,
    latency_ms INTEGER,
    failure_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE service_health
    SET 
        total_calls = total_calls + 1,
        total_errors = total_errors + (CASE WHEN is_error THEN 1 ELSE 0 END),
        total_timeouts = total_timeouts + (CASE WHEN is_timeout THEN 1 ELSE 0 END),
        avg_latency_ms = (avg_latency_ms * total_calls + latency_ms) / (total_calls + 1),
        last_failure_reason = CASE WHEN failure_reason IS NOT NULL THEN failure_reason ELSE last_failure_reason END,
        updated_at = now()
    WHERE service_name = target_service;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
