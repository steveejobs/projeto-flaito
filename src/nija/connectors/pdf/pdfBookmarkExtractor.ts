/**
 * NIJA PDF Bookmark Extractor
 * Extracts document structure from PDF bookmarks/outlines
 * Provides precise event/document mapping for EPROC/TJTO PDFs
 */

import { type DocumentNature } from "@/nija/extraction/eventSegments";

// ============================================================
// TYPES
// ============================================================

export interface PdfBookmark {
  title: string;
  pageNumber: number;
  level: number;
  children: PdfBookmark[];
}

export interface EprocDocumentBookmark {
  eventoNumero: number;
  docNumero: number;
  tipoDocumento: string;       // "PROCURAÇÃO AUTOR", "EDITAL", "DECISÃO/DESPACHO"
  tipoDocumentoNormalizado: DocumentNature;
  pageStart: number;
  pageEnd: number | null;      // null if unknown (last document)
  pageCount: number | null;
  cnj?: string;
  isCapa: boolean;
  raw: string;                 // Original bookmark title
}

export interface BookmarkExtractionResult {
  cnj: string | null;
  documentos: EprocDocumentBookmark[];
  totalPages: number;
  hasBookmarks: boolean;
  capaPage: number | null;
  capaPageEnd: number | null;  // End page of capa (for multi-page covers)
  processoTitle: string | null;
}

// ============================================================
// DOCUMENT TYPE MAPPING
// ============================================================

/**
 * Maps EPROC document types to standardized DocumentNature
 * Available types: peticao, decisao, comunicacao, prova, sistemico, procuracao, anexo
 */
const TIPO_TO_NATURE: Record<string, DocumentNature> = {
  // Petições
  "PETIÇÃO INICIAL": "peticao",
  "PETIÇÃO": "peticao",
  "CONTESTAÇÃO": "peticao",
  "RÉPLICA": "peticao",
  "RESPOSTA": "peticao",
  "IMPUGNAÇÃO": "peticao",
  "EMBARGOS": "peticao",
  "AGRAVO": "peticao",
  "RECURSO": "peticao",
  "APELAÇÃO": "peticao",
  
  // Procurações
  "PROCURAÇÃO": "procuracao",
  "PROCURAÇÃO AUTOR": "procuracao",
  "PROCURAÇÃO RÉU": "procuracao",
  "SUBSTABELECIMENTO": "procuracao",
  
  // Decisões (sentença e acórdão também são decisão)
  "DECISÃO": "decisao",
  "DESPACHO": "decisao",
  "DECISÃO/DESPACHO": "decisao",
  "SENTENÇA": "decisao",
  "ACÓRDÃO": "decisao",
  
  // Comunicações
  "INTIMAÇÃO": "comunicacao",
  "CITAÇÃO": "comunicacao",
  "EDITAL": "comunicacao",
  "MANDADO": "comunicacao",
  "CARTA": "comunicacao",
  "OFÍCIO": "comunicacao",
  "NOTIFICAÇÃO": "comunicacao",
  
  // Provas (inclui cálculos e documentos)
  "COMPROVANTE": "prova",
  "COMPROVANTE DE RESIDÊNCIA": "prova",
  "DOCUMENTO": "prova",
  "LAUDO": "prova",
  "PARECER": "prova",
  "PERÍCIA": "prova",
  "FICHA INDIVIDUAL": "prova",
  "EXTRATO": "prova",
  "CONTRATO": "prova",
  "CÁLCULO": "prova",
  "PLANILHA": "prova",
  "DEMONSTRATIVO": "prova",
  
  // Anexos genéricos
  "ANEXO": "anexo",
  "OUTROS": "anexo",
};

/**
 * Normalizes document type to DocumentNature
 */
function mapTipoToNature(tipo: string): DocumentNature {
  const upperTipo = (tipo || "").toUpperCase().trim();
  
  // Direct match
  if (TIPO_TO_NATURE[upperTipo]) {
    return TIPO_TO_NATURE[upperTipo];
  }
  
  // Partial match
  for (const [key, nature] of Object.entries(TIPO_TO_NATURE)) {
    if (upperTipo.includes(key) || key.includes(upperTipo)) {
      return nature;
    }
  }
  
  // Fallback
  return "anexo";
}

// ============================================================
// PDF.JS LOADER (Same as pdfClientExtractor)
// ============================================================

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

// ============================================================
// PARSING HELPERS
// ============================================================

