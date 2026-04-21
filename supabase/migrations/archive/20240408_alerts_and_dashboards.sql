-- 
-- FASE 24: DASHBOARDS E ALERTAS AVANÇADOS
-- 

-- 1. Métricas de Janela Deslizante (Simuladas por agregação de logs de auditoria)
-- Nota: Admin_audit_logs é nossa fonte de verdade para eventos históricos
CREATE OR REPLACE VIEW v_operational_alerts AS
SELECT 
    service_name,
    COUNT(*) FILTER (WHERE status = 'ERROR' AND created_at > now() - interval '1 hour') as errors_last_hour,
    COUNT(*) FILTER (WHERE status = 'SUCCESS' AND created_at > now() - interval '1 hour') as success_last_hour,
    AVG(duration_ms) FILTER (WHERE created_at > now() - interval '1 hour') as avg_latency_1h,
    (SELECT state FROM service_health sh WHERE sh.service_name = t.service_name) as current_circuit_state
FROM (
    -- Unificando logs para métrica (exemplo simplificado)
    SELECT 
        metadata_json->>'serviceName' as service_name,
        status,
        (metadata_json->>'duration_ms')::integer as duration_ms,
        created_at
    FROM admin_audit_logs
    WHERE event_type = 'external_integration'
) t
GROUP BY service_name;

-- 2. Alerta de Incidentes Ativos
CREATE OR REPLACE VIEW v_active_incidents AS
SELECT 
    service_name,
    'CIRCUIT_OPEN' as incident_type,
    'Crítico: Circuito aberto para ' || service_name || '. Falhas excederam o limite.' as message,
    last_failure_at as started_at
FROM service_health
WHERE status = 'OPEN'
UNION ALL
SELECT 
    domain as service_name,
    'PENDING_RECONCILIATION' as incident_type,
    count(*) || ' itens aguardando reconciliação em ' || domain as message,
    min(created_at) as started_at
FROM operational_reconciliations
WHERE resolution_status = 'FAILED'
GROUP BY domain;

-- 3. Função para Alerta Instantâneo (Hook para ser chamado pelo Adapter ou Reconciler)
CREATE OR REPLACE FUNCTION trigger_operational_alert(
    p_service TEXT,
    p_severity TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    -- Aqui poderíamos disparar um HTTP Hook para Slack/Discord
    -- Por enquanto, registramos em uma tabela de notificações do sistema
    INSERT INTO admin_notifications (
        title,
        message,
        severity,
        metadata,
        is_read
    ) VALUES (
        'Alerta SRE: ' || p_service,
        p_message,
        p_severity,
        p_metadata,
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
