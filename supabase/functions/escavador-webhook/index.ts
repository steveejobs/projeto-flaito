// supabase/functions/escavador-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyStaticToken } from "../_shared/webhook-security.ts";

serve(async (req) => {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Security Check
    const authHeader = req.headers.get("Authorization");
    const expectedToken = Deno.env.get("ESCAVADOR_CALLBACK_TOKEN");

    if (!verifyStaticToken(authHeader?.replace("Bearer ", "") || null, expectedToken || "")) {
      console.warn(`[escavador-webhook] [${correlationId}] Unauthorized webhook attempt.`);
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await req.json();
    console.log(`[escavador-webhook] [${correlationId}] Received payload:`, JSON.stringify(payload));

    // 2. Persistence First (Log Raw Event)
    // Escavador payload usually has a 'id' or 'search_id'
    const externalId = payload.search_id || payload.monitoramento_id || payload.id;
    
    const { data: event, error: eventError } = await supabaseClient
      .from("escavador_webhook_events")
      .insert({
        external_id: externalId?.toString(),
        payload_bruto: payload,
        signature_verified: true
      })
      .select()
      .single();

    if (eventError) throw eventError;

    // 3. Fast Response (Fire and Forget for heavy logic)
    // In Edge Functions, we can continue execution for a bit or use a trigger/queue
    // Here we'll process directly as it's a simple update
    
    (async () => {
      try {
        // 4. Processing Logic
        if (payload.search_id) {
          // It's a search result update
          const { data: request } = await supabaseClient
            .from("escavador_search_requests")
            .select("id")
            .eq("external_id", payload.search_id.toString())
            .maybeSingle();

          if (request) {
            // Save Result
            await supabaseClient.from("escavador_search_results").insert({
              request_id: request.id,
              payload_response: payload,
              source: "CALLBACK"
            });

            // Update Status
            await supabaseClient.from("escavador_search_requests")
              .update({ 
                status: payload.status === 'error' ? 'FAILED' : 'COMPLETED',
                cost: payload.custo || 0
              })
              .eq("id", request.id);
          }
        } else if (payload.monitoramento_id) {
            // It's a monitoring update
            // TODO: Update monitoring events table (to be created if needed) or audit
            console.log(`[escavador-webhook] [${correlationId}] Monitoring update for ${payload.monitoramento_id}`);
        }

        // Mark event as processed
        await supabaseClient.from("escavador_webhook_events")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", event.id);

      } catch (procErr) {
        console.error(`[escavador-webhook] [${correlationId}] Processing error:`, procErr);
      }
    })();

    return new Response(JSON.stringify({ received: true, event_id: event.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error(`[escavador-webhook] [${correlationId}] Webhook Error:`, err);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500 });
  }
});
