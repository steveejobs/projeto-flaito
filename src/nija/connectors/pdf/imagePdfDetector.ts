// src/lib/nija/imagePdfDetector.ts
// Detecta se um PDF é "imagem" (scanned) baseado na cobertura de texto

import type { ExtractionReport } from "@/nija/connectors/pdf/pdfClientExtractor";

/**
 * Limiares para detecção de PDF-imagem
 */
const IMAGE_PDF_THRESHOLDS = {
  // Cobertura mínima de páginas com texto
  MIN_COVERAGE_RATIO: 0.2,
  // Mínimo de caracteres por página (média) para considerar texto válido
  MIN_CHARS_PER_PAGE_AVG: 100,
  // Mínimo de caracteres totais
  MIN_CHARS_TOTAL: 500,
};

/**
 * Determina se um PDF é provavelmente uma imagem escaneada
 * baseado no relatório de extração
 */
export function isImagePdf(report: ExtractionReport | null | undefined): boolean {
  if (!report) return false;
  
  // Se não tem layer de texto, é definitivamente imagem
  if (!report.has_text_layer) return true;
  
  // Se coverage ratio é muito baixo
  if (report.coverage_ratio < IMAGE_PDF_THRESHOLDS.MIN_COVERAGE_RATIO) {
    return true;
  }
  
  // Se tem poucas chars por página em média
  const avgCharsPerPage = report.pages_processed > 0 
    ? report.chars_total / report.pages_processed 
    : 0;
  
  if (avgCharsPerPage < IMAGE_PDF_THRESHOLDS.MIN_CHARS_PER_PAGE_AVG) {
    return true;
  }
  
  // Se total de chars é muito baixo
  if (report.chars_total < IMAGE_PDF_THRESHOLDS.MIN_CHARS_TOTAL) {
    return true;
  }
  
  return false;
}

/**
 * Retorna uma descrição do motivo da classificação como PDF-imagem
 */
export function getImagePdfReason(report: ExtractionReport | null | undefined): string | null {
  if (!report) return null;
  
  if (!report.has_text_layer) {
    return "PDF sem camada de texto detectável";
  }
  
  if (report.coverage_ratio < IMAGE_PDF_THRESHOLDS.MIN_COVERAGE_RATIO) {
    return `Baixa cobertura de texto (${Math.round(report.coverage_ratio * 100)}% das páginas)`;
  }
  
  const avgCharsPerPage = report.pages_processed > 0 
    ? report.chars_total / report.pages_processed 
    : 0;
  
  if (avgCharsPerPage < IMAGE_PDF_THRESHOLDS.MIN_CHARS_PER_PAGE_AVG) {
    return `Poucos caracteres por página (média: ${Math.round(avgCharsPerPage)})`;
  }
  
  if (report.chars_total < IMAGE_PDF_THRESHOLDS.MIN_CHARS_TOTAL) {
    return `Total de caracteres muito baixo (${report.chars_total})`;
  }
  
  return null;
}
