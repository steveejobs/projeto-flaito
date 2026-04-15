import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// learning-loop-automation — Stage 15: Post-Go-Live Learning Loop
//
// This function performs:
// 1. Regression Gap Detection: Finds clusters with repeated incidents missing tests.
// 2. Metric Orchestration: Triggers periodic snapshots for the learning loop dashboard.
// 3. Follow-up Reminders: (Future) Alerts owners of overdue postmortems.
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const logger = (level: "info" | "error" | "warn", message: string, context: Record<string, unknown> = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }));
};

serve(async (req: Request) => {
  // CORS handles...
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const correlationId = crypto.randomUUID();

  try {
    const { action } = await req.json();

    if (action === "detect-regression-gaps") {
      // Find clusters with multiple incidents where NO incident in that cluster has a verified regression test
      const { data: gaps, error } = await supabaseAdmin.rpc("detect_incident_regression_gaps");

      if (error) throw error;

      logger("info", "Regression gap detection completed", { count: gaps?.length || 0, correlationId });

      return new Response(JSON.stringify({ ok: true, gaps }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "trigger-metrics-snapshot") {
      const { data: metrics, error: metricsError } = await supabaseAdmin
        .from("learning_loop_metrics")
        .select("*")
        .single();
      
      if (metricsError) throw metricsError;

      const { error: snapshotError } = await supabaseAdmin
        .from("learning_loop_metric_snapshots")
        .upsert({
          snapshot_date: new Date().toISOString().split("T")[0],
          avg_mttr_min: metrics.mttr_min,
          open_incident_count: metrics.open_incidents,
          postmortem_debt_count: metrics.postmortem_debt,
          regression_debt_count: metrics.regression_gap_clusters,
          unprocessed_feedback_count: metrics.pending_feedback_count,
        });

      if (snapshotError) throw snapshotError;

      logger("info", "Metrics snapshot captured", { correlationId });
      return new Response(JSON.stringify({ ok: true, snapshot_date: new Date().toISOString().split("T")[0] }));
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

  } catch (err) {
    logger("error", "Learning Loop Automation critical failure", {
      error: (err as Error).message,
      correlationId,
    });
    return new Response(JSON.stringify({ error: (err as Error).message, correlationId }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
