/**
 * execution-context.ts — Stage 10: Trust Boundary Hardening
 *
 * Defines and enforces the formal trust model for all execution paths.
 *
 * Trust hierarchy:
 *   user      → authenticated JWT caller, RLS-scoped
 *   worker    → internal processor, secret-authenticated, job-scoped
 *   operator  → authenticated JWT + OWNER/ADMIN role, backend-gated
 *   system    → DB triggers, cron, internal reconcilers
 *
 * NEVER use this module to bypass authorization gates.
 * Use it to RECORD AND VALIDATE trust boundaries, not to skip them.
 */

// ============================================================
// TYPES
// ============================================================

export type ExecutionContext = "user" | "worker" | "operator" | "system";

export type TriggerSource =
  | "http_user"         // Browser/mobile client with user JWT
  | "http_worker"       // Internal worker invocation with worker secret
  | "http_operator"     // Backend admin tool with operator JWT + role
  | "cron"              // Scheduled job (pg_cron or external)
  | "db_trigger"        // PostgreSQL trigger
  | "delegated_storage_write"; // Elevated write after RLS ownership validation

export interface TrustContext {
  /** Primary context classification */
  execution_context: ExecutionContext;
  /** user_id, worker_id, or system identifier */
  actor_id: string | null;
  /** OWNER | ADMIN | MEMBER | worker | system */
  actor_role: string | null;
  /** Office scope for multi-tenant isolation */
  office_id: string | null;
  /** How this execution was triggered */
  trigger_source: TriggerSource;
  /** If this action delegates from another actor (e.g., user triggers worker) */
  delegated_by?: string;
  /** Correlation ID for log tracing */
  trace_id: string;
  /** When this context was established */
  established_at: string;
}

// ============================================================
// CONTEXT BUILDERS
// ============================================================

/**
 * Build a user-scoped trust context from authenticated JWT claims.
 * Use when processing any user-originated HTTP request.
 */
export function buildUserContext(
  userId: string,
  role: string,
  officeId: string,
  traceId?: string
): TrustContext {
  return {
    execution_context: "user",
    actor_id: userId,
    actor_role: role,
    office_id: officeId,
    trigger_source: "http_user",
    trace_id: traceId ?? crypto.randomUUID(),
    established_at: new Date().toISOString(),
  };
}

/**
 * Build a worker-scoped trust context from a claimed job.
 * Use only inside worker-secret-authenticated paths.
 */
export function buildWorkerContext(
  workerId: string,
  officeId: string,
  delegatedFromUserId?: string,
  traceId?: string
): TrustContext {
  return {
    execution_context: "worker",
    actor_id: workerId,
    actor_role: "worker",
    office_id: officeId,
    trigger_source: "http_worker",
    delegated_by: delegatedFromUserId,
    trace_id: traceId ?? crypto.randomUUID(),
    established_at: new Date().toISOString(),
  };
}

/**
 * Build an operator-scoped trust context from backend-validated admin JWT.
 * Use only after role OWNER/ADMIN is verified server-side.
 */
export function buildOperatorContext(
  userId: string,
  role: "OWNER" | "ADMIN",
  officeId: string,
  traceId?: string
): TrustContext {
  return {
    execution_context: "operator",
    actor_id: userId,
    actor_role: role,
    office_id: officeId,
    trigger_source: "http_operator",
    trace_id: traceId ?? crypto.randomUUID(),
    established_at: new Date().toISOString(),
  };
}

/**
 * Build a system-level trust context for cron / db triggers / reconcilers.
 * Must NEVER be used for user-originated logic.
 */
export function buildSystemContext(
  triggeredBy: string,
  source: "cron" | "db_trigger" = "cron",
  traceId?: string
): TrustContext {
  return {
    execution_context: "system",
    actor_id: null,
    actor_role: "system",
    office_id: null,
    trigger_source: source,
    delegated_by: triggeredBy,
    trace_id: traceId ?? crypto.randomUUID(),
    established_at: new Date().toISOString(),
  };
}

/**
 * Build a delegated storage write context.
 * Use when a user action requires elevated storage credentials
 * but ownership has been validated server-side first.
 *
 * CONTRACT:
 *   - assertSessionOwnership() or equivalent MUST be called before this
 *   - The storage path MUST be validated against office/session ownership
 *   - This context MUST be logged via logExecutionContext() immediately
 */
export function buildDelegatedStorageContext(
  userId: string,
  officeId: string,
  validatedOwnershipSessionId: string,
  traceId?: string
): TrustContext {
  return {
    execution_context: "user",
    actor_id: userId,
    actor_role: "user_delegated_storage",
    office_id: officeId,
    trigger_source: "delegated_storage_write",
    delegated_by: `validated_session:${validatedOwnershipSessionId}`,
    trace_id: traceId ?? crypto.randomUUID(),
    established_at: new Date().toISOString(),
  };
}

