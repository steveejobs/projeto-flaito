import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Apenas POST
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    // 1. Validar secret via querystring
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const expectedSecret = Deno.env.get("ZAPSIGN_WEBHOOK_SECRET");

    if (!expectedSecret || secret !== expectedSecret) {
      console.error("[zapsign-webhook] Unauthorized: invalid secret");
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    // 2. Parse do payload
    const payload = await req.json();
    const eventType = payload.event_type || "unknown";
    const docToken = payload.doc?.token || payload.token || null;

    console.log("[zapsign-webhook] Received:", eventType, "token:", docToken);

    // 3. Inicializar Supabase com service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Gerar ID único para idempotência
    const eventId = payload.id || `${eventType}-${docToken}-${Date.now()}`;

    // 5. Verificar duplicidade
    const { data: existing } = await supabase
      .from("zapsign_webhook_events")
      .select("id")
      .eq("zapsign_event_id", eventId)
      .maybeSingle();

    if (existing) {
      console.log("[zapsign-webhook] Duplicate event, skipping:", eventId);
      return json({ ok: true, duplicated: true });
    }

    // 6. Inserir evento para auditoria
    const { error: insertError } = await supabase.from("zapsign_webhook_events").insert({
      zapsign_event_id: eventId,
      event_type: eventType,
      doc_token: docToken,
      payload,
    });

    if (insertError) {
      console.error("[zapsign-webhook] Insert error:", insertError);
    }

    // 7. Processar apenas eventos doc_signed
    if (eventType === "doc_signed" && docToken) {
      
      // ========================================
      // PRIORIDADE 1: Assinatura de CADASTRO (e_signatures)
      // ========================================
      const { data: clientSignature } = await supabase
        .from("e_signatures")
        .select("id, client_id, office_id")
        .eq("zapsign_doc_token", docToken)
        .maybeSingle();

      if (clientSignature) {
        // Atualizar APENAS este registro de assinatura de cadastro
        await supabase
          .from("e_signatures")
          .update({
            signature_status: "SIGNED",
            signed_at: new Date().toISOString(),
          })
          .eq("id", clientSignature.id);

        // Marcar evento como processado
        await supabase
          .from("zapsign_webhook_events")
          .update({
            processed_at: new Date().toISOString(),
            office_id: clientSignature.office_id,
          })
          .eq("zapsign_event_id", eventId);

        console.log("[zapsign-webhook] Client signup signature signed:", clientSignature.client_id);
        return json({ ok: true, type: "client_signup" });
      }

      // ========================================
      // PRIORIDADE 2 (fallback): Documentos/Contratos (document_sign_requests)
      // ========================================
      const { data: signRequest } = await supabase
        .from("document_sign_requests")
        .select("id, document_id, office_id")
        .eq("zapsign_doc_token", docToken)
        .maybeSingle();

      if (signRequest) {
        // Atualizar status da solicitação para SIGNED
        await supabase
          .from("document_sign_requests")
          .update({
            status: "SIGNED",
            updated_at: new Date().toISOString(),
            provider_payload: payload,
          })
          .eq("id", signRequest.id);

        // Atualizar status do documento para ASSINADO
        await supabase
          .from("documents")
          .update({
            status: "ASSINADO",
            signed_at: new Date().toISOString(),
          })
          .eq("id", signRequest.document_id);

        // Atualizar evento como processado
        await supabase
          .from("zapsign_webhook_events")
          .update({
            processed_at: new Date().toISOString(),
            office_id: signRequest.office_id,
          })
          .eq("zapsign_event_id", eventId);

        console.log("[zapsign-webhook] Document signed:", signRequest.document_id);
        return json({ ok: true, type: "document" });
      }
      
      console.warn("[zapsign-webhook] No signature/request found for token:", docToken);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("[zapsign-webhook] Error:", error);
    return json({ ok: false, error: String(error) }, 500);
  }
});
