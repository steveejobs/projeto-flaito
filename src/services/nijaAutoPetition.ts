import { nijaClient } from "./nija/nijaClient";

export interface NijaAutoPetitionResponse {
  caseId: string;
  analysis: any;
  petitionText: string;
}

/**
 * @deprecated Use nijaClient.generatePetition diretamente após validação do Shadow Mode
 */
export async function runNijaAutoPetition(params: {
  caseId: string;
  observacoes?: string | null;
}): Promise<NijaAutoPetitionResponse> {
  const { caseId, observacoes = null } = params;

  // Lógica Original (p/ comparação no Shadow Mode)
  const legacyFn = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    
    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select("id, reading_status, extracted_text_chars")
      .eq("case_id", caseId)
      .is("deleted_at", null);

    if (docsError) throw new Error("Erro ao verificar status dos documentos.");

    const docsWithProblems = (documents || []).filter(doc => {
      const status = doc.reading_status;
      return !status || ["PENDING", "INSUFFICIENT_READING", "ERROR", "FALLBACK_CLIENT_PDFJS"].includes(status);
    });

    if (docsWithProblems.length > 0) throw new Error("LEITURA_INSUFICIENTE");

    const { data, error } = await supabase.functions.invoke("nija-auto-petition", {
      body: { caseId, observacoes },
    });

    if (error || !data || data.error || !data.petitionText) {
      throw new Error(error?.message || data?.error || "Resposta inválida");
    }
    return data as NijaAutoPetitionResponse;
  };

  // Nova Lógica (Refatorada)
  const newFn = () => nijaClient.generatePetition({ caseId, observacoes });

  // Execução em Shadow Mode
  return nijaClient.shadowInvoke("AutoPetition", legacyFn, newFn);
}
