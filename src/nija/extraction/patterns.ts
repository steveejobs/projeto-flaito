// src/nija/extraction/patterns.ts
// EPROC Regex Patterns - Single source of truth for all extraction patterns

/**
 * EPROC/TJTO Extraction Patterns
 * Centralized regex constants for EPROC document extraction
 * 
 * Architecture:
 * - BASE patterns: atomic building blocks (date, event number, etc.)
 * - COMPOSITE patterns: combinations for specific use cases
 * - UTILITIES: helper functions for normalization and validation
 */

// === ACCENT-TOLERANT CHARACTER CLASSES ===
const A = "[ÁAáa]";
const C = "[ÇCçc]";
const A_NASAL = "[ÃAãa]";
const E_ACUTE = "[ÉEée]";
const I_ACUTE = "[ÍIíi]";
const O_ACUTE = "[ÓOóo]";
const U_ACUTE = "[ÚUúu]";

// === BASE PATTERNS (atomic building blocks) ===
export const PATTERNS = {
  // "PÁGINA DE SEPARAÇÃO" keyword (accent-tolerant)
  SEPARADOR_KEYWORD: new RegExp(`P${A}GINA\\s+DE\\s+SEPARA${C}${A_NASAL}O`, "gi"),
  
  // Date: DD/MM/YYYY (day 1-2 digits, month 1-2 digits, year 2-4 digits)
  DATE: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
  
  // Time: HH:MM:SS or HH:MM
  TIME: /(\d{2}:\d{2}(?::\d{2})?)/,
  
  // Date with optional time: DD/MM/YYYY HH:MM:SS
  DATE_TIME: /(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/,
  
  // Event number: "Evento 1", "Evento: 35", "# Evento 1"
  EVENT_NUM: /(?:#\s*)?Evento[:\s]+(\d+)/i,
  
  // Event type: "Evento: DISTRIBUIDO_POR_SORTEIO" (uppercase with underscores)
  // CORREÇÃO: Excluir "Data" e outros labels de campo do match
  EVENT_TYPE: /Evento:\s*([A-Z][A-Z0-9_]{2,})(?!\s*:)/i,
  
  // Peça code: "INIC1", "CONTR5", "DAJ7", "PROC2" (letters + optional digits)
  PECA_CODE: /([A-Z][A-Z0-9_]*\d*)/,
  
  // CNJ number: 0000000-00.0000.0.00.0000 (flexible separators)
  CNJ: /(\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4})/,
  
  // Process number with tribunal suffix: 0014085-38.2016.8.27.2706/TO
  PROCESSO_COMPLETO: /([\d.-]+\/[A-Z]{2})/,
  
  // User/responsible: "Usuário: TO04867A - RENATO CHAGAS"
  USUARIO: new RegExp(`Usu${A}rio:\\s*([^\\n]+)`, "i"),
  
  // Page number: "Página 1", "Pagina 1"
  PAGINA: new RegExp(`P${A}gina\\s+(\\d+)`, "i"),
} as const;

// === COMPOSITE PATTERNS (for specific extraction tasks) ===
export const EPROC = {
  /**
   * Header em linha única (formato padrão EPROC)
   * "Processo 0014085-38.2016.8.27.2706/TO, Evento 1, INIC1, Página 6"
   * 
   * Grupos: [1]=processo, [2]=eventNum, [3]=codigoPeca, [4]=pagina
   */
  HEADER_LINHA: new RegExp(
    `Processo\\s+([\\d.-]+\\/[A-Z]+),\\s*Evento\\s+(\\d+),?\\s*([A-Z][A-Z0-9_]*\\d*),?\\s*P${A}gina\\s*(\\d+)`,
    "gi"
  ),
  
  /**
   * Header em bloco (formato OCR com markdown #)
   * # Processo 0014085-38.2016.8.27.2706/TO
   * # Evento 1
   * # PROC2
   * Página 1
   * 
   * Grupos: [1]=processo, [2]=eventNum, [3]=codigoPeca, [4]=pagina
   */
  HEADER_BLOCO: new RegExp(
    `#?\\s*Processo\\s+([\\d.-]+\\/[A-Z]+)[\\s\\n]+` +
    `#?\\s*Evento\\s+(\\d+)[\\s\\n]+` +
    `#?\\s*([A-Z][A-Z0-9_]*\\d*)[\\s\\n]+` +
    `#?\\s*P${A}gina\\s+(\\d+)`,
    "gi"
  ),
  
  /**
   * Bloco completo da PÁGINA DE SEPARAÇÃO
   * Captura: número do evento, tipo, data, hora, usuário
   * 
   * Grupos: [1]=eventNum, [2]=tipo, [3]=data, [4]=hora, [5]=usuario
   * 
   * CORREÇÃO: Regex mais flexível com limites de caracteres e suporte a números no tipo
   */
  SEPARADOR_COMPLETO: new RegExp(
    `P${A}GINA\\s+DE\\s+SEPARA${C}${A_NASAL}O` +
    `[\\s\\S]{0,500}?(?:#\\s*)?Evento\\s+(\\d+)` +         // Grupo 1: número do evento (limite 500 chars)
    `[\\s\\S]{0,300}?Evento:\\s*([A-Z][A-Z0-9_]*)` +       // Grupo 2: tipo (aceita números, ex: CITACAO1)
    `[\\s\\S]{0,300}?Data:\\s*(\\d{1,2}\\/\\d{1,2}\\/\\d{4})` + // Grupo 3: data
    `(?:\\s*(\\d{2}:\\d{2}(?::\\d{2})?))?` +               // Grupo 4: hora (opcional, aceita HH:MM ou HH:MM:SS)
    `(?:[\\s\\S]{0,400}?Usu${A}rio:\\s*([^\\n]+))?`,       // Grupo 5: usuário (opcional)
    "gi"
  ),
  
  /**
   * Separador simples (para fallback - encontra blocos individuais)
   */
  SEPARADOR_BLOCK: new RegExp(
    `P${A}GINA\\s+DE\\s+SEPARA${C}${A_NASAL}O[\\s\\S]*?(?=P${A}GINA\\s+DE\\s+SEPARA${C}${A_NASAL}O|$)`,
    "gi"
  ),
  
  /**
   * Evento genérico (fallback para documentos não-EPROC)
   * "Evento 1" seguido de conteúdo até próximo evento
   */
  EVENTO_GENERICO: /Evento\s+(\d+)[^\n]*\n([\s\S]*?)(?=Evento\s+\d+|$)/gi,
  
  /**
   * Data dentro de contexto: "Data: DD/MM/YYYY HH:MM:SS"
   */
  DATA_LABEL: /Data:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*(\d{2}:\d{2}:\d{2})?/i,
} as const;

// === VALIDATION UTILITIES ===

/**
 * Validate date components - rejects impossible dates from OCR errors
 */
export function isValidDateComponents(day: number, month: number, year: number): boolean {
  if (!day || !month || !year) return false;
  if (day < 1 || day > 31) return false;
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > 2100) return false;
  
  // Check days in month (with leap year support)
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) {
    daysInMonth[1] = 29;
  }
  if (day > daysInMonth[month - 1]) return false;
  
  return true;
}

