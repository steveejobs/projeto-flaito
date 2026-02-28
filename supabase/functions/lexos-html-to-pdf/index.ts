// supabase/functions/lexos-html-to-pdf/index.ts
// Edge function para converter HTML para PDF usando PDFShift API
// Version: 1.0 - Server-side PDF generation (2025-01-03)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY");

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verifica se é chamada interna (via service role de outra edge function)
    const isInternalCall = req.headers.get("x-internal-call") === "true";
    const authHeader = req.headers.get("Authorization");

    // Se não for chamada interna E não tiver Authorization, rejeita
    if (!isInternalCall && !authHeader) {
      console.error("[lexos-html-to-pdf] Unauthorized: no auth header and not internal call");
      return jsonResponse({ ok: false, reason: "UNAUTHORIZED", details: "Não autorizado" });
    }

    if (!PDFSHIFT_API_KEY) {
      console.error("[lexos-html-to-pdf] PDFSHIFT_API_KEY not configured");
      return jsonResponse({ ok: false, reason: "CONFIG_ERROR", details: "API de PDF não configurada" });
    }

    // Parse body
    let html: string;
    let options: Record<string, unknown> = {};
    
    try {
      const body = await req.json();
      html = body.html;
      options = body.options || {};
    } catch (parseErr) {
      console.error("[lexos-html-to-pdf] JSON parse error:", parseErr);
      return jsonResponse({ ok: false, reason: "INVALID_JSON", details: "Corpo da requisição inválido" });
    }

    if (!html || typeof html !== "string") {
      return jsonResponse({ ok: false, reason: "MISSING_HTML", details: "HTML é obrigatório" });
    }

    console.log(`[lexos-html-to-pdf] Converting HTML to PDF, length: ${html.length}`);

    // Chama a API do PDFShift
    let pdfshiftResponse: Response;
    try {
      pdfshiftResponse = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`api:${PDFSHIFT_API_KEY}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: html,
          format: "A4",
          margin: options.margin || "20mm",
          sandbox: false,
          use_print: true,
          delay: options.delay || 500,
        }),
      });
    } catch (fetchErr) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      const errStack = fetchErr instanceof Error ? fetchErr.stack : undefined;
      console.error("[lexos-html-to-pdf] PDFShift fetch error:", errMsg, errStack);
      return jsonResponse({
        ok: false,
        reason: "PDFSHIFT_NETWORK_ERROR",
        details: `Erro de rede ao chamar PDFShift: ${errMsg}`,
      });
    }

    if (!pdfshiftResponse.ok) {
      let errorText = "";
      try {
        errorText = await pdfshiftResponse.text();
      } catch (_) {
        errorText = "Não foi possível ler resposta de erro";
      }
      console.error("[lexos-html-to-pdf] PDFShift error:", pdfshiftResponse.status, errorText);
      return jsonResponse({
        ok: false,
        reason: "PDF_GENERATION_FAILED",
        details: `PDFShift retornou ${pdfshiftResponse.status}: ${errorText}`,
      });
    }

    // Converte para base64
    let pdfBase64: string;
    let pdfSize: number;
    try {
      const pdfArrayBuffer = await pdfshiftResponse.arrayBuffer();
      pdfSize = pdfArrayBuffer.byteLength;
      const pdfUint8 = new Uint8Array(pdfArrayBuffer);

      // Converte para base64 em chunks para evitar stack overflow
      let binaryString = "";
      const chunkSize = 8192;
      for (let i = 0; i < pdfUint8.length; i += chunkSize) {
        const chunk = pdfUint8.subarray(i, Math.min(i + chunkSize, pdfUint8.length));
        binaryString += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      pdfBase64 = btoa(binaryString);
    } catch (convErr) {
      const errMsg = convErr instanceof Error ? convErr.message : String(convErr);
      const errStack = convErr instanceof Error ? convErr.stack : undefined;
      console.error("[lexos-html-to-pdf] Base64 conversion error:", errMsg, errStack);
      return jsonResponse({
        ok: false,
        reason: "BASE64_CONVERSION_FAILED",
        details: `Erro ao converter PDF para base64: ${errMsg}`,
      });
    }

    console.log(`[lexos-html-to-pdf] PDF generated successfully, size: ${pdfSize} bytes`);

    return jsonResponse({
      ok: true,
      pdf_base64: pdfBase64,
      size: pdfSize,
    });
  } catch (err) {
    // Fallback global para qualquer erro não tratado
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error("[lexos-html-to-pdf] Unexpected error:", errMsg, errStack);
    return jsonResponse({
      ok: false,
      reason: "UNEXPECTED_ERROR",
      details: errMsg,
    });
  }
});