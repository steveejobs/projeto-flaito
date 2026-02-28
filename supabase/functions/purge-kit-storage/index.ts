import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lexos-token",
};

const CHUNK_SIZE = 200;
const MAX_PATHS = 1000;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Auth check: require service role key or x-lexos-token
    const authHeader = req.headers.get("Authorization");
    const lexosToken = req.headers.get("x-lexos-token");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const isLexosToken = lexosToken && lexosToken === Deno.env.get("LEXOS_WORKER_SECRET");

    if (!isServiceRole && !isLexosToken) {
      console.error("[purge-kit-storage] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    const body = await req.json();
    const { bucket, paths } = body;

    // Validate inputs
    if (!bucket || typeof bucket !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing or invalid 'bucket'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(paths) || paths.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing or empty 'paths' array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (paths.length > MAX_PATHS) {
      return new Response(
        JSON.stringify({ ok: false, error: `Too many paths. Max ${MAX_PATHS} per request.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey!,
      { auth: { persistSession: false } }
    );

    // Process in chunks
    const failed: { path: string; error: string }[] = [];
    let deletedCount = 0;

    for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
      const chunk = paths.slice(i, i + CHUNK_SIZE);
      
      const { data, error } = await supabaseAdmin.storage.from(bucket).remove(chunk);

      if (error) {
        // Entire chunk failed
        chunk.forEach((p: string) => failed.push({ path: p, error: error.message }));
      } else {
        // Check individual results if available
        deletedCount += chunk.length;
      }
    }

    const result = {
      ok: failed.length === 0,
      deletedCount: paths.length - failed.length,
      failedCount: failed.length,
      failed: failed.length > 0 ? failed : undefined,
    };

    console.log(`[purge-kit-storage] bucket=${bucket} requested=${paths.length} deleted=${result.deletedCount} failed=${result.failedCount}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Internal error";
    console.error("[purge-kit-storage] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: errMsg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
