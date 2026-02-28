/**
 * NIJA Fase 1: Extrator de PDF client-side usando PDF.js CDN
 * Constantes unificadas de src/nija/extraction/constants.ts
 */

import { supabase } from "@/integrations/supabase/client";
import { sanitizeForPostgresText, sanitizeJsonForPostgres } from "@/lib/sanitizeForPostgres";
import {
  MAX_PAGES,
  MAX_CHARS_PER_PAGE,
  MAX_TOTAL_CHARS,
  MIN_CHARS_TOTAL,
  MIN_COVERAGE_RATIO,
  CLIENT_TIMEOUT_MS,
} from "@/nija/extraction/constants";

export type ReadingStatus = "OK" | "TRUNCATED" | "INSUFFICIENT_READING" | "FALLBACK_CLIENT_PDFJS" | "ERROR" | "PENDING";

export interface ExtractionReport {
  total_pages: number;
  pages_processed: number;
  pages_with_text: number;
  coverage_ratio: number;
  chars_total: number;
  truncated: boolean;
  truncated_reason?: string;
  has_text_layer: boolean;
  processing_time_ms: number;
  method: "client_pdfjs" | "pdfjs_server" | "regex_fallback" | "text_file" | "legacy" | "vision_ocr";
}

export interface ExtractionResult {
  reading_status: ReadingStatus;
  extraction_report: ExtractionReport;
  extracted_text: string;
}

// Carregar PDF.js dinamicamente do CDN
async function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(pdfjsLib);
      } else {
        reject(new Error("PDF.js não foi carregado"));
      }
    };
    script.onerror = () => reject(new Error("Falha ao baixar PDF.js"));
    document.head.appendChild(script);
  });
}

/**
 * Extrai texto de um PDF via URL usando PDF.js no browser
 * @param url - URL do PDF
 * @param onProgress - Callback opcional para progresso (page, totalPages)
 */
export async function extractTextFromPdfUrl(
  url: string,
  onProgress?: (page: number, totalPages: number) => void
): Promise<ExtractionResult> {
  const startTime = Date.now();
  
  try {
    const pdfjsLib = await loadPdfJs();
    
    // Baixar o PDF
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao baixar PDF: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const numPages = pdf.numPages;
    const pagesToProcess = Math.min(numPages, MAX_PAGES);
    
    const textParts: string[] = [];
    let pagesWithText = 0;
    let totalChars = 0;
    
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      // Check timeout
      if (Date.now() - startTime > CLIENT_TIMEOUT_MS) {
        return {
          reading_status: "ERROR",
          extraction_report: {
            total_pages: numPages,
            pages_processed: pageNum - 1,
            pages_with_text: pagesWithText,
            coverage_ratio: numPages > 0 ? pagesWithText / numPages : 0,
            chars_total: totalChars,
            truncated: true,
            truncated_reason: "CLIENT_TIMEOUT: extração excedeu 60s",
            has_text_layer: totalChars >= 50,
            processing_time_ms: Date.now() - startTime,
            method: "client_pdfjs",
          },
          extracted_text: textParts.join("\n\n"),
        };
      }
      
      // Callback de progresso
      if (onProgress) {
        onProgress(pageNum, numPages);
      }
      
      try {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" ");
        
        const cleanedText = pageText.trim();
        
        if (cleanedText.length > 0) {
          pagesWithText++;
          // Limitar texto por página
          const limitedText = cleanedText.length > MAX_CHARS_PER_PAGE 
            ? cleanedText.substring(0, MAX_CHARS_PER_PAGE)
            : cleanedText;
          textParts.push(limitedText);
          totalChars += limitedText.length;
        }
        
        // Verificar limite total
        if (totalChars >= MAX_TOTAL_CHARS) {
          break;
        }
      } catch (pageError) {
        console.warn(`[pdfClientExtractor] Erro na página ${pageNum}:`, pageError);
      }
    }
    
    let extractedText = textParts.join("\n\n");
    let truncated = false;
    let truncatedReason: string | undefined;
    
    // Truncar se necessário
    if (extractedText.length > MAX_TOTAL_CHARS) {
      extractedText = extractedText.substring(0, MAX_TOTAL_CHARS);
      truncated = true;
      truncatedReason = `Texto truncado para ${MAX_TOTAL_CHARS} caracteres`;
    }
    
    if (numPages > MAX_PAGES) {
      truncated = true;
      truncatedReason = `Limitado a ${MAX_PAGES} páginas`;
    }
    
    const coverageRatio = numPages > 0 ? pagesWithText / numPages : 0;
    const hasTextLayer = extractedText.length >= 50;
    
    // Determinar status
    let readingStatus: ReadingStatus;
    if (extractedText.length < MIN_CHARS_TOTAL || coverageRatio < MIN_COVERAGE_RATIO) {
      readingStatus = "INSUFFICIENT_READING";
    } else if (truncated) {
      readingStatus = "TRUNCATED";
    } else {
      readingStatus = "OK";
    }
    
    const report: ExtractionReport = {
      total_pages: numPages,
      pages_processed: pagesToProcess,
      pages_with_text: pagesWithText,
      coverage_ratio: coverageRatio,
      chars_total: extractedText.length,
      truncated,
      truncated_reason: truncatedReason,
      has_text_layer: hasTextLayer,
      processing_time_ms: Date.now() - startTime,
      method: "client_pdfjs",
    };
    
    console.log(`[pdfClientExtractor] Extração concluída: status=${readingStatus}, chars=${report.chars_total}, pages=${pagesWithText}/${numPages}`);
    
    return {
      reading_status: readingStatus,
      extraction_report: report,
      extracted_text: extractedText,
    };
    
  } catch (error) {
    console.error("[pdfClientExtractor] Erro:", error);
    
    return {
      reading_status: "ERROR",
      extraction_report: {
        total_pages: 0,
        pages_processed: 0,
        pages_with_text: 0,
        coverage_ratio: 0,
        chars_total: 0,
        truncated: false,
        truncated_reason: error instanceof Error ? error.message : "Erro desconhecido",
        has_text_layer: false,
        processing_time_ms: Date.now() - startTime,
        method: "client_pdfjs",
      },
      extracted_text: "",
    };
  }
}

