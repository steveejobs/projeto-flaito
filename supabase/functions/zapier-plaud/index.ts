import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lexos-token",
};

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    console.error("[zapier-plaud] Method not allowed:", req.method);
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1) Validate token (security layer)
    const expectedToken = Deno.env.get("ZAPIER_PLAUD_TOKEN");
    const providedToken = req.headers.get("x-lexos-token");

    if (!expectedToken || !providedToken || providedToken !== expectedToken) {
      console.error("[zapier-plaud] Unauthorized: invalid or missing x-lexos-token");
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Extract office_id from querystring
    const url = new URL(req.url);
    const officeId = url.searchParams.get("office_id");

    if (!officeId) {
      console.error("[zapier-plaud] Missing office_id parameter");
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required parameter: office_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!UUID_REGEX.test(officeId)) {
      console.error("[zapier-plaud] Invalid office_id format:", officeId);
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid office_id format. Must be a valid UUID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Parse JSON body
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      console.error("[zapier-plaud] Invalid JSON body");
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[zapier-plaud] Received payload for office:", officeId, JSON.stringify(payload));

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract external_id from payload (try multiple fields)
    const externalId = String(
      payload.external_id ||
      payload.id ||
      payload.recording_id ||
      payload.plaud_id ||
      crypto.randomUUID()
    );

    // Extract event_id for audit (same logic)
    const eventId = String(
      payload.external_id ||
      payload.id ||
      payload.recording_id ||
      payload.event_id ||
      externalId
    );

    console.log("[zapier-plaud] Processing asset with external_id:", externalId);

    // 4) Insert audit event
    const { error: auditError } = await supabase
      .from("plaud_webhook_events")
      .insert({
        provider: "plaud-zapier",
        event_id: eventId,
        event_type: "zapier",
        office_id: officeId,
        payload: payload,
        status: "processed",
        processed_at: new Date().toISOString(),
      });

    if (auditError) {
      // Check if it's a duplicate (unique constraint violation)
      if (auditError.code === "23505") {
        console.log("[zapier-plaud] Duplicate event, skipping:", eventId);
        return new Response(
          JSON.stringify({ ok: true, duplicated: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("[zapier-plaud] Audit insert error:", auditError);
      // Continue anyway - we want to process the asset even if audit fails
    }

    // 5) Upsert plaud_assets
    const title = String(payload.title || payload.name || "Plaud Recording");
    const transcript = payload.transcript || payload.text || null;
    const summary = payload.summary || payload.ai_summary || null;
    const language = payload.language || null;
    const occurredAt = payload.occurred_at || payload.created_at || payload.timestamp || null;

    const { error: assetError } = await supabase
      .from("plaud_assets")
      .upsert(
        {
          office_id: officeId,
          source: "plaud",
          external_id: externalId,
          title: title,
          transcript: transcript,
          summary: summary,
          language: language,
          occurred_at: occurredAt ? new Date(String(occurredAt)).toISOString() : null,
          raw: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source,external_id" }
      );

    if (assetError) {
      console.error("[zapier-plaud] Asset upsert error:", assetError);
      return new Response(
        JSON.stringify({ ok: false, error: assetError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[zapier-plaud] Successfully processed asset:", externalId);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[zapier-plaud] Unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
