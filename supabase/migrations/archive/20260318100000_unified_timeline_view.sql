-- Migration: Unified Timeline View
-- Consolida eventos de múltiplos módulos para visualização 360 do cliente

CREATE OR REPLACE VIEW public.unified_client_events AS
-- 1. Consultas Médicas
SELECT 
    c.id,
    c.office_id,
    p.client_id,
    c.data_consulta as event_date,
    'medical' as module,
    'consulta' as event_type,
    'Consulta Clínica: ' || COALESCE(c.queixa_principal, 'Sem queixa registrada') as title,
    c.status,
    jsonb_build_object(
        'profissional_id', c.profissional_id,
        'paciente_id', p.id,
        'sintomas', c.sintomas
    ) as metadata
FROM public.consultas c
JOIN public.pacientes p ON c.paciente_id = p.id

UNION ALL

-- 2. Processos Jurídicos
SELECT 
    id,
    office_id,
    client_id,
    created_at as event_date,
    'legal' as module,
    'processo' as event_type,
    'Processo: ' || title as title,
    status,
    jsonb_build_object(
        'area', area,
        'cnj_number', cnj_number,
        'side', side
    ) as metadata
FROM public.cases
WHERE deleted_at IS NULL

UNION ALL

-- 3. Mensagens de WhatsApp (Notificações)
SELECT 
    nf.id,
    nf.office_id,
    COALESCE(p.client_id, cases.client_id) as client_id,
    nf.scheduled_at as event_date,
    'comm' as module,
    'whatsapp' as event_type,
    'Mensagem WhatsApp: ' || nf.mensagem as title,
    nf.status,
    jsonb_build_object(
        'destinatario', nf.destinatario_nome,
        'resource_type', nf.resource_type,
        'resource_id', nf.resource_id
    ) as metadata
FROM public.notificacoes_fila nf
LEFT JOIN public.consultas c ON nf.resource_type = 'CONSULTA' AND nf.resource_id = c.id
LEFT JOIN public.pacientes p ON c.paciente_id = p.id
LEFT JOIN public.cases ON nf.resource_type = 'CASE' AND nf.resource_id = cases.id
WHERE COALESCE(p.client_id, cases.client_id) IS NOT NULL

UNION ALL

-- 4. Análises de Íris (Iridologia)
SELECT 
    ia.id,
    ia.office_id,
    p.client_id,
    ia.created_at as event_date,
    'medical' as module,
    'analise_iris' as event_type,
    'Análise de Íris (' || ia.analysis_type || ')' as title,
    ia.status,
    jsonb_build_object(
        'ai_model', ia.ai_model,
        'findings_count', jsonb_array_length(ia.findings)
    ) as metadata
FROM public.iris_analyses ia
JOIN public.pacientes p ON ia.patient_id = p.id

UNION ALL

-- 5. Laudos Médicos
SELECT 
    mr.id,
    mr.office_id,
    p.client_id,
    mr.created_at as event_date,
    'medical' as module,
    'laudo' as event_type,
    'Laudo: ' || mr.title as title,
    mr.status,
    jsonb_build_object(
        'report_type', mr.report_type,
        'signed', (status = 'signed')
    ) as metadata
FROM public.medical_reports mr
JOIN public.pacientes p ON mr.patient_id = p.id;

-- RLS para a View (Supabase expõe views publicamente por padrão, precisamos filtrar)
-- Como é uma view simples, ela herda o contexto mas podemos forçar segurança se necessário
-- No Supabase, views herdam o RLS das tabelas base por padrão se forem SECURITY INVOKER (padrão do PSQL) ou se filtrarmos explicitamente.

COMMENT ON VIEW public.unified_client_events IS 'View agregadora para a Timeline Global do Cliente.';
