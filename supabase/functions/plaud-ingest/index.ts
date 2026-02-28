import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lexos-token",
};

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  console.log("[plaud-ingest] Request received:", req.method, req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ============= GET: Health check (no auth required) =============
  if (req.method === "GET") {
    console.log("[plaud-ingest] Health check requested");
    return new Response(
      JSON.stringify({ 
        ok: true, 
        status: "ready", 
        timestamp: new Date().toISOString(),
        version: "2.0.0"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ============= POST: Ingest Plaud data (auth required) =============
  if (req.method !== "POST") {
    console.error("[plaud-ingest] Method not allowed:", req.method);
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use GET or POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1) Validate token (security layer)
    const expectedToken = Deno.env.get("ZAPIER_PLAUD_TOKEN");
    const providedToken = req.headers.get("x-lexos-token");

    console.log("[plaud-ingest] Auth check - Token provided:", !!providedToken, "Token configured:", !!expectedToken);

    if (!expectedToken || !providedToken || providedToken !== expectedToken) {
      console.error("[plaud-ingest] Unauthorized: invalid or missing x-lexos-token");
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Extract office_id from querystring
    const url = new URL(req.url);
    const officeId = url.searchParams.get("office_id");

    if (!officeId) {
      console.error("[plaud-ingest] Missing office_id parameter");
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required parameter: office_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!UUID_REGEX.test(officeId)) {
      console.error("[plaud-ingest] Invalid office_id format:", officeId);
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid office_id format. Must be a valid UUID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[plaud-ingest] Processing for office:", officeId);

    // 3) Parse JSON body
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
      console.log("[plaud-ingest] Payload keys:", Object.keys(payload));
    } catch {
      console.error("[plaud-ingest] Invalid JSON body");
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log("[plaud-ingest] Processing asset:", { externalId, eventId });

    // 4) Insert audit event
    const { error: auditError } = await supabase
      .from("plaud_webhook_events")
      .insert({
        provider: "plaud-zapier",
        event_id: eventId,
        event_type: "ingest",
        office_id: officeId,
        payload: payload,
        status: "processed",
        processed_at: new Date().toISOString(),
      });

    if (auditError) {
      // Check if it's a duplicate (unique constraint violation)
      if (auditError.code === "23505") {
        console.log("[plaud-ingest] Duplicate event, skipping:", eventId);
        return new Response(
          JSON.stringify({ ok: true, duplicated: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.warn("[plaud-ingest] Audit insert warning:", auditError.message);
      // Continue anyway - we want to process the asset even if audit fails
    }

    // 5) Extract all fields from flexible payload
    const title = String(payload.title || payload.name || "Plaud Recording");
    const transcript = payload.transcript || payload.text || null;
    const summary = payload.summary || payload.ai_summary || null;
    const language = payload.language || null;
    const audioUrl = payload.audio_url || payload.audioUrl || payload.file_url || null;
    const duration = payload.duration ? Number(payload.duration) : null;
    const occurredAt = payload.occurred_at || payload.created_at || payload.timestamp || null;
    const createdAtSource = payload.created_at_source || payload.recordedAt || payload.recorded_at || occurredAt || null;

    console.log("[plaud-ingest] Upserting asset:", { 
      title, 
      hasTranscript: !!transcript, 
      hasSummary: !!summary,
      audioUrl: audioUrl ? "yes" : "no",
      duration 
    });

    // 6) Upsert plaud_assets with new onConflict
    const { data: assetData, error: assetError } = await supabase
      .from("plaud_assets")
      .upsert(
        {
          office_id: officeId,
          source: "plaud_direct",
          external_id: externalId,
          title: title,
          transcript: transcript,
          summary: summary,
          language: language,
          audio_url: audioUrl,
          duration: duration,
          received_at: new Date().toISOString(),
          created_at_source: createdAtSource ? new Date(String(createdAtSource)).toISOString() : null,
          occurred_at: occurredAt ? new Date(String(occurredAt)).toISOString() : null,
          raw: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "office_id,external_id" }
      )
      .select("id")
      .single();

    if (assetError) {
      console.error("[plaud-ingest] Asset upsert error:", assetError);
      return new Response(
        JSON.stringify({ ok: false, error: assetError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[plaud-ingest] Successfully processed asset:", externalId, "ID:", assetData?.id);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        asset_id: assetData?.id,
        external_id: externalId
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[plaud-ingest] Unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
