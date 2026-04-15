// supabase/functions/lexos-render-document/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

type GenerateRequest = {
  template_id: string;
  case_id?: string | null;
  data: Record<string, any>;
  output_format?: "html" | "pdf";
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as GenerateRequest;
    const { template_id, case_id, data, output_format = "html" } = body;

    console.log("[lexos-render-document] Request received:", {
      template_id,
      case_id,
      output_format,
    });

    // Clona os dados recebidos (client.*, case.*, office.*)
    const vars: Record<string, any> = { ...data };

    // LOGO – gera URL assinada se bucket/path existirem
    const logoBucket = vars["office.logo_bucket"] as string | undefined;
    const logoPath = vars["office.logo_path"] as string | undefined;

    if (logoBucket && logoPath) {
      console.log("[lexos-render-document] Generating signed URL for logo:", logoBucket, logoPath);
      const { data: logoSigned, error: logoErr } = await supabase.storage
        .from(logoBucket)
        .createSignedUrl(logoPath, 3600);

      if (!logoErr && logoSigned?.signedUrl) {
        vars["office.logo_signed_url"] = logoSigned.signedUrl;
        console.log("[lexos-render-document] Logo signed URL generated successfully");
      } else if (logoErr) {
        console.warn("[lexos-render-document] Error generating logo signed URL:", logoErr);
      }
    }

    // ASSINATURA – gera URL assinada se bucket/path existirem
    const sigBucket = (vars["office.assinatura_bucket"] || vars["doctor.signature_bucket"]) as string | undefined;
    const sigPath = (vars["office.assinatura_path"] || vars["doctor.signature_path"]) as string | undefined;

    if (sigBucket && sigPath) {
      console.log("[lexos-render-document] Generating signed URL for signature:", sigBucket, sigPath);
      const { data: sigSigned, error: sigErr } = await supabase.storage
        .from(sigBucket)
        .createSignedUrl(sigPath, 3600);

      if (!sigErr && sigSigned?.signedUrl) {
        vars["office.signature_signed_url"] = sigSigned.signedUrl;
        vars["doctor.signature_url"] = sigSigned.signedUrl;
        console.log("[lexos-render-document] Signature signed URL generated successfully");
      } else if (sigErr) {
        console.warn("[lexos-render-document] Error generating signature signed URL:", sigErr);
      }
    }

    // Identidade Médica V5 - placeholders adicionais
    if (vars["doctor.title_prefix"]) {
        vars["doctor.full_title"] = `${vars["doctor.title_prefix"]} ${vars["doctor.name"]}`;
    } else {
        vars["doctor.full_title"] = vars["doctor.name"];
    }

    // Renderiza conteúdo final via função SQL já existente
    console.log("[lexos-render-document] Calling render_template_preview RPC");
    const { data: renderData, error: renderError } = await supabase.rpc(
      "render_template_preview",
      {
        p_template_id: template_id,
        p_data: vars,
      },
    );

    if (renderError) {
      console.error("[lexos-render-document] render_template_preview error:", renderError);
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "Erro ao renderizar template",
          details: renderError.message,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const renderResult = renderData as {
      ok: boolean;
      content?: string;
      reason?: string;
    };

    if (!renderResult.ok || !renderResult.content) {
      console.error("[lexos-render-document] Render failed:", renderResult.reason);
      return new Response(
        JSON.stringify({
          ok: false,
          reason: renderResult.reason || "Falha ao gerar conteúdo",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = renderResult.content;

    // Log da geração
    console.log("[lexos-render-document] Logging document generation");
    await supabase.rpc("log_document_generation", {
      p_template_id: template_id,
      p_case_id: case_id ?? null,
      p_data: vars,
    });

    console.log("[lexos-render-document] Document rendered successfully");
    return new Response(
      JSON.stringify({
        ok: true,
        format: output_format,
        content: html,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[lexos-render-document] Unexpected error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "Erro interno na geração do documento",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
