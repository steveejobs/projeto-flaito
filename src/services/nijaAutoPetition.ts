import { supabase } from "@/integrations/supabase/client";

export interface NijaAutoPetitionResponse {
  caseId: string;
  analysis: any;
  petitionText: string;
}

export async function runNijaAutoPetition(params: {
  caseId: string;
  observacoes?: string | null;
}): Promise<NijaAutoPetitionResponse> {
  const { caseId, observacoes = null } = params;

  // NIJA Fase 1: Verificar reading_status dos documentos antes de chamar IA
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("id, reading_status, extracted_text_chars")
    .eq("case_id", caseId)
    .is("deleted_at", null);

  if (docsError) {
    console.error("[runNijaAutoPetition] Erro ao buscar documentos:", docsError);
    throw new Error("Erro ao verificar status dos documentos.");
  }

  // Verificar se todos os documentos têm leitura suficiente
  const docsWithProblems = (documents || []).filter(doc => {
    const status = doc.reading_status;
    return !status || 
           status === "PENDING" || 
           status === "INSUFFICIENT_READING" || 
           status === "ERROR" || 
           status === "FALLBACK_CLIENT_PDFJS";
  });

  if (docsWithProblems.length > 0) {
    throw new Error(
      `LEITURA_INSUFICIENTE: ${docsWithProblems.length} documento(s) não foram lidos adequadamente. ` +
      `Reprocesse os documentos antes de gerar a petição.`
    );
  }

  const { data, error } = await supabase.functions.invoke(
    "nija-auto-petition",
    {
      body: {
        caseId,
        observacoes,
      },
    },
  );

  // Safari fix: validate response before processing to prevent download behavior
  if (error) {
    const errorMessage = error.message || "Erro desconhecido";
    console.error("[runNijaAutoPetition] Edge function error:", error);
    throw new Error(errorMessage);
  }

  if (!data || typeof data !== "object") {
    console.error("[runNijaAutoPetition] Invalid response type:", typeof data);
    throw new Error("Resposta inválida do serviço NIJA");
  }

  if (data.error) {
    console.error("[runNijaAutoPetition] API error:", data.error);
    throw new Error(data.error);
  }

  if (!data?.petitionText) {
    throw new Error("Nenhuma petição foi retornada pela NIJA.");
  }

  return data as NijaAutoPetitionResponse;
}
