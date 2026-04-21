-- Migration: Stage 8 — Observability & Visual Audit
-- Descrição: Consolida sinais de governança em views para visualização operacional.

-- 1. View: vw_session_timeline
-- Esta view centraliza todos os marcos importantes do ciclo de vida de uma sessão.
CREATE OR REPLACE VIEW public.vw_session_timeline AS
(
    -- 1.1 Início/Fim da Sessão (Audit Logs)
    SELECT 
        l.session_id,
        l.created_at as event_time,
        'lifecycle' as category,
        l.action as event_type,
        CASE 
            WHEN l.action = 'CREATE' THEN 'Sessão Iniciada'
            WHEN l.action = 'END_RECORDING' THEN 'Gravação Finalizada'
            ELSE l.action
        END as title,
        jsonb_build_object('performed_by', l.performed_by, 'metadata', l.metadata) as details,
        1 as importance
    FROM public.session_audit_logs l
    WHERE l.action IN ('CREATE', 'END_RECORDING', 'UPLOAD_COMPLETE')

    UNION ALL

    -- 1.2 Jobs de Processamento (Fila)
    SELECT 
        j.session_id,
        j.updated_at as event_time,
        'processing' as category,
        'JOB_' || j.status as event_type,
        CASE 
            WHEN j.status = 'queued' THEN 'Processamento na Fila: ' || j.job_type
            WHEN j.status = 'running' THEN 'Processando: ' || j.job_type
            WHEN j.status = 'succeeded' THEN 'Concluído: ' || j.job_type
            WHEN j.status = 'failed' THEN 'Falha no Processamento: ' || j.job_type
            WHEN j.status = 'dead_lettered' THEN 'Job Travado (DLQ): ' || j.job_type
            ELSE j.status::text
        END as title,
        jsonb_build_object('job_type', j.job_type, 'attempts', j.attempt_count, 'error', j.last_error) as details,
        CASE WHEN j.status IN ('failed', 'dead_lettered') THEN 3 ELSE 2 END as importance
    FROM public.session_jobs j

    UNION ALL

    -- 1.3 Inteligência (Legal/Medical Outputs)
    SELECT 
        lo.session_id,
        lo.created_at as event_time,
        'ai_legal' as category,
        'LEGAL_OUTPUT' as event_type,
        'Análise Jurídica Gerada' as title,
        jsonb_build_object('model', lo.model_used, 'summary', lo.summary) as details,
        2 as importance
    FROM public.legal_session_outputs lo

    UNION ALL

    SELECT 
        mo.session_id,
        mo.created_at as event_time,
        'ai_medical' as category,
        'MEDICAL_OUTPUT' as event_type,
        'Rascunho Médico Gerado' as title,
        jsonb_build_object('status', mo.status, 'model', mo.model_used) as details,
        2 as importance
    FROM public.medical_session_outputs mo

    UNION ALL

    -- 1.4 Revisão Humana
    SELECT 
        rl.session_id,
        rl.created_at as event_time,
        'human_review' as category,
        'REVIEW_' || rl.action_performed as event_type,
        CASE 
            WHEN rl.action_performed = 'APPROVE' THEN 'Laudo Aprovado por Médico'
            WHEN rl.action_performed = 'EDIT' THEN 'Laudo Editado p/ Revisão'
            ELSE rl.action_performed
        END as title,
        jsonb_build_object('reviewer_id', rl.reviewer_id, 'notes', rl.reviewer_notes) as details,
        2 as importance
    FROM public.medical_review_logs rl

    UNION ALL

    -- 1.5 Voz (Stage 7)
    SELECT 
        vl.session_id,
        vl.created_at as event_time,
        'voice' as category,
        vl.action_status as event_type,
        'Ação de Voz: ' || COALESCE(vl.intent, 'Interação') as title,
        jsonb_build_object('intent', vl.intent, 'mode', vl.mode_effective, 'confidence', vl.stt_confidence) as details,
        2 as importance
    FROM public.voice_agent_audit_logs vl
);

-- 2. View: vw_session_alerts
-- Centraliza riscos persistidos para exibição em Dashboards e Detalhes da Sessão.
CREATE OR REPLACE VIEW public.vw_session_alerts AS
(
    -- 2.1 Contradições Jurídicas
    SELECT 
        lo.session_id,
        'CONTRADICTION' as alert_type,
        'critical' as severity,
        'Contradição detectada entre oral e documentos.' as message,
        lo.contradictions_json as details,
        lo.created_at as detected_at
    FROM public.legal_session_outputs lo
    WHERE lo.contradictions_json IS NOT NULL AND jsonb_array_length(lo.contradictions_json) > 0

    UNION ALL

    -- 2.2 Insuficiência de Contexto
    SELECT 
        lo.session_id,
        'INSUFFICIENT_CONTEXT' as alert_type,
        'warning' as severity,
        'Contexto fraco para fundamentação jurídica.' as message,
        lo.evidence_gaps_json as details,
        lo.created_at as detected_at
    FROM public.legal_session_outputs lo
    WHERE lo.evidence_gaps_json IS NOT NULL AND jsonb_array_length(lo.evidence_gaps_json) > 0

    UNION ALL

    -- 2.3 Falhas de Infra (Jobs)
    SELECT 
        j.session_id,
        'JOB_FAILURE' as alert_type,
        CASE WHEN j.status = 'dead_lettered' THEN 'critical' ELSE 'warning' END as severity,
        'Job ' || j.job_type || ' falhou após ' || j.attempt_count || ' tentativas.' as message,
        jsonb_build_object('job_id', j.id, 'last_error', j.last_error) as details,
        j.updated_at as detected_at
    FROM public.session_jobs j
    WHERE j.status IN ('failed', 'dead_lettered')

    UNION ALL

    -- 2.4 Confirmações de Voz Expiradas (Stage 7)
    SELECT 
        vpa.session_id,
        'VOICE_EXPIRED' as alert_type,
        'warning' as severity,
        'Ação de voz "' || vpa.intent || '" expirou sem confirmação.' as message,
        jsonb_build_object('id', vpa.id, 'intent', vpa.intent) as details,
        vpa.expires_at as detected_at
    FROM public.voice_pending_actions vpa
    WHERE vpa.status = 'pending' AND vpa.expires_at < now()
);

-- 3. RLS para as Views
-- As views no Supabase (Postgres) respeitam o RLS das tabelas base por padrão se forem SECURITY INVOKER.
-- Adicionando comentários para documentação.
COMMENT ON VIEW public.vw_session_timeline IS 'Histórico unificado de eventos do ciclo de vida da sessão para auditoria visual.';
COMMENT ON VIEW public.vw_session_alerts IS 'Agregador de riscos e erros operacionais para monitoramento de saúde da sessão.';
