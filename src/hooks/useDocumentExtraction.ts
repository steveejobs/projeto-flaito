/**
 * NIJA Fase 1: Hook para orquestrar extração de documentos
 * Server-side → Client-side fallback → Persistência
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  extractTextFromPdfUrl, 
  saveExtractionToDatabase,
  type ExtractionResult,
  type ReadingStatus
} from "@/nija";

export interface DocumentForExtraction {
  id: string;
  storage_path: string;
  filename: string;
  mime_type?: string;
  reading_status?: string | null;
}

export interface UseDocumentExtractionResult {
  extractDocument: (doc: DocumentForExtraction) => Promise<ExtractionResult>;
  extractDocuments: (docs: DocumentForExtraction[]) => Promise<ExtractionResult[]>;
  isExtracting: boolean;
  progress: { current: number; total: number };
}

export function useDocumentExtraction(): UseDocumentExtractionResult {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  /**
   * Obtém URL assinada para download do documento
   */
  const getSignedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("createSignedDownloadUrl", {
        body: { path: storagePath },
      });

      if (error || !data?.signedUrl) {
        console.error("[useDocumentExtraction] Erro ao obter URL assinada:", error);
        return null;
      }

      return data.signedUrl;
    } catch (err) {
      console.error("[useDocumentExtraction] Erro:", err);
      return null;
    }
  }, []);

  /**
   * Extrai texto de um único documento
   * 1. Tenta server-side (lexos-extract-text)
   * 2. Se FALLBACK_CLIENT_PDFJS → usa PDF.js no browser
   * 3. Salva resultado no banco
   */
  const extractDocument = useCallback(async (doc: DocumentForExtraction): Promise<ExtractionResult> => {
    console.log(`[useDocumentExtraction] Iniciando extração: ${doc.filename}`);

    // Obter URL assinada
    const signedUrl = await getSignedUrl(doc.storage_path);
    if (!signedUrl) {
      const errorResult: ExtractionResult = {
        reading_status: "ERROR",
        extraction_report: {
          total_pages: 0,
          pages_processed: 0,
          pages_with_text: 0,
          coverage_ratio: 0,
          chars_total: 0,
          truncated: false,
          truncated_reason: "Não foi possível obter URL do documento",
          has_text_layer: false,
          processing_time_ms: 0,
          method: "client_pdfjs",
        },
        extracted_text: "",
      };
      
      try {
        await saveExtractionToDatabase(doc.id, errorResult);
      } catch {}
      
      return errorResult;
    }

    try {
      // 1. Tentar extração server-side
      const { data: serverResult, error: serverError } = await supabase.functions.invoke(
        "lexos-extract-text",
        {
          body: {
            url: signedUrl,
            filename: doc.filename,
            document_id: doc.id,
          },
        }
      );

      if (serverError) {
        console.warn("[useDocumentExtraction] Erro server-side:", serverError);
        throw new Error("Fallback to client");
      }

      const result = serverResult as ExtractionResult;

      // 2. Se servidor retornou FALLBACK_CLIENT_PDFJS, usar PDF.js no browser
      if (result.reading_status === "FALLBACK_CLIENT_PDFJS") {
        console.log(`[useDocumentExtraction] Usando fallback client-side para: ${doc.filename}`);
        
        const clientResult = await extractTextFromPdfUrl(signedUrl);
        
        // Salvar resultado client-side no banco
        await saveExtractionToDatabase(doc.id, clientResult);
        
        return clientResult;
      }

      // Server já salvou no banco se OK/TRUNCATED
      return result;

    } catch (error) {
      console.log(`[useDocumentExtraction] Fallback client-side para: ${doc.filename}`);
      
      // Fallback: extração client-side
      try {
        const clientResult = await extractTextFromPdfUrl(signedUrl);
        await saveExtractionToDatabase(doc.id, clientResult);
        return clientResult;
      } catch (clientError) {
        console.error("[useDocumentExtraction] Erro client-side:", clientError);
        
        const errorResult: ExtractionResult = {
          reading_status: "ERROR",
          extraction_report: {
            total_pages: 0,
            pages_processed: 0,
            pages_with_text: 0,
            coverage_ratio: 0,
            chars_total: 0,
            truncated: false,
            truncated_reason: clientError instanceof Error ? clientError.message : "Erro desconhecido",
            has_text_layer: false,
            processing_time_ms: 0,
            method: "client_pdfjs",
          },
          extracted_text: "",
        };
        
        try {
          await saveExtractionToDatabase(doc.id, errorResult);
        } catch {}
        
        return errorResult;
      }
    }
  }, [getSignedUrl]);

  /**
   * Extrai texto de múltiplos documentos em sequência
   */
  const extractDocuments = useCallback(async (docs: DocumentForExtraction[]): Promise<ExtractionResult[]> => {
    setIsExtracting(true);
    setProgress({ current: 0, total: docs.length });

    const results: ExtractionResult[] = [];

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      setProgress({ current: i + 1, total: docs.length });

      const result = await extractDocument(doc);
      results.push(result);
    }

    setIsExtracting(false);
    setProgress({ current: 0, total: 0 });

    return results;
  }, [extractDocument]);

  return {
    extractDocument,
    extractDocuments,
    isExtracting,
    progress,
  };
}

