import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Stage 17 Worker Rebalancer (Prototype)
 * Goal: Detect queue congestion and suggest priority rebalancing.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Snapshot of current queue
    const { data: stats, error: statsErr } = await supabase.rpc("get_worker_stats"); // We'll need this RPC
    
    // Fallback if RPC doesn't exist yet
    if (statsErr) {
      const { data: queuedJobs } = await supabase
        .from("session_jobs")
        .select("job_type", { count: 'exact' })
        .eq("status", "queued");
        
      const backlogSize = queuedJobs?.length || 0;
      
      if (backlogSize > 10) {
        return new Response(JSON.stringify({
          recommendation: "scale_up_workers",
          reason: `High backlog detected: ${backlogSize} jobs queued.`,
          confidence: 0.8,
          action: "suggest"
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ 
      status: "healthy", 
      message: "No rebalancing needed at this time." 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
