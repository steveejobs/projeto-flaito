import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyStaticToken } from "../_shared/webhook-security.ts";

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
  const correlationId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    // 1. Validar secret via querystring (Compatibilidade)
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const expectedSecret = Deno.env.get("ZAPSIGN_WEBHOOK_SECRET");

    if (!expectedSecret || !verifyStaticToken(secret, expectedSecret)) {
      console.error(`[zapsign-webhook] Unauthorized access attempt [${correlationId}]`);
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const payload = await req.json();
    const eventType = payload.event_type || "unknown";
    const docToken = payload.doc?.token || payload.token || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. ID Único determinístico para idempotência
    // Se a Zapsign não enviar ID, criamos um baseado no token + evento.
    // Evitamos Date.now() para ser repetível se o provedor reenviar o mesmo payload exato.
    const eventId = payload.id || `zsign-${eventType}-${docToken}`;

    // ============================================
    // 3. IDEMPOTENCIA ATÔMICA (Atomic DB Guard)
    // ============================================
    const { error: idempotencyError } = await supabase
      .from("zapsign_webhook_events")
      .insert({
        zapsign_event_id: eventId,
        event_type: eventType,
        doc_token: docToken,
        payload,
      });

    if (idempotencyError) {
      if (idempotencyError.code === "23505") {
        console.info(`[zapsign-webhook] Duplicate event [${eventId}] skipped.`);
        return json({ ok: true, duplicated: true });
      }
      throw idempotencyError;
    }

    // ============================================
    // 4. PROCESSAMENTO (Side Effects)
    // ============================================
    if (eventType === "doc_signed" && docToken) {
      
      // PRIORIDADE 1: Assinatura de CADASTRO (e_signatures)
      const { data: clientSignature } = await supabase
        .from("e_signatures")
        .select("id, client_id, office_id")
        .eq("zapsign_doc_token", docToken)
        .maybeSingle();

      if (clientSignature) {
        await supabase
          .from("e_signatures")
          .update({
            signature_status: "SIGNED",
            signed_at: new Date().toISOString(),
          })
          .eq("id", clientSignature.id);

        await supabase
          .from("zapsign_webhook_events")
          .update({
            processed_at: new Date().toISOString(),
            office_id: clientSignature.office_id,
          })
          .eq("zapsign_event_id", eventId);

        console.log(`[zapsign-webhook] Handled client signup signature: ${clientSignature.client_id}`);
        return json({ ok: true, type: "client_signup" });
      }

      // PRIORIDADE 2: Documentos/Contratos
      const { data: signRequest } = await supabase
        .from("document_sign_requests")
        .select("id, document_id, office_id")
        .eq("zapsign_doc_token", docToken)
        .maybeSingle();

      if (signRequest) {
        await supabase
          .from("document_sign_requests")
          .update({
            status: "SIGNED",
            updated_at: new Date().toISOString(),
            provider_payload: payload,
          })
          .eq("id", signRequest.id);

        const { data: originalDoc } = await supabase
          .from("documents")
          .select("storage_bucket, storage_path, status")
          .eq("id", signRequest.document_id)
          .maybeSingle();

        // Evitar re-processar documentos que já estão em estado final
        if (originalDoc && originalDoc.status !== "ASSINADO") {
            let updatedMimeType = "text/html";
            
            if (payload.doc?.file_url) {
              try {
                 const pdfRes = await fetch(payload.doc.file_url);
                 if (pdfRes.ok) {
                    const pdfBlob = await pdfRes.blob();
                    await supabase.storage
                      .from(originalDoc.storage_bucket || "documents")
                      .upload(originalDoc.storage_path, pdfBlob, { 
                         upsert: true, 
                         contentType: "application/pdf" 
                      });
                    updatedMimeType = "application/pdf";
                 }
              } catch (dlErr) {
                 console.error(`[zapsign-webhook] PDF Download failure:`, dlErr);
              }
            }

            await supabase
              .from("documents")
              .update({
                status: "ASSINADO",
                signed_at: new Date().toISOString(),
                mime_type: updatedMimeType
              })
              .eq("id", signRequest.document_id);
        }

        await supabase
          .from("zapsign_webhook_events")
          .update({
            processed_at: new Date().toISOString(),
            office_id: signRequest.office_id,
          })
          .eq("zapsign_event_id", eventId);

        console.log(`[zapsign-webhook] Handled document signature: ${signRequest.document_id}`);
        return json({ ok: true, type: "document" });
      }
      
      console.warn(`[zapsign-webhook] Orphan signature received (no record found for token): ${docToken}`);
    }

    return json({ ok: true });
  } catch (error: any) {
    console.error(`[zapsign-webhook] Failure [${correlationId}]:`, error.message);
    return json({ ok: false, error: "Internal processing bypass" }, 500);
  }
});