/**
 * Extrai texto de um File (PDF) usando PDF.js
 * @param file - Arquivo PDF
 * @param onProgress - Callback opcional para progresso (page, totalPages)
 */
export async function extractTextFromPdfFile(
  file: File,
  onProgress?: (page: number, totalPages: number) => void
): Promise<ExtractionResult> {
  const startTime = Date.now();
  
  try {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const numPages = pdf.numPages;
    const pagesToProcess = Math.min(numPages, MAX_PAGES);
    
    const textParts: string[] = [];
    let pagesWithText = 0;
    let totalChars = 0;
    
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      // Check timeout (CLIENT_TIMEOUT_MS = 60s)
      if (Date.now() - startTime > CLIENT_TIMEOUT_MS) {
        return {
          reading_status: "ERROR",
          extraction_report: {
            total_pages: numPages,
            pages_processed: pageNum - 1,
            pages_with_text: pagesWithText,
            coverage_ratio: numPages > 0 ? pagesWithText / numPages : 0,
            chars_total: totalChars,
            truncated: true,
            truncated_reason: "CLIENT_TIMEOUT: extração excedeu 60s",
            has_text_layer: totalChars >= 50,
            processing_time_ms: Date.now() - startTime,
            method: "client_pdfjs",
          },
          extracted_text: textParts.join("\n\n"),
        };
      }
      
      // Callback de progresso
      if (onProgress) {
        onProgress(pageNum, numPages);
      }
      
      try {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" ");
        
        const cleanedText = pageText.trim();
        
        if (cleanedText.length > 0) {
          pagesWithText++;
          const limitedText = cleanedText.length > MAX_CHARS_PER_PAGE 
            ? cleanedText.substring(0, MAX_CHARS_PER_PAGE)
            : cleanedText;
          textParts.push(limitedText);
          totalChars += limitedText.length;
        }
        
        if (totalChars >= MAX_TOTAL_CHARS) {
          break;
        }
      } catch (pageError) {
        console.warn(`[pdfClientExtractor] Erro na página ${pageNum}:`, pageError);
      }
    }
    
    let extractedText = textParts.join("\n\n");
    let truncated = false;
    let truncatedReason: string | undefined;
    
    if (extractedText.length > MAX_TOTAL_CHARS) {
      extractedText = extractedText.substring(0, MAX_TOTAL_CHARS);
      truncated = true;
      truncatedReason = `Texto truncado para ${MAX_TOTAL_CHARS} caracteres`;
    }
    
    if (numPages > MAX_PAGES) {
      truncated = true;
      truncatedReason = `Limitado a ${MAX_PAGES} páginas`;
    }
    
    const coverageRatio = numPages > 0 ? pagesWithText / numPages : 0;
    const hasTextLayer = extractedText.length >= 50;
    
    let readingStatus: ReadingStatus;
    if (extractedText.length < MIN_CHARS_TOTAL || coverageRatio < MIN_COVERAGE_RATIO) {
      readingStatus = "INSUFFICIENT_READING";
    } else if (truncated) {
      readingStatus = "TRUNCATED";
    } else {
      readingStatus = "OK";
    }
    
    return {
      reading_status: readingStatus,
      extraction_report: {
        total_pages: numPages,
        pages_processed: pagesToProcess,
        pages_with_text: pagesWithText,
        coverage_ratio: coverageRatio,
        chars_total: extractedText.length,
        truncated,
        truncated_reason: truncatedReason,
        has_text_layer: hasTextLayer,
        processing_time_ms: Date.now() - startTime,
        method: "client_pdfjs",
      },
      extracted_text: extractedText,
    };
    
  } catch (error) {
    console.error("[pdfClientExtractor] Erro:", error);
    
    return {
      reading_status: "ERROR",
      extraction_report: {
        total_pages: 0,
        pages_processed: 0,
        pages_with_text: 0,
        coverage_ratio: 0,
        chars_total: 0,
        truncated: false,
        truncated_reason: error instanceof Error ? error.message : "Erro desconhecido",
        has_text_layer: false,
        processing_time_ms: Date.now() - startTime,
        method: "client_pdfjs",
      },
      extracted_text: "",
    };
  }
}

