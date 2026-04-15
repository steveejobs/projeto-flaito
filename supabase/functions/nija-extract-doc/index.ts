import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractionRequest {
  document_id: string;
  case_id: string;
  rawText: string;
  office_id?: string;
}

const SYSTEM_PROMPT = `Você é o NIJA_EXTRACT_DOC, um Analista de Dados Jurídicos Sênior.
Sua tarefa é extrair dados estruturados de UM ÚNICO DOCUMENTO jurídico.

OBJETIVO:
Analisar o texto e extrair entidades jurídicas com precisão absoluta. 
Não invente nada. Se não encontrar, retorne um array vazio ou null.

CLASSIFICAÇÃO OBRIGATÓRIA (CRÍTICO):
- fato_confirmado: Fatos aceitos por ambas as partes ou declarados em sentença.
- alegacao_autor: Fatos afirmados pelo autor mas ainda não provados/contestados.
- alegacao_reu: Fatos afirmados pelo réu na contestação.
- prova_documental: Menção direta a provas anexadas (ex: "Doc. 01", "ID 123").
- prova_ausente: Menção a algo que DEVERIA estar provado mas não há documento citado.

FORMATO DE SAÍDA EXCLUSIVO (JSON):
{
  "document_id": "string",
  "case_id": "string",
  "tipo_documento": "inicial | contestacao | decisao | contrato | outro",
  "partes": [],
  "fatos": [],
  "pedidos": [],
  "fundamentos": [],
  "datas": [],
  "classificacao_fatos": {
    "fato_confirmado": [],
    "alegacao_autor": [],
    "alegacao_reu": []
  },
  "provas": {
    "prova_documental": [],
    "prova_ausente": []
  },
  "confidence_score": 0-1
}

REGRAS:
- Mantenha o vínculo com document_id.
- Separe explicitamente alegação de prova.
- Use linguagem jurídica técnica e precisa.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { document_id, case_id, office_id }: ExtractionRequest = await req.json();

    if (!document_id) {
      throw new Error("document_id é obrigatório.");
    }

    // 1. Fetch Canonical Document (Stage 0)
    const { data: canonical, error: canonicalError } = await supabase
      .from("nija_canonical_documents")
      .select("canonical_markdown, input_quality_score, checksum")
      .eq("document_id", document_id)
      .eq("processing_status", "COMPLETED")
      .maybeSingle();

    if (canonicalError || !canonical) {
      throw new Error(`Stage 0 (Canonical) not found or not completed for doc ${document_id}.`);
    }

    if (canonical.input_quality_score === "BROKEN") {
      throw new Error(`Documento ${document_id} está marcado como BROKEN no Estágio 0 e não pode ser processado.`);
    }

    const extractionInput = canonical.canonical_markdown;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    console.log(`[nija-extract-doc] Processando doc_id: ${document_id} (via Stage 0)`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Extraia os dados deste documento consolidado:\n\n${extractionInput}` },
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // Adicionar IDs ao resultado para garantir consistência
    result.document_id = document_id;
    result.case_id = case_id;

    // Persistir no cache nija_extractions (anteriormente nija_doc_extractions)
    const { error: dbError } = await supabase
      .from("nija_extractions")
      .upsert({
        document_id,
        case_id,
        office_id,
        tipo_documento: result.tipo_documento,
        extraction_json: result,
        confidence_score: result.confidence_score,
        integrity_hash: canonical.checksum, // Propagando o hash do Stage 0
      });

    if (dbError) {
      console.error("[nija-extract-doc] DB Error:", dbError);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[nija-extract-doc] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
