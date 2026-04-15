import { supabase } from "@/integrations/supabase/client";

export interface NijaV2Dossier {
  id: string;
  case_id: string;
  version: number;
  timeline_factual: any[];
  timeline_processual: any[];
  fato_prova_map: any[];
  lacunas_detectadas: any[];
  pedidos_estruturados: any[];
  resumo_tatico: any;
  documentos_utilizados: string[];
  created_at: string;
}

/**
 * Stage 1: Atomic Extraction per document
 */
export async function nijaExtractDoc(params: {
  documentId: string;
  caseId: string;
  rawText: string;
  officeId?: string;
}) {
  const { data, error } = await supabase.functions.invoke("nija-extract-doc", {
    body: {
      document_id: params.documentId,
      case_id: params.caseId,
      rawText: params.rawText,
      office_id: params.officeId,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Stages 2-7: Consolidation & Intelligence
 */
export async function nijaConsolidateDossier(params: {
  caseId: string;
  officeId?: string;
}): Promise<NijaV2Dossier> {
  const { data, error } = await supabase.functions.invoke("nija-consolidate-dossier", {
    body: {
      case_id: params.caseId,
      office_id: params.officeId,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Orchestrator: Runs the 9 stages sequence
 */
export async function runNijaV2Pipeline(params: {
  caseId: string;
  officeId: string;
  documents: Array<{ id: string; content: string }>;
  onProgress?: (stage: number, message: string) => void;
}): Promise<NijaV2Dossier> {
  const { caseId, officeId, documents, onProgress } = params;

  // 1. Stage 1: Atomic Extraction (Parallel)
  onProgress?.(1, `Extraindo dados de ${documents.length} documentos...`);
  await Promise.all(
    documents.map(doc => 
      nijaExtractDoc({
        documentId: doc.id,
        caseId,
        rawText: doc.content,
        officeId
      }).catch(err => {
        console.warn(`[NijaV2] Erro no documento ${doc.id}:`, err);
        return null;
      })
    )
  );

  // 2. Stages 2-7: Consolidation
  onProgress?.(2, "Consolidando inteligência jurídica e gerando timelines...");
  const dossier = await nijaConsolidateDossier({ caseId, officeId });

  onProgress?.(9, "Dossiê finalizado com sucesso.");
  return dossier;
}

/**
 * Maestro Orchestrator: Runs the FULL NIJA pipeline (Stages 1-9 + Judge IA + Feedback Loop)
 */
export async function runNijaMaestro(params: {
  caseId: string;
  onProgress?: (stage: number, message: string) => void;
  options?: {
    force_piece_type?: string;
    score_threshold?: number;
  };
}): Promise<any> {
  const { caseId, onProgress, options } = params;

  onProgress?.(1, "Iniciando Maetro: Orquestração do Pipeline Completo...");
  
  const { data, error } = await supabase.functions.invoke("nija-pipeline-orchestrator", {
    body: {
      case_id: caseId,
      options
    },
  });

  if (error) {
    console.error("[NIJA-MAESTRO] Orchestrator Error:", error);
    throw error;
  }

  onProgress?.(100, "Pipeline finalizado com sucesso.");
  return data;
}