/**
 * Extracts CNJ from bookmark title
 * Pattern: "PROCESSO 0025960-87.2025.8.27.2706"
 */
function extractCnjFromTitle(title: string): string | null {
  const match = title.match(/(\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4})/);
  return match ? match[1] : null;
}

/**
 * Parses event bookmark title
 * Pattern: "Evento 5 - Doc. 1 - DECISÃO/DESPACHO"
 * Also handles: "Evento 1 - Doc. 2 - PROCURAÇÃO AUTOR"
 */
function parseEventoBookmark(title: string): { eventoNumero: number; docNumero: number; tipoDocumento: string } | null {
  // Pattern: Evento N - Doc. M - TIPO (with optional page info)
  const match = title.match(/Evento\s*(\d+)\s*[-–]\s*Doc\.?\s*(\d+)\s*[-–]\s*(.+?)(?:\s*\(Pág\.?\s*\d+(?:[-–]\d+)?\))?$/i);
  
  if (match) {
    return {
      eventoNumero: parseInt(match[1], 10),
      docNumero: parseInt(match[2], 10),
      tipoDocumento: match[3].trim(),
    };
  }
  
  return null;
}

/**
 * Checks if bookmark is a process cover page
 */
function isCapaBookmark(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("capa do processo") || 
         lower.includes("capa processual") ||
         (lower.includes("processo") && !lower.includes("eventos") && !lower.includes("evento"));
}

// ============================================================
// MAIN EXTRACTION FUNCTION
// ============================================================

/**
 * Extracts bookmarks from a PDF file
 */
export async function extractBookmarksFromPdfFile(
  file: File
): Promise<BookmarkExtractionResult> {
  const startTime = Date.now();
  
  try {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    const outline = await pdf.getOutline();
    
    if (!outline || outline.length === 0) {
      console.log("[pdfBookmarkExtractor] PDF sem bookmarks");
      return {
        cnj: null,
        documentos: [],
        totalPages,
        hasBookmarks: false,
        capaPage: null,
        capaPageEnd: null,
        processoTitle: null,
      };
    }
    
    console.log(`[pdfBookmarkExtractor] Encontrados ${outline.length} bookmarks de nível raiz`);
    
    const documentos: EprocDocumentBookmark[] = [];
    let cnj: string | null = null;
    let capaPage: number | null = null;
    let capaPageEnd: number | null = null;
    let processoTitle: string | null = null;
    
    // Process bookmarks recursively
    const allBookmarkTitles: string[] = [];
    
    const processBookmark = async (item: any, level: number = 0) => {
      const title = item.title || "";
      
      // LOG: Capture all bookmark titles for analysis
      if (title) {
        allBookmarkTitles.push(`[${"  ".repeat(level)}L${level}] ${title}`);
      }
      
      // Try to extract CNJ from root-level bookmarks
      if (level === 0 && !cnj) {
        cnj = extractCnjFromTitle(title);
        if (cnj) {
          processoTitle = title;
        }
      }
      
      // Get page number for this bookmark
      let pageNumber: number | null = null;
      if (item.dest) {
        try {
          let destArray = item.dest;
          
          // If dest is a string, resolve it
          if (typeof destArray === "string") {
            destArray = await pdf.getDestination(destArray);
          }
          
          if (Array.isArray(destArray) && destArray[0]) {
            const pageRef = destArray[0];
            const pageIndex = await pdf.getPageIndex(pageRef);
            pageNumber = pageIndex + 1; // PDF.js uses 0-based index
          }
        } catch (err) {
          console.warn("[pdfBookmarkExtractor] Erro ao resolver página:", title, err);
        }
      }
      
      // Check if this is a capa
      if (isCapaBookmark(title) && pageNumber !== null) {
        capaPage = pageNumber;
        documentos.push({
          eventoNumero: 0,
          docNumero: 0,
          tipoDocumento: "CAPA DO PROCESSO",
          tipoDocumentoNormalizado: "anexo",
          pageStart: pageNumber,
          pageEnd: null,
          pageCount: null,
          isCapa: true,
          raw: title,
        });
      }
      
      // Try to parse as event bookmark
      const parsed = parseEventoBookmark(title);
      if (parsed && pageNumber !== null) {
        documentos.push({
          eventoNumero: parsed.eventoNumero,
          docNumero: parsed.docNumero,
          tipoDocumento: parsed.tipoDocumento,
          tipoDocumentoNormalizado: mapTipoToNature(parsed.tipoDocumento),
          pageStart: pageNumber,
          pageEnd: null,
          pageCount: null,
          isCapa: false,
          raw: title,
        });
      }
      
      // Process children
      if (item.items && item.items.length > 0) {
        for (const child of item.items) {
          await processBookmark(child, level + 1);
        }
      }
    };
    
    // Process all root bookmarks
    for (const item of outline) {
      await processBookmark(item, 0);
    }
    
    // LOG: Show all bookmark titles for debugging
    console.log(`[pdfBookmarkExtractor] TODOS OS BOOKMARKS (${allBookmarkTitles.length}):`);
    allBookmarkTitles.forEach(t => console.log(t));
    
    // Sort by page number
    documentos.sort((a, b) => a.pageStart - b.pageStart);
    
    // Calculate pageEnd for each document (next document's pageStart - 1)
    for (let i = 0; i < documentos.length; i++) {
      const current = documentos[i];
      const next = documentos[i + 1];
      
      if (next) {
        current.pageEnd = next.pageStart - 1;
        current.pageCount = current.pageEnd - current.pageStart + 1;
      } else {
        // Last document goes until end of PDF
        current.pageEnd = totalPages;
        current.pageCount = totalPages - current.pageStart + 1;
      }
    }
    
    // Calculate capaPageEnd from capa document if exists
    const capaDoc = documentos.find(d => d.isCapa);
    if (capaDoc && capaDoc.pageEnd) {
      capaPageEnd = capaDoc.pageEnd;
    }
    
    console.log(`[pdfBookmarkExtractor] Extração concluída: ${documentos.length} documentos, CNJ: ${cnj}, capa: ${capaPage}-${capaPageEnd}, tempo: ${Date.now() - startTime}ms`);
    
    return {
      cnj,
      documentos,
      totalPages,
      hasBookmarks: true,
      capaPage,
      capaPageEnd,
      processoTitle,
    };
    
  } catch (error) {
    console.error("[pdfBookmarkExtractor] Erro:", error);
    return {
      cnj: null,
      documentos: [],
      totalPages: 0,
      hasBookmarks: false,
      capaPage: null,
      capaPageEnd: null,
      processoTitle: null,
    };
  }
}

