/**
 * EPROC Detector
 * Detecção de sistema e extração de dados estruturados de documentos EPROC.
 * Usa os helpers centralizados de src/nija/extraction/patterns.ts.
 */

import type { EprocExtractionResult, EprocEventoExtraido, DetectedProcessSystem } from "@/types/nija-contracts";
import type { BookmarkExtractionResult } from "@/nija/connectors/pdf/pdfBookmarkExtractor";
import {
  normalizeJudicialText,
  extractSeparadorData,
  extractPecasFromHeaders,
  PATTERNS,
  EPROC,
} from "@/nija/extraction/patterns";

export type { DetectedProcessSystem };

// =====================================================
// System Detection
// =====================================================

/**
 * Detects whether the text comes from an EPROC process or another system.
 * Searches the first 5000 characters for EPROC-specific markers.
 */
export const detectProcessSystemFromText = (text: string): DetectedProcessSystem => {
  if (!text) return "UNKNOWN";

  const sample = text.substring(0, 5000);
  const upper = sample.toUpperCase();

  // EPROC markers: "PÁGINA DE SEPARAÇÃO" (with or without accents) or EPROC inline header
  const hasPageSeparador =
    upper.includes("PÁGINA DE SEPARAÇÃO") ||
    upper.includes("PAGINA DE SEPARACAO");

  // Use a local instance to avoid mutating the shared global regex lastIndex
  const hasEprocHeader = new RegExp(EPROC.HEADER_LINHA.source, EPROC.HEADER_LINHA.flags).test(sample);

  if (hasPageSeparador || hasEprocHeader) {
    return "EPROC";
  }

  return "UNKNOWN";
};

// =====================================================
// EPROC Extraction
// =====================================================

const PLACEHOLDER = "Não identificado nos documentos analisados";

/**
 * Extracts structured data from raw EPROC text.
 * Uses centralized regex patterns from src/nija/extraction/patterns.ts.
 *
 * @param text - Raw text extracted from the PDF
 * @param bookmarkResult - Optional bookmark data from PDF (used for event boundaries)
 */