/**
 * Validate and normalize date from OCR text
 * Returns null for invalid dates, normalized DD/MM/YYYY for valid ones
 */
export function validateAndNormalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  const match = dateStr.match(PATTERNS.DATE);
  if (!match) return null;
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);
  
  // Handle 2-digit years (50+ = 1900s, <50 = 2000s)
  if (year < 100) {
    year = year > 50 ? 1900 + year : 2000 + year;
  }
  
  if (!isValidDateComponents(day, month, year)) {
    console.warn(`[patterns] Invalid date rejected: ${dateStr} (d=${day}, m=${month}, y=${year})`);
    return null;
  }
  
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/**
 * Parse date string DD/MM/YYYY to timestamp
 */
export function parseLocalDateToTimestamp(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return 0;
  const [, day, month, year] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
}

// === TEXT NORMALIZATION ===

/**
 * Normalize judicial text before regex extraction
 * - Removes word hyphenation at line breaks
 * - Normalizes whitespace
 * - Preserves meaningful line breaks
 */
export function normalizeJudicialText(raw: string): string {
  if (!raw) return "";
  
  // Remove word hyphenation at line breaks: "peti-\nção" => "petição"
  let normalized = raw.replace(/(\w)-\n(\w)/g, "$1$2");
  normalized = normalized.replace(/(\w)-\r\n(\w)/g, "$1$2");
  normalized = normalized.replace(/(\w)-\r(\w)/g, "$1$2");
  
  // Normalize multiple spaces to single space
  normalized = normalized.replace(/[ \t]+/g, " ");
  
  // Normalize multiple line breaks to max 2
  normalized = normalized.replace(/(\r?\n){3,}/g, "\n\n");
  
  // Remove trailing spaces on each line
  normalized = normalized.replace(/ +$/gm, "");
  
  return normalized;
}