/**
 * Extracts bookmarks from a PDF URL
 */
export async function extractBookmarksFromPdfUrl(
  url: string
): Promise<BookmarkExtractionResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    
    const blob = await response.blob();
    const file = new File([blob], "document.pdf", { type: "application/pdf" });
    
    return extractBookmarksFromPdfFile(file);
  } catch (error) {
    console.error("[pdfBookmarkExtractor] Erro ao baixar PDF:", error);
    return {
      cnj: null,
      documentos: [],
      totalPages: 0,
      hasBookmarks: false,
      capaPage: null,
      capaPageEnd: null,
      processoTitle: null,
    };
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Groups documents by event number
 */
export function groupDocumentsByEvento(
  documentos: EprocDocumentBookmark[]
): Map<number, EprocDocumentBookmark[]> {
  const grouped = new Map<number, EprocDocumentBookmark[]>();
  
  for (const doc of documentos) {
    const existing = grouped.get(doc.eventoNumero) || [];
    existing.push(doc);
    grouped.set(doc.eventoNumero, existing);
  }
  
  return grouped;
}

/**
 * Gets document at a specific page
 */
export function getDocumentAtPage(
  documentos: EprocDocumentBookmark[],
  pageNumber: number
): EprocDocumentBookmark | null {
  for (const doc of documentos) {
    if (doc.pageEnd !== null) {
      if (pageNumber >= doc.pageStart && pageNumber <= doc.pageEnd) {
        return doc;
      }
    } else if (pageNumber >= doc.pageStart) {
      return doc;
    }
  }
  return null;
}

/**
 * Gets all unique document types from bookmarks
 */
export function getUniqueDocumentTypes(
  documentos: EprocDocumentBookmark[]
): string[] {
  const types = new Set<string>();
  for (const doc of documentos) {
    types.add(doc.tipoDocumento);
  }
  return Array.from(types).sort();
}

/**
 * Counts documents by type
 */
export function countDocumentsByType(
  documentos: EprocDocumentBookmark[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const doc of documentos) {
    counts[doc.tipoDocumentoNormalizado] = (counts[doc.tipoDocumentoNormalizado] || 0) + 1;
  }
  return counts;
}
