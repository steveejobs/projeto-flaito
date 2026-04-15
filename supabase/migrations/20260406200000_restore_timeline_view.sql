-- Migration: Restore Unified Timeline View
-- Restore the central view used by the frontend for the global timeline

CREATE OR REPLACE VIEW public.unified_client_events AS
-- 1. Processos Jurídicos (Cases)
SELECT 
    id,
    office_id,
    client_id,
    created_at as event_date,
    'legal'::text as module,
    'processo'::text as event_type,
    ('Processo: ' || title) as title,
    status,
    jsonb_build_object(
        'area', area,
        'cnj_number', cnj_number,
        'side', side
    ) as metadata
FROM public.cases
WHERE deleted_at IS NULL

UNION ALL

-- 2. Documentos Jurídicos (Petições/Arquivos)
SELECT 
    id,
    office_id,
    client_id,
    created_at as event_date,
    'legal'::text as module,
    'documento'::text as event_type,
    ('Arquivo: ' || title) as title,
    'completed'::text as status,
    jsonb_build_object(
        'type', type,
        'version', version,
        'case_id', case_id
    ) as metadata
FROM public.legal_documents

UNION ALL

-- 3. NIJA: Pipeline de IA (Execuções)
SELECT 
    nr.id,
    nr.office_id,
    c.client_id, -- Tentar pegar o client_id via case para ser visível na timeline do cliente
    nr.started_at as event_date,
    'legal'::text as module,
    'nija_run'::text as event_type,
    ('NIJA: Fluxo de Inteligência (' || nr.current_stage || ')') as title,
    nr.status,
    jsonb_build_object(
        'case_id', nr.case_id,
        'stage', nr.current_stage
    ) as metadata
FROM public.nija_pipeline_runs nr
JOIN public.cases c ON c.id = nr.case_id

UNION ALL

-- 4. NIJA: Auditoria de Peças (Reviews)
SELECT 
    rev.id,
    rev.office_id,
    ld.client_id, -- Tentar pegar o client_id via legal_document
    rev.created_at as event_date,
    'legal'::text as module,
    'revisao'::text as event_type,
    ('NIJA: Auditoria de Peça (Nota: ' || rev.quality_score || ')') as title,
    'completed'::text as status,
    jsonb_build_object(
        'document_id', rev.document_id,
        'score', rev.quality_score
    ) as metadata
FROM public.nija_reviews rev
JOIN public.legal_documents ld ON ld.id = rev.document_id;

COMMENT ON VIEW public.unified_client_events IS 'Timeline Global do Cliente com Integração NIJA-MAESTRO (V2)';
