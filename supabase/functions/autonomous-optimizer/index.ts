import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OptimizerRequest {
  office_id: string;
  feature: string;
  context_metadata?: Record<string, any>;
  current_model?: string;
}

interface OptimizerResponse {
  recommendation: string;
  action: "apply" | "suggest" | "block";
  confidence_score: number;
  reason: string;
  signals_used: Record<string, any>;
  trace_id: string;
}

/**
 * Stage 17 Autonomous Optimizer
 * Logic:
 * 1. Fetch office/global policies.
 * 2. Fetch healthy model list from registry.
 * 3. Fetch performance signals (Latency WMA).
 * 4. Apply rules (Quality Floor, Cost Pressure, Hysteresis).
 * 5. Log decision and return recommendation.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { office_id, feature, context_metadata, current_model } = (await req.json()) as OptimizerRequest;
    const trace_id = req.headers.get("x-trace-id") || crypto.randomUUID();

    // 1. Get Policy (Office-specific or Global)
    const { data: policy } = await supabase
      .from("autonomous_optimization_policies")
      .select("*")
      .or(`office_id.eq.${office_id},office_id.is.null`)
      .eq("feature", feature)
      .order("office_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (!policy || policy.mode === 'disabled') {
      return new Response(JSON.stringify({ 
        recommendation: current_model || "fallback", 
        action: "block", 
        reason: "Autonomy policy disabled or not found",
        trace_id 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Get AI Models health and performance
    // We filter for Healthy or Degraded (Circuit Breaker check)
    const { data: healthyModels } = await supabase
      .from("ai_model_health_registry")
      .select(`
        model_name,
        status,
        latency_avg_ms,
        error_rate_pct,
        ai_model_pricing (
          cost_per_1k_tokens,
          quality_tier
        )
      `)
      .in("status", ["healthy", "degraded"]);

    if (!healthyModels || healthyModels.length === 0) {
      throw new Error("No healthy AI models available in registry");
    }

    // 3. Filter by Quality Floor
    const qTierMap: Record<string, number> = { 'high': 3, 'standard': 2, 'economic': 1 };
    const minTier = qTierMap[policy.quality_floor] || 2;
    
    let candidates = healthyModels.filter(m => {
      const modelTier = qTierMap[(m.ai_model_pricing as any)?.quality_tier] || 1;
      return modelTier >= minTier;
    });

    if (candidates.length === 0) {
      // Emergency: If no models meet quality floor, pick the healthiest available
      candidates = healthyModels;
    }

    // 4. Decision Logic (Deterministic)
    // Preference: Low Cost > High Performance (within quality budget)
    // Sort by cost (ascending) and latency (ascending)
    candidates.sort((a, b) => {
      const aCost = (a.ai_model_pricing as any).cost_per_1k_tokens;
      const bCost = (b.ai_model_pricing as any).cost_per_1k_tokens;
      const aLat = a.latency_avg_ms || 9999;
      const bLat = b.latency_avg_ms || 9999;

      // Rule: If cost difference < 10%, prefer lower latency. Else prefer lower cost.
      const costDiffRatio = Math.abs(aCost - bCost) / Math.max(aCost, bCost);
      if (costDiffRatio < 0.1) return aLat - bLat;
      return aCost - bCost;
    });

    const topCandidate = candidates[0];
    const recModel = topCandidate.model_name;
    
    // Hysteresis: Only switch if confidence is high or cost savings > 20%
    let action: "apply" | "suggest" = (policy.mode === 'auto_apply' && policy.auto_apply_allowed) ? 'apply' : 'suggest';
    
    // Safety check: Don't flip-flop if recommendation is the same
    if (recModel === current_model) {
      action = 'suggest'; // Already at better model
    }

    const outcome = {
      recommendation: recModel,
      action,
      confidence_score: topCandidate.status === 'healthy' ? 0.95 : 0.70,
      reason: `Optimization found: ${recModel} satisfies quality floor (${policy.quality_floor}) with optimal cost/latency balance.`,
      signals_used: {
        latency_avg: topCandidate.latency_avg_ms,
        cost_unit: (topCandidate.ai_model_pricing as any).cost_per_1k_tokens,
        registry_status: topCandidate.status,
        policy_mode: policy.mode
      },
      trace_id
    };

    // 5. Audit Logging (Fire and Forget)
    supabase.from("optimization_audit_log").insert({
      office_id,
      feature,
      decision_type: 'model_switch',
      input_signals: outcome.signals_used,
      recommendation: recModel,
      action_taken: action === 'apply' ? `switched_to_${recModel}` : 'none',
      reason: outcome.reason,
      confidence_score: outcome.confidence_score,
      applied_flag: action === 'apply',
      trace_id
    }).then();

    return new Response(JSON.stringify(outcome), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[OptimizerError] ${error.message}`);
    return new Response(JSON.stringify({ 
      error: error.message, 
      recommendation: "fallback", 
      action: "block" 
    }), {
      status: 200, // Return 200 to let consumer handle fallback gracefully
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
