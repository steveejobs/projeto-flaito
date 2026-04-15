import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BuildDossierRequest {
  case_id: string;
  full_analysis?: any; // Resultado do nija-full-analysis
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { case_id, full_analysis } = await req.json() as BuildDossierRequest;
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[BUILD-DOSSIER] Processing case_id: ${case_id}`);

    // 1. Buscar dados do caso e do cliente
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select(`
        *,
        client:clients(*)
      `)
      .eq("id", case_id)
      .single();

    if (caseError || !caseData) {
      throw new Error(`Caso não encontrado: ${caseError?.message}`);
    }

    // 2. Extrair dados da análise (se fornecida ou fallback do banco se houver log)
    // Para agora, assumimos que o full_analysis vem no payload ou usamos o que temos no caseData se persistido
    const analysis = full_analysis || caseData.metadata?.last_analysis || {};

    // 3. Determinar versão atual
    const { data: lastDossier } = await supabase
      .from("process_dossiers")
      .select("version")
      .eq("case_id", case_id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (lastDossier?.version || 0) + 1;

    // 4. Montar Payload do Dossiê
    const dossierPayload = {
      case_id,
      office_id: caseData.office_id,
      version: nextVersion,
      ramo: analysis.meta?.ramo || caseData.ramo || "INDEFINIDO",
      fase_processual: analysis.meta?.faseProcessual || "INICIAL",
      polo: analysis.meta?.poloAtuacao || "INDEFINIDO",
      grau_risco: analysis.meta?.grauRiscoGlobal || "MEDIO",
      full_analysis: analysis,
      vicios: analysis.vicios || [],
      estrategias: analysis.estrategias || {},
      sugestao_peca: analysis.sugestaoPeca || {},
      resumo_tatico: analysis.meta?.resumoTatico || "",
      // Mapear provas extraídas se houver
      provas: analysis.linhaDoTempo?.filter((it: any) => it.tipoAto?.toLowerCase().includes("prova")) || []
    };

    // 5. Upsert no banco
    const { data: savedDossier, error: insertError } = await supabase
      .from("process_dossiers")
      .insert(dossierPayload)
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log(`[BUILD-DOSSIER] Version ${nextVersion} created for case ${case_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        dossier_id: savedDossier.id, 
        version: savedDossier.version,
        summary: `Dossiê V${nextVersion} gerado com sucesso.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[BUILD-DOSSIER] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
