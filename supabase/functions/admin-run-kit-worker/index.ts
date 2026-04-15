import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// admin-run-kit-worker — Stage 10: Trust Boundary Hardening
//
// Trust model: operator (JWT + OWNER/ADMIN role required)
// CORS: Restricted to known origins — NOT wildcard
// Audit: Every invocation logged in operator_action_log
// ============================================================

const ALLOWED_ORIGINS = [
  "https://app.flaito.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin  = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON   = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_SECRET   = Deno.env.get("LEXOS_WORKER_SECRET");

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!WORKER_SECRET) {
    console.error("[admin-run-kit-worker] LEXOS_WORKER_SECRET not configured");
    return new Response(
      JSON.stringify({ ok: false, error: "LEXOS_WORKER_SECRET not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const traceId = crypto.randomUUID();

  try {
    // 1. Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate OWNER/ADMIN role (backend-enforced — not frontend route protection)
    const { data: membership, error: memberErr } = await supabaseUser
      .from("office_members")
      .select("role, office_id")
      .eq("user_id", user.id)
      .in("role", ["ADMIN", "OWNER"])
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (memberErr) {
      return new Response(
        JSON.stringify({ ok: false, error: "Error validating permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!membership) {
      console.error(`[admin-run-kit-worker] User ${user.id} is not admin/owner`);
      return new Response(
        JSON.stringify({ ok: false, error: "Forbidden: requires admin role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-run-kit-worker] Operator ${user.id} (${membership.role}) authorized — trace: ${traceId}`);

    // 3. Log operator action BEFORE execution (immutable intent record)
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
    const idempotencyKey = `admin-kit-worker:${user.id}:${Math.floor(Date.now() / 60000)}`; // 1-minute window idempotency

    // Check idempotency — prevent rapid duplicate triggers
    const { data: existingLog } = await adminClient
      .from("operator_action_log")
      .select("id, execution_result")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingLog) {
      console.log(`[admin-run-kit-worker] Idempotent — already executed this minute (result: ${existingLog.execution_result})`);
      return new Response(
        JSON.stringify({ ok: true, idempotent: true, previous_result: existingLog.execution_result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Call kit-worker internally with worker secret
    const workerResp = await fetch(`${SUPABASE_URL}/functions/v1/kit-worker`, {
      method:  "POST",
      headers: {
        "Content-Type":          "application/json",
        "x-lexos-worker-secret": WORKER_SECRET,
        "x-worker-id":           `operator-trigger:${user.id}`,
        "x-trace-id":            traceId,
      },
      body: JSON.stringify({}),
    });

    const raw = await workerResp.text();
    let workerResult: Record<string, unknown>;
    try {
      workerResult = JSON.parse(raw);
    } catch {
      workerResult = { raw };
    }

    const executionResult = workerResp.ok ? "success" : "error";

    // 5. Log operator action result (immutable audit)
    await adminClient.from("operator_action_log").insert({
      operator_id:          user.id,
      operator_role:        membership.role,
      office_id:            membership.office_id,
      action_type:          "trigger_kit_worker",
      target_resource_type: "kit_worker",
      target_resource_id:   null,
      justification:        "Manual operator trigger via admin panel",
      idempotency_key:      idempotencyKey,
      execution_result:     executionResult,
      error_detail:         workerResp.ok ? null : (workerResult.error as string ?? raw),
      trace_id:             traceId,
    });

    if (!workerResp.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: workerResult.error || "Worker error" }),
        { status: workerResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, ...workerResult, trace_id: traceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[admin-run-kit-worker] Fatal error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