/**
 * Normalize event text per EPROC spec
 * - Remove visual duplicate numbering
 * - Adjust spacing
 * - Standardize dates (format only)
 * 
 * FORBIDDEN: classify, evaluate impact, infer consequences
 */
export function normalizeEventText(text: string): string {
  if (!text) return "";
  
  // Replace special whitespace chars with regular space
  let normalized = text.replace(/[\u2028\u2029\u000b\t]/g, " ");
  
  // Collapse multiple spaces into one
  normalized = normalized.replace(/\s{2,}/g, " ");
  
  // Remove duplicate numbering at start (e.g., "1  1  16/03/2018" → "1 16/03/2018")
  normalized = normalized.replace(/^(\d+)\s+\1\s+/, "$1 ");
  
  return normalized.trim();
}

// === EXTRACTION HELPERS ===

/**
 * Data structure for PÁGINA DE SEPARAÇÃO extraction
 */
export interface SeparadorData {
  tipoEvento: string;
  data: string | null;
  hora: string | null;
  usuario: string | null;
}

/**
 * Data structure for grouped peças by event
 */
export interface PecaAgrupada {
  codigo: string;
  paginaMax: number;
  primeiraOcorrencia: number;
}

/**
 * Extract PÁGINA DE SEPARAÇÃO data from normalized text
 * Returns Map<eventNum, SeparadorData>
 */
export function extractSeparadorData(normalizedText: string): Map<number, SeparadorData> {
  const map = new Map<number, SeparadorData>();
  
  // Reset regex lastIndex for fresh iteration
  const pattern = new RegExp(EPROC.SEPARADOR_COMPLETO.source, EPROC.SEPARADOR_COMPLETO.flags);
  
  for (const match of normalizedText.matchAll(pattern)) {
    const eventNum = parseInt(match[1], 10);
    if (!map.has(eventNum)) {
      map.set(eventNum, {
        tipoEvento: match[2],
        data: validateAndNormalizeDate(match[3]),
        hora: match[4] || null,
        usuario: match[5]?.trim() || null,
      });
    }
  }
  
  return map;
}

/**
 * Extract and group peças from EPROC headers
 * Uses both HEADER_LINHA and HEADER_BLOCO patterns
 * Returns Map<eventNum, Array<PecaAgrupada>>
 */
export function extractPecasFromHeaders(normalizedText: string): Map<number, PecaAgrupada[]> {
  const map = new Map<number, PecaAgrupada[]>();
  
  // Collect all matches from both patterns
  const linhaPattern = new RegExp(EPROC.HEADER_LINHA.source, EPROC.HEADER_LINHA.flags);
  const blocoPattern = new RegExp(EPROC.HEADER_BLOCO.source, EPROC.HEADER_BLOCO.flags);
  
  const allMatches: Array<RegExpExecArray> = [];
  
  let m: RegExpExecArray | null;
  while ((m = linhaPattern.exec(normalizedText)) !== null) {
    allMatches.push(m);
  }
  while ((m = blocoPattern.exec(normalizedText)) !== null) {
    allMatches.push(m);
  }
  
  // Group peças by event number
  for (const match of allMatches) {
    const eventNum = parseInt(match[2], 10);
    const codigoPeca = match[3].toUpperCase();
    const pagina = parseInt(match[4], 10);
    const idx = match.index ?? 0;
    
    if (!map.has(eventNum)) {
      map.set(eventNum, []);
    }
    
    const pecas = map.get(eventNum)!;
    const existing = pecas.find(p => p.codigo === codigoPeca);
    
    if (existing) {
      existing.paginaMax = Math.max(existing.paginaMax, pagina);
    } else {
      pecas.push({ codigo: codigoPeca, paginaMax: pagina, primeiraOcorrencia: idx });
    }
  }
  
  // Sort peças by order of appearance in document
  for (const [, pecas] of map) {
    pecas.sort((a, b) => a.primeiraOcorrencia - b.primeiraOcorrencia);
  }
  
  return map;
}

/**
 * Search for date in context block (fallback when separador not found)
 */
export function extractDateFromContext(contextBlock: string): { data: string | null; hora: string | null } {
  const dataMatch = contextBlock.match(EPROC.DATA_LABEL);
  if (dataMatch) {
    return {
      data: validateAndNormalizeDate(dataMatch[1]),
      hora: dataMatch[2] || null,
    };
  }
  return { data: null, hora: null };
}

/**
 * Search for event type in context block
 */
export function extractEventTypeFromContext(contextBlock: string): string | null {
  const tipoMatch = contextBlock.match(PATTERNS.EVENT_TYPE);
  return tipoMatch ? tipoMatch[1] : null;
}
