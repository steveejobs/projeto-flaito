import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// operational-reconciler — Stage 10: Trust Boundary Hardening
//
// This function is a SYSTEM/INTERNAL reconciler.
// It must NEVER be exposed as a generic browser-facing API.
//
// Trust model: system (cron / internal server-to-server only)
//
// Authentication:
//   1. x-reconciler-secret header OR
//   2. JWT with OWNER/ADMIN role (for manual operator trigger)
//
// CORS: Restricted to internal/admin origins only.
//       No browser wildcard allowed for a system function.
// ============================================================

const ALLOWED_ORIGINS = [
  "https://app.flaito.com",    // Admin panel (manual trigger only)
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin  = req.headers.get("Origin") ?? "";
  // If no origin (server-to-server call), no CORS headers needed
  if (!origin) return { "Content-Type": "application/json" };
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  if (!allowed) return {}; // Block unknown origins
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reconciler-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECONCILER_SECRET = Deno.env.get("RECONCILER_SECRET");

const logger = (level: "info" | "error" | "warn", message: string, context: Record<string, unknown> = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }));
};

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get("x-trace-id") ?? crypto.randomUUID();

  // ============================================================
  // AUTHENTICATION — system or operator
  // ============================================================

  let authenticatedAs: "system" | "operator" | null = null;

  // Option 1: Server-to-server via reconciler secret (cron / internal)
  const providedSecret = req.headers.get("x-reconciler-secret");
  if (RECONCILER_SECRET && providedSecret === RECONCILER_SECRET) {
    authenticatedAs = "system";
  }

  // Option 2: Operator JWT with OWNER/ADMIN role (manual trigger)
  if (!authenticatedAs) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUrl   = SUPABASE_URL;
      const supabaseAnon  = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient    = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: authRes } = await authClient.auth.getUser();
      if (authRes?.user) {
        const { data: membership } = await authClient
          .from("office_members")
          .select("role")
          .eq("user_id", authRes.user.id)
          .in("role", ["OWNER", "ADMIN"])
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (membership) {
          authenticatedAs = "operator";
          logger("info", "Reconciler triggered by operator", {
            user_id: authRes.user.id,
            role:    membership.role,
            correlationId,
          });
        }
      }
    }
  }

  if (!authenticatedAs) {
    logger("error", "Reconciler rejected: no valid authentication", { correlationId });
    return new Response(
      JSON.stringify({ error: "UNAUTHORIZED: reconciler requires x-reconciler-secret or OWNER/ADMIN JWT", correlationId }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  logger("info", "Operational Reconciler started", {
    correlationId,
    execution_context: authenticatedAs,
    trigger_source:    authenticatedAs === "system" ? "cron" : "http_operator",
  });

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const results = {
    billing:       0,
    documents:     0,
    notifications: 0,
    errors:        [] as string[],
  };

  try {
    // ── 1. ASAAS RECONCILIATION ─────────────────────────────────────
    const { data: auditLogs } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("*")
      .eq("status", "ERROR")
      .eq("action", "asaas.create_payment")
      .filter("metadata_json->>consistency_state", "eq", "PENDING_EXTERNAL_CONFIRMATION")
      .limit(20);

    for (const log of (auditLogs || [])) {
      try {
        const idempotencyKey = log.metadata_json?.idempotency_key;
        if (!idempotencyKey) continue;
        results.billing++;
      } catch (e) {
        results.errors.push(`Billing reconcile failed for log ${log.id}: ${(e as Error).message}`);
      }
    }

    // ── 2. ZAPSIGN RECONCILIATION ──────────────────────────────────
    const { data: signRequests } = await supabaseAdmin
      .from("document_sign_requests")
      .select("*")
      .eq("status", "PENDING")
      .lt("created_at", new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString())
      .limit(10);

    for (const signReq of (signRequests || [])) {
      try {
        const ZAPSIGN_API_KEY = Deno.env.get("ZAPSIGN_API_KEY");
        const docToken        = signReq.zapsign_doc_token;

        const zapResponse = await fetch(`https://api.zapsign.com.br/api/v1/docs/${docToken}/`, {
          headers: { "Authorization": `Bearer ${ZAPSIGN_API_KEY}` },
        });

        if (zapResponse.ok) {
          const docData = await zapResponse.json();
          if (docData.status === "signed" || docData.status === "completed") {
            await supabaseAdmin.from("document_sign_requests").update({
              status:   "COMPLETED",
              metadata: { ...signReq.metadata, reconciled_at: new Date().toISOString() },
            }).eq("id", signReq.id);
            results.documents++;
          }
        }
      } catch (e) {
        results.errors.push(`Document reconcile failed for req ${signReq.id}: ${(e as Error).message}`);
      }
    }

    // ── 3. NOTIFICATIONS RESCUE ────────────────────────────────────
    const { data: notificationsStuck } = await supabaseAdmin
      .from("notificacoes_fila")
      .select("id")
      .eq("status", "PROCESSING")
      .lt("last_attempt_at", new Date(Date.now() - 1000 * 60 * 20).toISOString())
      .limit(50);

    if (notificationsStuck && notificationsStuck.length > 0) {
      const stuckIds = notificationsStuck.map(n => n.id);
      const { error: rescueError } = await supabaseAdmin
        .from("notificacoes_fila")
        .update({
          status:              "PENDING",
          last_error_message: "Stuck in PROCESSING - Rescued by Operational Reconciler",
        })
        .in("id", stuckIds);

      if (!rescueError) results.notifications += stuckIds.length;
    }

    logger("info", "Operational Reconciler finished", {
      results,
      correlationId,
      execution_context: authenticatedAs,
    });

    return new Response(
      JSON.stringify({ success: true, results, correlationId, execution_context: authenticatedAs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    logger("error", "Critical reconciler failure", {
      error: (err as Error).message,
      correlationId,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message, correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