/**
 * Verifica se documentos de um caso precisam de extração
 */
export async function getDocumentsNeedingExtraction(caseId: string): Promise<DocumentForExtraction[]> {
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, storage_path, filename, mime_type, reading_status")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .in("reading_status", ["PENDING", "FALLBACK_CLIENT_PDFJS", null]);

  if (error) {
    console.error("[getDocumentsNeedingExtraction] Erro:", error);
    return [];
  }

  return (documents || []).map(doc => ({
    id: doc.id,
    storage_path: doc.storage_path,
    filename: doc.filename,
    mime_type: doc.mime_type,
    reading_status: doc.reading_status,
  }));
}

/**
 * Busca status de leitura dos documentos de um caso
 */
export async function getCaseDocumentsReadingStatus(caseId: string): Promise<{
  documents: Array<{
    id: string;
    filename: string;
    reading_status: ReadingStatus | null;
    extracted_text_chars: number;
    extraction_report: any;
  }>;
  canAnalyze: boolean;
  blockingReason: string | null;
}> {
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, filename, reading_status, extracted_text_chars, extraction_report")
    .eq("case_id", caseId)
    .is("deleted_at", null);

  if (error) {
    console.error("[getCaseDocumentsReadingStatus] Erro:", error);
    return { documents: [], canAnalyze: false, blockingReason: "Erro ao buscar documentos" };
  }

  const docs = (documents || []).map(doc => ({
    id: doc.id,
    filename: doc.filename,
    reading_status: doc.reading_status as ReadingStatus | null,
    extracted_text_chars: doc.extracted_text_chars || 0,
    extraction_report: doc.extraction_report,
  }));

  // Verificar se pode analisar
  const canAnalyze = docs.length > 0 && docs.every(d => 
    d.reading_status === "OK" || d.reading_status === "TRUNCATED"
  );

  // Motivo do bloqueio
  let blockingReason: string | null = null;
  if (docs.length === 0) {
    blockingReason = "Nenhum documento encontrado";
  } else if (!canAnalyze) {
    const pending = docs.filter(d => !d.reading_status || d.reading_status === "PENDING");
    const insufficient = docs.filter(d => d.reading_status === "INSUFFICIENT_READING");
    const errors = docs.filter(d => d.reading_status === "ERROR");
    const fallback = docs.filter(d => d.reading_status === "FALLBACK_CLIENT_PDFJS");

    const reasons: string[] = [];
    if (pending.length > 0) reasons.push(`${pending.length} aguardando extração`);
    if (insufficient.length > 0) reasons.push(`${insufficient.length} com leitura insuficiente`);
    if (errors.length > 0) reasons.push(`${errors.length} com erro`);
    if (fallback.length > 0) reasons.push(`${fallback.length} precisam reprocessamento`);

    blockingReason = reasons.join("; ");
  }

  return { documents: docs, canAnalyze, blockingReason };
}
