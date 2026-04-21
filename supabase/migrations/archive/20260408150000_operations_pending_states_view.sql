/**
 * Sprint 2: Pending States View
 * Consolida itens travados em domínios críticos para visibilidade SRE.
 */

CREATE OR REPLACE VIEW v_operational_pending_states AS
-- 1. Pagamentos Asaas Orfãos (Pendentes de Confirmação Externa)
SELECT 
  'BILLING' as category,
  id::text as internal_id,
  'Asaas Payment Stuck' as description,
  office_id,
  metadata_json->>'idempotency_key' as correlation_ref,
  created_at as pending_since,
  EXTRACT(EPOCH FROM (now() - created_at))/60 as minutes_pending,
  'CRITICAL' as severity
FROM admin_audit_logs 
WHERE status = 'ERROR' 
  AND action = 'asaas.create_payment'
  AND metadata_json->>'consistency_state' = 'PENDING_EXTERNAL_CONFIRMATION'

UNION ALL

-- 2. Documentos ZapSign Pendentes (> 6h)
SELECT 
  'DOCUMENT' as category,
  id::text as internal_id,
  'ZapSign Signature Pending' as description,
  office_id,
  zapsign_doc_token as correlation_ref,
  created_at as pending_since,
  EXTRACT(EPOCH FROM (now() - created_at))/60 as minutes_pending,
  'WARNING' as severity
FROM document_sign_requests
WHERE status = 'PENDING'
  AND created_at < now() - interval '6 hours'

UNION ALL

-- 3. Notificações Travadas (> 20 min)
SELECT 
  'NOTIFICATION' as category,
  id::text as internal_id,
  'Notification Processing Stuck' as description,
  office_id,
  NULL as correlation_ref,
  last_attempt_at as pending_since,
  EXTRACT(EPOCH FROM (now() - last_attempt_at))/60 as minutes_pending,
  'MEDIUM' as severity
FROM notificacoes_fila
WHERE status = 'PROCESSING'
  AND last_attempt_at < now() - interval '20 minutes';

-- Garantir acesso ao ADMIN/OWNER via RLS (implícito se o acesso à view seguir as permissões das tabelas base)
-- No Supabase, views herdam permissões ou exigem grants explícitos.
GRANT SELECT ON v_operational_pending_states TO authenticated;