// ============================================================
// WORKER AUTHENTICATION
// ============================================================

export interface WorkerAuthResult {
  ok: boolean;
  error?: string;
  /** Reason code for rejection */
  code?: "MISSING_WORKER_SECRET" | "INVALID_WORKER_SECRET" | "USER_JWT_ON_WORKER_ROUTE" | "REPLAY_DETECTED" | "TIMESTAMP_EXPIRED";
  worker_id?: string;
}

/**
 * Authenticate a worker request.
 *
 * Security model:
 *   1. x-worker-secret must be present and match WORKER_INTERNAL_SECRET env var
 *   2. Authorization JWT header is REJECTED on worker-only routes
 *      (prevents user impersonation of internal worker paths)
 *   3. x-worker-timestamp must be within ±5 minutes (anti-replay)
 *   4. x-worker-id is extracted for audit purposes
 *
 * IMPORTANT: If WORKER_INTERNAL_SECRET is not configured, ALL worker calls fail.
 * This is intentional fail-closed behavior.
 */
export function authenticateWorkerRequest(req: Request): WorkerAuthResult {
  const workerSecret = Deno.env.get("WORKER_INTERNAL_SECRET");

  // Fail closed: if the secret isn't configured, nothing works
  if (!workerSecret) {
    console.error("[execution-context] WORKER_INTERNAL_SECRET not configured — failing closed");
    return { ok: false, error: "Worker authentication not configured", code: "MISSING_WORKER_SECRET" };
  }

  // CRITICAL: Reject any request that also carries a user JWT
  // This prevents a user from calling worker-only paths by adding a worker secret header
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      error: "WORKER_IMPERSONATION_FORBIDDEN: Worker-only action cannot be called with a user Authorization header",
      code: "USER_JWT_ON_WORKER_ROUTE",
    };
  }

  // Validate worker secret
  const providedSecret = req.headers.get("x-worker-secret");
  if (!providedSecret) {
    return { ok: false, error: "Missing x-worker-secret header", code: "MISSING_WORKER_SECRET" };
  }

  if (providedSecret !== workerSecret) {
    return { ok: false, error: "Invalid worker secret", code: "INVALID_WORKER_SECRET" };
  }

  // Anti-replay: validate timestamp within ±5 minutes
  const timestampHeader = req.headers.get("x-worker-timestamp");
  if (timestampHeader) {
    const ts = parseInt(timestampHeader, 10);
    const now = Date.now();
    const diffMs = Math.abs(now - ts);
    if (diffMs > 5 * 60 * 1000) {
      return {
        ok: false,
        error: `WORKER_REPLAY_REJECTED: Request timestamp is ${Math.round(diffMs / 1000)}s old (max 300s)`,
        code: "TIMESTAMP_EXPIRED",
      };
    }
  }

  const worker_id = req.headers.get("x-worker-id") ?? `worker-${crypto.randomUUID().slice(0, 8)}`;
  return { ok: true, worker_id };
}

// ============================================================
// OPERATOR CONFIRMATION
// ============================================================

/**
 * Returns true if the request includes an explicit operator confirmation header.
 * Required for destructive operator actions (cancel, emergency_stop).
 */
export function hasOperatorConfirmation(req: Request): boolean {
  return req.headers.get("x-operator-confirm") === "CONFIRMED";
}

// ============================================================
// CONTEXT LOGGING HELPER
// ============================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Log a trust context establishment event.
 *
 * LOG SELECTIVELY — only for major execution boundary entry points:
 *   - User session entry (first user action on a session)
 *   - Worker job pickup
 *   - Operator action entry
 *   - System reconciliation start
 *   - Delegated storage writes
 *
 * DO NOT log for every internal function call.
 */
export async function logExecutionContext(
  supabase: SupabaseClient,
  ctx: TrustContext,
  functionName: string,
  action: string
): Promise<void> {
  try {
    await supabase.from("execution_context_log").insert({
      trace_id: ctx.trace_id,
      execution_context: ctx.execution_context,
      actor_id: ctx.actor_id,
      actor_role: ctx.actor_role,
      office_id: ctx.office_id,
      trigger_source: ctx.trigger_source,
      function_name: functionName,
      action,
      delegated_by: ctx.delegated_by ?? null,
    });
  } catch (e) {
    // Never let context logging break the main flow
    console.error("[execution-context] Failed to log context:", (e as Error).message);
  }
}
