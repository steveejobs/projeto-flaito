-- Migration: Update Unified Timeline with NIJA Events
-- Objetivo: Incluir eventos de análise inteligente do NIJA-MAESTRO na timeline global do cliente.
-- Nota: View simplificada para as tabelas existentes (cases, legal_documents, nija_pipeline_runs/reviews).

CREATE OR REPLACE VIEW public.unified_client_events AS
-- 1. Processos Jurídicos (Cases)
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

-- 2. Documentos Jurídicos (Petições/Arquivos)
SELECT 
    id,
    office_id,
    client_id,
    created_at as event_date,
    'legal' as module,
    'documento' as event_type,
    'Arquivo: ' || title as title,
    'completed' as status,
    jsonb_build_object(
        'type', type,
        'version', version,
        'case_id', case_id
    ) as metadata
FROM public.legal_documents

UNION ALL

-- 3. NIJA: Pipeline de IA (Execuções)
SELECT 
    id,
    office_id,
    NULL::uuid as client_id, -- Rastreamento via case_id
    started_at as event_date,
    'legal' as module,
    'nija_run' as event_type,
    'NIJA: Fluxo de Inteligência (' || current_stage || ')' as title,
    status,
    jsonb_build_object(
        'case_id', case_id,
        'stage', current_stage
    ) as metadata
FROM public.nija_pipeline_runs

UNION ALL

-- 4. NIJA: Auditoria de Peças (Reviews)
SELECT 
    nr.id,
    nr.office_id,
    NULL::uuid as client_id, -- Rastreamento via document_id
    nr.created_at as event_date,
    'legal' as module,
    'revisao' as event_type,
    'NIJA: Auditoria de Peça (Nota: ' || nr.quality_score || ')' as title,
    'completed' as status,
    jsonb_build_object(
        'document_id', nr.document_id,
        'score', nr.quality_score
    ) as metadata
FROM public.nija_reviews nr;

COMMENT ON VIEW public.unified_client_events IS 'Timeline Global do Cliente com Integração NIJA-MAESTRO (V2)';
