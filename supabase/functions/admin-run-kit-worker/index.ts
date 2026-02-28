import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const WORKER_SECRET = Deno.env.get("LEXOS_WORKER_SECRET");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validar que o secret está configurado no ambiente
  if (!WORKER_SECRET) {
    console.error("[admin-run-kit-worker] LEXOS_WORKER_SECRET não configurado");
    return new Response(
      JSON.stringify({ ok: false, error: "LEXOS_WORKER_SECRET não configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Validar JWT do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[admin-run-kit-worker] Missing Authorization header");
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar cliente com o token do usuário para validar autenticação e role
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      console.error("[admin-run-kit-worker] Invalid user:", userErr);
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-run-kit-worker] User ${user.id} requesting kit worker execution`);

    // 2. Validar role ADMIN/OWNER usando o cliente do usuário (RLS permite ver própria membership)
    const { data: membership, error: memberErr } = await supabaseUser
      .from("office_members")
      .select("role, office_id")
      .eq("user_id", user.id)
      .in("role", ["ADMIN", "OWNER"])
      .limit(1)
      .maybeSingle();

    if (memberErr) {
      console.error("[admin-run-kit-worker] Error fetching membership:", memberErr);
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

    console.log(`[admin-run-kit-worker] User ${user.id} authorized as ${membership.role} for office ${membership.office_id}`);

    // 3. Chamar kit-worker internamente com o secret
    const workerResp = await fetch(`${SUPABASE_URL}/functions/v1/kit-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lexos-worker-secret": WORKER_SECRET,
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

    if (!workerResp.ok) {
      console.error("[admin-run-kit-worker] Worker returned error:", workerResult);
      return new Response(
        JSON.stringify({ ok: false, error: workerResult.error || "Worker error" }),
        { status: workerResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[admin-run-kit-worker] Worker completed:", workerResult);

    return new Response(JSON.stringify({ ok: true, ...workerResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[admin-run-kit-worker] Fatal error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