/**
 * Salva o resultado da extração no banco de dados
 */
export async function saveExtractionToDatabase(
  documentId: string,
  result: ExtractionResult
): Promise<void> {
  // Sanitize text and report before persisting (prevents Postgres 22P05 error)
  const sanitizedText = sanitizeForPostgresText(result.extracted_text);
  const sanitizedReport = sanitizeJsonForPostgres({
    total_pages: result.extraction_report.total_pages,
    pages_processed: result.extraction_report.pages_processed,
    pages_with_text: result.extraction_report.pages_with_text,
    coverage_ratio: result.extraction_report.coverage_ratio,
    chars_total: sanitizedText.length, // Recalculate after sanitization
    truncated: result.extraction_report.truncated,
    truncated_reason: result.extraction_report.truncated_reason,
    has_text_layer: result.extraction_report.has_text_layer,
    processing_time_ms: result.extraction_report.processing_time_ms,
    method: result.extraction_report.method,
  });

  const { error } = await supabase.from("documents").update({
    extracted_text: sanitizedText,
    reading_status: result.reading_status,
    extraction_report: sanitizedReport,
    extracted_text_chars: sanitizedText.length,
    extracted_pages_total: sanitizedReport.total_pages,
    extracted_pages_with_text: sanitizedReport.pages_with_text,
    extracted_coverage_ratio: sanitizedReport.coverage_ratio,
    extraction_method: sanitizedReport.method,
    extraction_updated_at: new Date().toISOString(),
  }).eq("id", documentId);

  if (error) {
    console.error("[pdfClientExtractor] Erro ao salvar no banco:", error);
    throw error;
  }

  console.log(`[pdfClientExtractor] Documento ${documentId} salvo no banco`);
}

/**
 * Verifica se um documento pode ser analisado pela NIJA
 */
export function canAnalyzeDocument(readingStatus: ReadingStatus | null): boolean {
  return readingStatus === "OK" || readingStatus === "TRUNCATED";
}

/**
 * Verifica se todos os documentos de um conjunto podem ser analisados
 */
export function canAnalyzeDocuments(documents: Array<{ reading_status: string | null }>): boolean {
  if (!documents || documents.length === 0) return false;
  return documents.every(doc => canAnalyzeDocument(doc.reading_status as ReadingStatus | null));
}

/**
 * Retorna o motivo pelo qual a análise está bloqueada
 */
export function getBlockingReason(documents: Array<{ reading_status: string | null; filename?: string }>): string | null {
  const blocked = documents.filter(doc => !canAnalyzeDocument(doc.reading_status as ReadingStatus | null));
  
  if (blocked.length === 0) return null;
  
  const pendingDocs = blocked.filter(d => d.reading_status === "PENDING" || !d.reading_status);
  const insufficientDocs = blocked.filter(d => d.reading_status === "INSUFFICIENT_READING");
  const errorDocs = blocked.filter(d => d.reading_status === "ERROR");
  const fallbackDocs = blocked.filter(d => d.reading_status === "FALLBACK_CLIENT_PDFJS");
  
  const reasons: string[] = [];
  
  if (pendingDocs.length > 0) {
    reasons.push(`${pendingDocs.length} documento(s) aguardando extração`);
  }
  if (insufficientDocs.length > 0) {
    reasons.push(`${insufficientDocs.length} documento(s) com leitura insuficiente`);
  }
  if (errorDocs.length > 0) {
    reasons.push(`${errorDocs.length} documento(s) com erro de leitura`);
  }
  if (fallbackDocs.length > 0) {
    reasons.push(`${fallbackDocs.length} documento(s) precisam reprocessamento`);
  }
  
  return reasons.join("; ");
}
