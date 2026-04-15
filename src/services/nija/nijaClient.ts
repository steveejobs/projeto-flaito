import { supabase } from "@/integrations/supabase/client";

export interface NijaResponse<T = any> {
  data: T | null;
  error: string | null;
  shadowDiscrepancy?: boolean;
}

/**
 * Valida se os documentos de um caso estão prontos para análise (leitura mínima garantida)
 */
export async function validateCaseDocuments(caseId: string): Promise<void> {
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("id, reading_status, extracted_text_chars")
    .eq("case_id", caseId)
    .is("deleted_at", null);

  if (docsError) {
    console.error("[NijaClient] Erro ao buscar documentos:", docsError);
    throw new Error("Erro ao verificar status dos documentos.");
  }

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
      `Reprocesse os documentos antes de prosseguir.`
    );
  }
}

/**
 * Wrapper genérico para chamadas NIJA com tratamento de erro e "Safari Fix"
 */
async function invokeNijaFunction<T = any>(functionName: string, body: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  // Safari fix: validate response before processing to prevent download behavior or silent crashes
  if (error) {
    const errorMessage = error.message || "Erro desconhecido na Edge Function";
    console.error(`[NijaClient] ${functionName} error:`, error);
    throw new Error(errorMessage);
  }

  if (!data || typeof data !== "object") {
    console.error(`[NijaClient] ${functionName} invalid response type:`, typeof data);
    throw new Error("Resposta inválida do serviço NIJA");
  }

  if (data.error) {
    console.error(`[NijaClient] ${functionName} API error:`, data.error);
    throw new Error(data.error);
  }

  return data as T;
}

/**
 * Compara dois objetos e loga discrepâncias (Shadow Mode)
 */
function shadowCompare(label: string, legacyResult: any, newResult: any) {
  const legacyStr = JSON.stringify(legacyResult);
  const newStr = JSON.stringify(newResult);
  
  if (legacyStr !== newStr) {
    console.warn(`[SHADOW_MODE] Discrepância detectada em ${label}:`, {
      original: legacyResult,
      refactored: newResult
    });
    return true;
  }
  
  if (import.meta.env.DEV) {
    console.log(`[SHADOW_MODE] Paridade funcional confirmada em ${label} ✓`);
  }
  return false;
}

/**
 * Métodos Semânticos da NIJA
 */
export const nijaClient = {
  /**
   * Executa a análise completa de um caso
   */
  async analyzeCase(params: {
    caseId: string;
    rawText: string;
    ramoHint?: string | null;
    faseHint?: string | null;
    poloHint?: string | null;
  }) {
    await validateCaseDocuments(params.caseId);
    
    return invokeNijaFunction("nija-full-analysis", {
      rawText: params.rawText,
      ramoHint: params.ramoHint ?? null,
      faseHint: params.faseHint ?? null,
      poloHint: params.poloHint ?? null,
      caseMeta: {},
      clientMeta: {},
      opponentMeta: {},
      observacoes: null,
    });
  },

  /**
   * Gera uma petição automática baseada nos documentos do caso
   */
  async generatePetition(params: {
    caseId: string;
    observacoes?: string | null;
  }) {
    await validateCaseDocuments(params.caseId);
    
    return invokeNijaFunction("nija-auto-petition", {
      caseId: params.caseId,
      observacoes: params.observacoes ?? null,
    });
  },

  /**
   * Método de suporte para Shadow Mode (Run legacy vs new)
   */
  async shadowInvoke<T>(label: string, legacyFn: () => Promise<T>, newFn: () => Promise<T>): Promise<T> {
    const [legacyResult, newResult] = await Promise.all([
      legacyFn().catch(err => ({ isError: true, error: err })),
      newFn().catch(err => ({ isError: true, error: err }))
    ]);

    shadowCompare(label, legacyResult, newResult);

    // Sempre retorna o resultado da função Legada para garantir estabilidade em produção
    if ((legacyResult as any).isError) throw (legacyResult as any).error;
    return legacyResult as T;
  }
};
