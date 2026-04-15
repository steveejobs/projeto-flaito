import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireResourceAccess } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { case_id, title, content, kind, source_template_id } = body;

    // ETAPA -1: AUTENTICAÇÃO E AUTORIZAÇÃO (Zero Trust)
    const auth = await requireResourceAccess(req, {
        resourceType: 'cases',
        resourceId: case_id,
        minRole: 'MEMBER'
    });

    if (!auth.ok) return auth.response;

    const supabaseAdmin = auth.adminClient;
    const office_id = auth.membership.office_id;
    const actor_user_id = auth.user.uid;

    if (!title) {
      return new Response(JSON.stringify({ ok: false, error: "Título é obrigatório", code: "VALIDATION_ERROR" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Determine document kind: use body.kind, or fetch from template, or default to "OUTRO"
    let docKind = kind || "OUTRO";
    if (!kind && source_template_id) {
      const { data: templateData } = await supabaseAdmin
        .from("templates")
        .select("kind")
        .eq("id", source_template_id)
        .single();
      
      if (templateData?.kind) {
        docKind = templateData.kind;
      }
    }

    // 4. Insert into generated_docs
    console.log("[lexos-generate-document] Inserting document with kind:", docKind);
    
    const { data: insertedDoc, error: insertError } = await supabaseAdmin
      .from("generated_docs")
      .insert({
        case_id,
        office_id,
        title: title.trim(),
        content: content || "",
        kind: docKind,
        version: 1,
        source_template_id: source_template_id || null,
        created_by: actor_user_id,
        metadata: {},
      })
      .select("id, title, kind, version, created_at")
      .single();

    if (insertError) {
      console.error("[lexos-generate-document] Insert error:", insertError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: insertError.message,
          step: "insert document",
          details: insertError,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[lexos-generate-document] Document created successfully:", insertedDoc.id);

    return new Response(
      JSON.stringify({
        ok: true,
        document: insertedDoc,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erro interno";
    console.error("[lexos-generate-document] Unexpected error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMessage,
        step: "unknown",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
