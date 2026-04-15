import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface OptimizerDecision {
  recommendation: string;
  action: "apply" | "suggest" | "block";
  confidence_score: number;
  reason: string;
  signals_used: Record<string, any>;
  trace_id: string;
}

/**
 * Stage 17 Autonomous Optimizer Client
 * Invokes the autonomous-optimizer Edge Function.
 */
export async function getAutonomousDecision(
  supabase: SupabaseClient,
  params: {
    office_id: string;
    feature: string;
    context_metadata?: Record<string, any>;
    current_model?: string;
  }
): Promise<OptimizerDecision | null> {
  try {
    const { data, error } = await supabase.functions.invoke("autonomous-optimizer", {
      body: params,
    });

    if (error) {
      console.warn(`[OptimizerClient] Function error: ${error.message}`);
      return null;
    }

    return data as OptimizerDecision;
  } catch (err) {
    console.warn(`[OptimizerClient] Invocation failed: ${(err as Error).message}`);
    return null;
  }
}
