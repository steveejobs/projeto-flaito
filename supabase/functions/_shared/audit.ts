/**
 * audit.ts — Stage 10: Trust Boundary Hardening
 *
 * Unified audit logging with full execution context enrichment.
 * Every audit event now records WHO acted, UNDER WHAT CONTEXT, and WHY.
 *
 * Fields added in Stage 10:
 *   - execution_context: 'user' | 'worker' | 'operator' | 'system'
 *   - trigger_source: how the action was triggered
 *   - delegated_by: if the action is a controlled delegation
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { ExecutionContext, TriggerSource } from "./execution-context.ts";

export interface AuditEvent {
  // ── Who acted ────────────────────────────────────────────
  event_type: string;
  actor_user_id: string;
  actor_role?: string;

  // ── Trust Context (Stage 10) ─────────────────────────────
  execution_context?: ExecutionContext;
  trigger_source?: TriggerSource;
  delegated_by?: string;

  // ── Resource ─────────────────────────────────────────────
  patient_id?: string;
  resource_type?: string;
  resource_id?: string;
  action: string;
  office_id?: string;

  // ── Outcome ──────────────────────────────────────────────
  status?: "SUCCESS" | "DENIED" | "ERROR" | "BLOCKED_SAFETY";

  // ── Metadata ─────────────────────────────────────────────
  timestamp?: string;
  ip?: string;
  user_agent?: string;
  metadata_json?: Record<string, unknown>;
  details?: Record<string, unknown>;
  trace_id?: string;
}

/**
 * Registra um evento de auditoria no banco de dados com contexto de confiança completo.
 *
 * IMPORTANTE: Sempre passe execution_context para que o audit trail distinga
 * ações de usuário, worker, operador e sistema. Sem esse campo, o log
 * perde valor forense.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  event: AuditEvent
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      event_type:        event.event_type,
      user_id:           event.actor_user_id,
      actor_role:        event.actor_role,
      patient_id:        event.patient_id,
      entity_type:       event.resource_type,
      entity_id:         event.resource_id,
      action:            event.action,
      office_id:         event.office_id,
      timestamp:         event.timestamp || new Date().toISOString(),
      status:            event.status || "SUCCESS",
      details:           event.details || {},
      trace_id:          event.trace_id,
      ip:                event.ip || "Edge-Function",
      user_agent:        event.user_agent || "Deno-Runtime",
      // ── Stage 10: Trust Context Fields ──────────────────
      execution_context: event.execution_context ?? null,
      trigger_source:    event.trigger_source ?? null,
      delegated_by:      event.delegated_by ?? null,
      // ── Merged metadata ─────────────────────────────────
      metadata_json: {
        ...event.metadata_json,
        execution_context: event.execution_context,
        trigger_source:    event.trigger_source,
      },
    });

    if (error) {
      console.error(`[AUDIT-ERROR] [${event.event_type}]:`, error.message);
    }
  } catch (err) {
    console.error(`[AUDIT-EXCEPTION] [${event.event_type}]:`, err);
  }
}