export const extractEprocDataPure = (
  text: string,
  bookmarkResult?: BookmarkExtractionResult | null
): EprocExtractionResult => {
  if (!text || !text.trim()) {
    return buildEmptyResult();
  }

  const normalizedText = normalizeJudicialText(text);

  // --- CAPA: Extract process number ---
  const cnjMatch = normalizedText.match(PATTERNS.CNJ);
  const numeroCnj = cnjMatch ? cnjMatch[1] : PLACEHOLDER;

  // Use bookmark CNJ as fallback if available and regex failed
  const finalCnj =
    numeroCnj !== PLACEHOLDER
      ? numeroCnj
      : bookmarkResult?.cnj ?? PLACEHOLDER;

  // --- EVENTOS: Extract from "Página de Separação" blocks ---
  const separadorMap = extractSeparadorData(normalizedText);
  const pecasMap = extractPecasFromHeaders(normalizedText);

  const eventos: EprocEventoExtraido[] = [];

  for (const [eventNum, sep] of separadorMap) {
    const pecasForEvent = pecasMap.get(eventNum) ?? [];

    eventos.push({
      numeroEvento: eventNum,
      data: sep.data ?? "Não identificado",
      hora: sep.hora,
      tipoEvento: sep.tipoEvento,
      descricaoLiteral: sep.tipoEvento,
      documentoVinculado: pecasForEvent[0]?.codigo ?? null,
      codigoTjto: null,
      labelEnriquecido: null,
      usuarioRegistro: sep.usuario,
      pecasAnexas: pecasForEvent.map((p) => ({
        codigo: p.codigo,
        paginas: p.paginaMax,
      })),
      source: "REGEX_TEXT",
      confidence: sep.data ? "HIGH" : "LOW",
    });
  }

  // Sort by event number ascending
  eventos.sort((a, b) => (a.numeroEvento ?? 0) - (b.numeroEvento ?? 0));

  // --- Merge bookmark-based events if available ---
  // EprocDocumentBookmark fields: eventoNumero, tipoDocumento, raw, pageStart/pageEnd
  if (bookmarkResult?.hasBookmarks && bookmarkResult.documentos.length > 0) {
    // Add bookmark events not already captured by regex
    for (const doc of bookmarkResult.documentos) {
      if (
        typeof doc.eventoNumero === "number" &&
        !separadorMap.has(doc.eventoNumero)
      ) {
        eventos.push({
          numeroEvento: doc.eventoNumero,
          data: "Não identificado", // bookmarks do not carry event dates
          hora: null,
          tipoEvento: doc.tipoDocumento ?? "DESCONHECIDO",
          descricaoLiteral: doc.raw ?? doc.tipoDocumento ?? "Documento",
          documentoVinculado: doc.tipoDocumento ?? null,
          codigoTjto: null,
          labelEnriquecido: doc.raw ?? null,
          usuarioRegistro: null,
          pageStart: doc.pageStart,
          pageEnd: doc.pageEnd ?? null,
          source: "PDF_BOOKMARK",
          confidence: "HIGH",
        });
      }
    }

    // Re-sort after merge
    eventos.sort((a, b) => (a.numeroEvento ?? 0) - (b.numeroEvento ?? 0));
  }

  // --- Quality assessment ---
  const withDate = eventos.filter(
    (e) => e.data && e.data !== "Não identificado"
  ).length;
  const datePercentage =
    eventos.length > 0 ? (withDate / eventos.length) * 100 : 0;
  const extractionQuality: "ALTA" | "MEDIA" | "BAIXA" =
    datePercentage > 70 ? "ALTA" : datePercentage > 40 ? "MEDIA" : "BAIXA";

  return {
    capa: {
      numeroCnj: finalCnj,
      classeAcao: PLACEHOLDER,
      varaJuizo: PLACEHOLDER,
      comarca: PLACEHOLDER,
      situacaoProcessual: PLACEHOLDER,
      dataAutuacao: PLACEHOLDER,
      orgaoJulgador: PLACEHOLDER,
      juiz: PLACEHOLDER,
      assuntos: [],
      tipoAcao: PLACEHOLDER,
    },
    peticaoInicial: {
      autores: [],
      reus: [],
      pedidos: [],
      causaDePedir: "",
      valorDaCausa: "",
      fundamentosLegaisCitados: [],
      datasDeFatosNarrados: [],
      autoresDetalhados: [],
      reusDetalhados: [],
    },
    advogado: {
      nome: PLACEHOLDER,
      oab: PLACEHOLDER,
      formatado: PLACEHOLDER,
      oabs: [],
      emCausaPropria: false,
    },
    eventos,
    pecasPosteriores: [],
    meta: {
      dataExtracao: new Date().toISOString(),
      totalEventos: eventos.length,
      totalPecas: 0,
      camposAusentes: [],
      extractionQuality,
      datePercentage,
    },
  };
};

// =====================================================
// Helpers
// =====================================================

function buildEmptyResult(): EprocExtractionResult {
  return {
    capa: {
      numeroCnj: PLACEHOLDER,
      classeAcao: PLACEHOLDER,
      varaJuizo: PLACEHOLDER,
      comarca: PLACEHOLDER,
      situacaoProcessual: PLACEHOLDER,
      dataAutuacao: PLACEHOLDER,
      orgaoJulgador: PLACEHOLDER,
      juiz: PLACEHOLDER,
      assuntos: [],
      tipoAcao: PLACEHOLDER,
    },
    peticaoInicial: {
      autores: [],
      reus: [],
      pedidos: [],
      causaDePedir: "",
      valorDaCausa: "",
      fundamentosLegaisCitados: [],
      datasDeFatosNarrados: [],
      autoresDetalhados: [],
      reusDetalhados: [],
    },
    advogado: {
      nome: PLACEHOLDER,
      oab: PLACEHOLDER,
      formatado: PLACEHOLDER,
      oabs: [],
      emCausaPropria: false,
    },
    eventos: [],
    pecasPosteriores: [],
    meta: {
      dataExtracao: new Date().toISOString(),
      totalEventos: 0,
      totalPecas: 0,
      camposAusentes: [],
      extractionQuality: "BAIXA",
      datePercentage: 0,
    },
  };
}
