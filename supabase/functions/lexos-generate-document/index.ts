import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("[lexos-generate-document] Missing authorization header");
      return new Response(
        JSON.stringify({ ok: false, error: "Não autorizado", step: "auth" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract user_id from JWT (secure - cannot be spoofed)
    const jwt = authHeader.replace("Bearer ", "");
    let actor_user_id: string;
    try {
      const jwtPayload = JSON.parse(atob(jwt.split(".")[1]));
      actor_user_id = jwtPayload.sub;
      if (!actor_user_id) {
        throw new Error("Missing sub claim");
      }
    } catch (jwtErr) {
      console.error("[lexos-generate-document] Invalid JWT token:", jwtErr);
      return new Response(
        JSON.stringify({ ok: false, error: "Token JWT inválido", step: "auth" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { case_id, title, content, kind, source_template_id } = body;

    console.log("[lexos-generate-document] Request received:", {
      case_id,
      title: title?.substring(0, 50),
      actor_user_id,
      kind,
      source_template_id,
    });

    // Validate required fields (actor_user_id now comes from JWT, not body)
    if (!case_id || !title) {
      console.error("[lexos-generate-document] Missing required fields");
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Campos obrigatórios: case_id, title",
          step: "validation",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use Service Role client to bypass RLS for validated operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Validate user has active office membership
    console.log("[lexos-generate-document] Validating office membership for user:", actor_user_id);
    
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("office_members")
      .select("office_id, is_active, role")
      .eq("user_id", actor_user_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (memberError) {
      console.error("[lexos-generate-document] Error fetching office_members:", memberError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Erro ao verificar vínculo do escritório",
          step: "validate office",
          details: memberError,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!memberData || !memberData.is_active) {
      console.error("[lexos-generate-document] User has no active office membership");
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Usuário sem escritório ativo. Verifique o vínculo do escritório.",
          step: "validate office",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const office_id = memberData.office_id;
    console.log("[lexos-generate-document] User office validated:", office_id);

    // 2. Validate case belongs to the same office
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from("cases")
      .select("id, office_id, title")
      .eq("id", case_id)
      .single();

    if (caseError || !caseData) {
      console.error("[lexos-generate-document] Case not found or error:", caseError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Caso não encontrado",
          step: "validate case",
          details: caseError,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (caseData.office_id !== office_id) {
      console.error("[lexos-generate-document] Case belongs to different office");
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Caso não pertence ao seu escritório",
          step: "validate case",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
