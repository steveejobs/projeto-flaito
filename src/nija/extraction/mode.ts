// src/nija/extraction/mode.ts
// NIJA Extraction Mode - Types and helpers for EPROC extraction-only mode

// Import centralized patterns and utilities
import {
  EPROC,
  PATTERNS,
  validateAndNormalizeDate,
  parseLocalDateToTimestamp,
  normalizeJudicialText,
  normalizeEventText,
  extractSeparadorData,
  extractPecasFromHeaders,
  extractDateFromContext,
  extractEventTypeFromContext,
  type SeparadorData,
  type PecaAgrupada,
} from "./patterns";

// Import bookmark types for integration
import type { BookmarkExtractionResult, EprocDocumentBookmark } from "@/nija/connectors/pdf/pdfBookmarkExtractor";
import { getTjtoFromTipoDoc } from "./tipoDocToTjto";

/**
 * NIJA Operation Modes:
 * - EXTRACTION_ONLY: Pure EPROC extraction without AI interpretation
 * - NIJA_ANALYSIS: Full AI-powered legal analysis
 */
export type NijaOperationMode = "EXTRACTION_ONLY" | "NIJA_ANALYSIS";

/**
 * Extracted data structure for EPROC extraction-only mode
 * All fields are literal extractions from documents - no AI interpretation
 */
// OAB entry type for multiple lawyers
export type OabEntry = { nome: string; oabUf: string; oabNumero: string };

// Assunto processual (tema)
export interface AssuntoProcessual {
  codigo: string;
  descricao: string;
  principal: boolean;
}

// Advogado/Procurador de uma parte
export interface ProcuradorExtraido {
  nome: string;
  oab: string;
}

// Parte com CPF/CNPJ e advogados
export interface ParteExtraida {
  nome: string;
  documento?: string; // CPF or CNPJ
  tipo?: "PF" | "PJ";
  procuradores?: ProcuradorExtraido[];
}

export interface EprocExtractionResult {
  // === CAPA DO PROCESSO (página inicial) ===
  capa: {
    numeroCnj: string;
    classeAcao: string;
    varaJuizo: string;
    comarca: string;
    situacaoProcessual: string;
    // Novos campos - Fase 2
    dataAutuacao: string;
    orgaoJulgador: string;
    juiz: string;
    assuntos: AssuntoProcessual[];
    tipoAcao: string;
    // Novos campos - Fase 3 (Informações Adicionais)
    chaveProcesso: string;
    justicaGratuita: boolean;
    prioridadeAtendimento: boolean;
    segredoJustica: boolean;
    nivelSigilo: string;
    processosApensos: string[];
    antecipacaoTutela: boolean;
    peticaoUrgente: boolean;
    vistaMinisterioPublico: boolean;
  };

  // === PETIÇÃO INICIAL / PARTES ===
  peticaoInicial: {
    autores: string[];
    reus: string[];
    partesNeutras?: string; // When parties can't be classified as autor/réu
    pedidos: string[];
    causaDePedir: string;
    valorDaCausa: string;
    fundamentosLegaisCitados: string[];
    datasDeFatosNarrados: string[];
    // Novos campos - Fase 2
    autoresDetalhados: ParteExtraida[];
    reusDetalhados: ParteExtraida[];
  };

  // === ADVOGADO (formato: Nome — OAB XXXXXX) ===
  advogado: {
    nome: string;
    oab: string;
    formatado: string; // "Nome — OAB XX 12345"
    oabs: OabEntry[]; // All extracted OABs
    emCausaPropria: boolean;
  };

  // === EVENTOS PROCESSUAIS (TIMELINE EPROC) ===
  eventos: EprocEventoExtraido[];

  // === PEÇAS POSTERIORES ===
  pecasPosteriores: EprocPecaExtraida[];

  // === METADADOS ===
  meta: {
    dataExtracao: string;
    totalEventos: number;
    totalPecas: number;
    camposAusentes: string[];
    // Quality metrics (DEFINITIVE ARCHITECTURE)
    extractionQuality?: "ALTA" | "MEDIA" | "BAIXA";
    ordemSuspeita?: boolean;
    datePercentage?: number;
  };
}

export interface EprocEventoExtraido {
  numeroEvento: number | null;
  data: string;
  hora: string | null; // hh:mm:ss when present
  tipoEvento: string;
  descricaoLiteral: string;
  documentoVinculado: string | null;
  codigoTjto: string | null;
  labelEnriquecido: string | null;
  // Phase 4: New fields for complete event info
  usuarioRegistro?: string | null;
  pecasAnexas?: Array<{
    codigo: string;      // "INIC1", "CONTR5"
    paginas: number;     // Total pages
    label?: string;      // "Petição Inicial" (via TJTO dictionary)
  }>;
  // Phase 5: Bookmark-derived metadata
  pageStart?: number;
  pageEnd?: number | null;
  source?: "PDF_BOOKMARK" | "REGEX_TEXT";
  confidence?: "HIGH" | "MEDIUM" | "LOW";
}

export interface EprocPecaExtraida {
  tipo: "CONTESTACAO" | "REPLICA" | "RESPOSTA" | "DECISAO" | "SENTENCA" | "OUTROS";
  nomeEvento: string;
  documentoAssociado: string;
  textoIntegral: string;
  data: string;
  parteQueApresentou: string;
}

/**
 * Placeholder for fields not found in documents
 */
export const PLACEHOLDER_NAO_IDENTIFICADO = "Não identificado nos documentos analisados";

/**
 * Mandatory closing phrase for extraction-only mode
 */
export const FRASE_FINAL_EXTRACAO = 
  "Os dados acima foram extraídos exclusivamente dos documentos analisados, sem interpretação ou inferência automática.";

/**
 * Initialize empty extraction result with proper placeholders
 */
// Helper: normalize name for comparison
function normalizeName(s: string): string {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// Valid Brazilian state codes for OAB
const VALID_UF_CODES = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]);

// Fase 1: Filter false-positive OABs (CEPs, short numbers, etc.)
function isValidOabNumber(num: string, contextAround: string = ""): boolean {
  if (!num) return false;
  // Must be 3-6 digits
  if (num.length < 3 || num.length > 6) return false;
  // Check if it looks like a CEP context (5 digits + hyphen + 3 digits nearby)
  if (/\d{5}[-]?\d{3}/.test(contextAround)) {
    // If the number matches a CEP pattern position, reject
    const cepMatch = contextAround.match(/(\d{5})[-]?(\d{3})/);
    if (cepMatch && (cepMatch[1] === num || cepMatch[2] === num || cepMatch[1] + cepMatch[2] === num)) {
      return false;
    }
  }
  // Check if it looks like a page number or CNPJ fragment
  if (/P[áa]gina\s*\d+|CNPJ|\/\d{4}/i.test(contextAround)) {
    return false;
  }
  return true;
}

// Extract all OABs from text (pattern: NOME SOBRENOME ... TO009810 or TO04867A)
export function extractOabsFromText(raw: string): OabEntry[] {
  const out: OabEntry[] = [];
  const seen = new Set<string>();

  const upper = normalizeName(raw);

  // Pattern 1: NAME followed by lawyer context + UF+NUMBER (3-6 digits) + optional suffix letter
  // Requires lawyer context (ADVOGADO, PROCURADOR, OAB, /TO, etc.) to avoid false positives
  const pattern1 = /([A-ZÀ-Ú][A-ZÀ-Ú\s'.-]{3,}?)\s+(?:-\s*)?(?:ADVOGADO|PROCURADOR|OAB|\/TO|\/[A-Z]{2})?.{0,25}?\b([A-Z]{2})(\d{3,6})([A-Z])?\b/g;
  
  let m: RegExpExecArray | null;
  while ((m = pattern1.exec(upper)) !== null) {
    const nome = (m[1] || "").trim();
    const uf = (m[2] || "").trim();
    const num = (m[3] || "").trim(); // Only the digits, ignore suffix letter
    
    if (!nome || !uf || !num) continue;
    if (!VALID_UF_CODES.has(uf)) continue; // Must be valid Brazilian UF
    // Fase 1: Extra validation
    const contextStart = Math.max(0, m.index - 30);
    const contextEnd = Math.min(upper.length, m.index + m[0].length + 30);
    const context = upper.slice(contextStart, contextEnd);
    if (!isValidOabNumber(num, context)) continue;
    // Extra validation: nome must look like a person name (at least 2 words)
    if (nome.split(/\s+/).length < 2) continue;

    const key = `${uf}${num}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ nome, oabUf: uf, oabNumero: num });
  }

  // Pattern 2: OAB/XX 12345 format (without name) - requires 3-6 digits
  const pattern2 = /OAB[:\s/]*([A-Z]{2})[:\s/]*(\d{3,6})/gi;
  while ((m = pattern2.exec(raw)) !== null) {
    const uf = (m[1] || "").toUpperCase().trim();
    const num = (m[2] || "").trim();
    
    if (!uf || !num) continue;
    if (!VALID_UF_CODES.has(uf)) continue;
    // Fase 1: Extra validation
    const contextStart = Math.max(0, m.index - 30);
    const contextEnd = Math.min(raw.length, m.index + m[0].length + 30);
    const context = raw.slice(contextStart, contextEnd);
    if (!isValidOabNumber(num, context)) continue;

    const key = `${uf}${num}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ nome: "", oabUf: uf, oabNumero: num });
  }

  return out;
}

// Extract parties with proper classification
export function extractPartiesEproc(raw: string): {
  autores?: string;
  reus?: string;
  partesNeutras?: string;
  autoresDetalhados?: ParteExtraida[];
  reusDetalhados?: ParteExtraida[];
} {
  const t = raw;

  const norm = (s: string) =>
    (s || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:])/g, "$1")
      .trim();

  // Detect narrative paragraphs (like INIC1 page 2) to avoid false positives
  const looksLikeNarrative = (s: string) => {
    const x = norm(s);
    if (!x) return true;
    if (x.length > 180) return true; // too long = paragraph, not a name
    if (/\bR\$\s*\d|\d{2}\/\d{2}\/\d{4}|\bprest(a|ã)o|\binadimpl|vencimento antecipado|instrumento particular|confiss[aã]o de d[ií]vida/i.test(x)) return true;
    if (!/[A-ZÀ-Ú]{3,}/i.test(x)) return true; // needs letters (name)
    return false;
  };

  const pickLine = (re: RegExp) => {
    const m = t.match(re);
    return m && m[1] ? norm(m[1]) : null;
  };

  const autoresDetalhados: ParteExtraida[] = [];
  const reusDetalhados: ParteExtraida[] = [];

  // ==============================================================
  // Strategy F: EPROC "Partes e Representantes" table format (Vision OCR)
  // IMPROVED v2: Handle side-by-side columns where AUTOR and RÉU labels
  // are on the same line, and parties/lawyers below are interleaved
  // ==============================================================
  const partesRepresentantesMatch = t.match(
    /Partes\s+e\s+Representantes\s*([\s\S]*?)(?:Informa[çc][õo]es\s+Adicionais|Valor\s+da\s+Causa|Movimenta[çc][õo]es|$)/i
  );

  if (partesRepresentantesMatch) {
    const block = partesRepresentantesMatch[1];
    
    // Find position of party labels in the block (expanded to include all types)
    const autorLabelMatch = block.match(/\b(?:AUTOR|IMPETRANTE|EXEQUENTE|REQUERENTE|DEPRECANTE)\b/i);
    const reuLabelMatch = block.match(/\b(?:R[ÉE]U|IMPETRADO|EXECUTADO|REQUERIDO|DEPRECADO)\b/i);
    const autorLabelPos = autorLabelMatch ? block.indexOf(autorLabelMatch[0]) : -1;
    const reuLabelPos = reuLabelMatch ? block.indexOf(reuLabelMatch[0]) : -1;
    
    // Detect if party labels are on the SAME LINE (side-by-side table format)
    // In this case, position-based classification doesn't work well
    const lineWithLabels = block.slice(0, Math.min(block.indexOf('\n', Math.max(autorLabelPos, reuLabelPos) + 1), 200));
    // Check for AUTOR|RÉU OR DEPRECANTE|DEPRECADO OR IMPETRANTE|IMPETRADO etc
    const labelsOnSameLine = autorLabelPos >= 0 && reuLabelPos >= 0 && 
      Math.abs(autorLabelPos - reuLabelPos) < 100 &&
      /\b(?:AUTOR|IMPETRANTE|EXEQUENTE|REQUERENTE|DEPRECANTE)\b.*\b(?:R[ÉE]U|IMPETRADO|EXECUTADO|REQUERIDO|DEPRECADO)\b|\b(?:R[ÉE]U|IMPETRADO|EXECUTADO|REQUERIDO|DEPRECADO)\b.*\b(?:AUTOR|IMPETRANTE|EXEQUENTE|REQUERENTE|DEPRECANTE)\b/i.test(lineWithLabels);
    
    console.log(`[extractPartiesEproc] Strategy F: AUTOR-type@${autorLabelPos}, RÉU-type@${reuLabelPos}, sameLine=${labelsOnSameLine}`);
    
    // Extract all people with CPF: "NOME (XXX.XXX.XXX-XX) - Pessoa Física"
    const pessoasFisicas = [...block.matchAll(
      /([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s*\((\d{3}\.\d{3}\.\d{3}-\d{2})\)\s*-?\s*[\n\r]*\s*Pessoa\s+F[íi]sica/gi
    )];
    
    // Extract companies with CNPJ
    const pessoasJuridicas = [...block.matchAll(
      /([A-ZÀ-Ú][A-ZÀ-Ú\s.\/]+?)\s*\((\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\)\s*-?\s*[\n\r]*\s*Pessoa\s+Jur[íi]dica/gi
    )];
    
    // Extract Procuradores: "NOME   XX999999" format
    // IMPORTANT: Exclude "PESSOA FISICA", "PESSOA JURIDICA" which are NOT lawyer names
    const procuradoresRaw = [...block.matchAll(
      /(?:Procurador(?:es)?[:\s]*)?([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s+([A-Z]{2})(\d{5,7}[A-Z]?)/gi
    )].filter(m => !/^\s*PESSOA\s+(?:F[íi]sica|Jur[íi]dica)/i.test(m[1]));
    
    // Also match DPU/Defensoria pattern: "NOME (DPU)   DP9089195"
    const dpuAdvogados = [...block.matchAll(
      /([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s*\(DPU?\)\s+(?:DP)?(\d{5,10})/gi
    )].filter(m => !/^\s*PESSOA\s+(?:F[íi]sica|Jur[íi]dica)/i.test(m[1]));
    
    // Collect all procuradores with positions
    const todosProcuradores: Array<{ nome: string; oab: string; pos: number; fullMatch: string }> = [];
    
    for (const m of procuradoresRaw) {
      const posInBlock = block.indexOf(m[0]);
      const nomeLimpo = m[1].trim().replace(/\s+/g, " ");
      if (nomeLimpo.length < 4) continue;
      // Skip if it looks like a party name (followed by CPF/CNPJ pattern)
      if (/\(\d{3}\.\d{3}/.test(block.slice(posInBlock, posInBlock + m[0].length + 30))) continue;
      
      todosProcuradores.push({
        nome: nomeLimpo,
        oab: `${m[2]}${m[3]}`,
        pos: posInBlock,
        fullMatch: m[0]
      });
    }
    
    for (const m of dpuAdvogados) {
      const posInBlock = block.indexOf(m[0]);
      const nomeLimpo = m[1].trim().replace(/\s+/g, " ");
      if (nomeLimpo.length < 4) continue;
      
      todosProcuradores.push({
        nome: nomeLimpo,
        oab: `DPU${m[2]}`,
        pos: posInBlock,
        fullMatch: m[0]
      });
    }
    
    // Collect all parties with their positions
    const todasPartes: Array<{ nome: string; doc: string; tipo: "PF" | "PJ"; pos: number; endPos: number }> = [];
    
    for (const m of pessoasFisicas) {
      const posInBlock = block.indexOf(m[0]);
      const endPos = posInBlock + m[0].length;
      const afterMatch = block.slice(endPos, endPos + 50);
      
      // Skip if immediately followed by OAB pattern INLINE (these are lawyers mistaken as parties)
      // BUT do NOT skip if followed by "Procurador(es):" which is a section header
      // The difference: "NOME (CPF) TO12345" = lawyer inline vs "NOME (CPF) Procurador(es):" = party followed by section
      if (/^\s*[A-Z]{2}\s*\d{4,6}[A-Z]?/i.test(afterMatch)) continue;
      if (/^\s*OAB\s*[A-Z]{0,2}\s*\d{4,6}/i.test(afterMatch)) continue;
      
      // Clean ALL labels from the beginning - INCLUDING IMPETRANTE/IMPETRADO, DEPRECANTE/DEPRECADO
      const nomeLimpo = m[1]
        .trim()
        .replace(/^(?:(?:IMPETRANTE|IMPETRADO|DEPRECANTE|DEPRECADO|AUTOR|R[ÉE]U|REU|REQUERENTE|REQUERIDO|EXEQUENTE|EXECUTADO|APELANTE|APELADO|RECLAMANTE|RECLAMADO|PRINCIPAL|SIM|NAO|NÃO|DESCRI[ÇC][ÃA]O|CODIGO|CÓDIGO|ATIVO|PASSIVO)\s*)+/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      
      if (nomeLimpo.length < 4) continue;
      
      todasPartes.push({
        nome: nomeLimpo,
        doc: m[2],
        tipo: "PF",
        pos: posInBlock,
        endPos
      });
    }
    
    for (const m of pessoasJuridicas) {
      const posInBlock = block.indexOf(m[0]);
      const endPos = posInBlock + m[0].length;
      const afterMatch = block.slice(endPos, endPos + 50);
      
      // Same fix: only skip OAB inline patterns, not section headers
      if (/^\s*[A-Z]{2}\s*\d{4,6}[A-Z]?/i.test(afterMatch)) continue;
      if (/^\s*OAB\s*[A-Z]{0,2}\s*\d{4,6}/i.test(afterMatch)) continue;
      
      const nomeLimpo = m[1]
        .trim()
        .replace(/^(?:(?:IMPETRANTE|IMPETRADO|DEPRECANTE|DEPRECADO|AUTOR|R[ÉE]U|REU|REQUERENTE|REQUERIDO|EXEQUENTE|EXECUTADO|APELANTE|APELADO|RECLAMANTE|RECLAMADO|PRINCIPAL|SIM|NAO|NÃO|DESCRI[ÇC][ÃA]O|CODIGO|CÓDIGO|ATIVO|PASSIVO)\s*)+/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      
      if (nomeLimpo.length < 4) continue;
      
      todasPartes.push({
        nome: nomeLimpo,
        doc: m[2],
        tipo: "PJ",
        pos: posInBlock,
        endPos
      });
    }
    
    // Sort by position in text
    todasPartes.sort((a, b) => a.pos - b.pos);
    todosProcuradores.sort((a, b) => a.pos - b.pos);
    
    // ===================================================================
    // NEW v2: Use "Procurador(es):" label as boundary between parties
    // In EPROC tables, structure is typically:
    //   AUTOR column: Party1, DPU/Adv, Party2...
    //   RÉU column: Party3, Procurador(es): Adv1, Adv2...
    // The "Procurador(es):" label appears only for RÉUs in the merged text
    // ===================================================================
    const procuradorLabelPos = block.search(/Procurador(?:es)?[:\s]/i);
    
    // Helper: find procuradores that belong to a party
    const findProcuradoresForParte = (parteIndex: number): ProcuradorExtraido[] => {
      const parte = todasPartes[parteIndex];
      const nextParte = todasPartes[parteIndex + 1];
      const startPos = parte.endPos;
      const endPos = nextParte ? nextParte.pos : Infinity;
      
      return todosProcuradores
        .filter(p => p.pos > startPos && p.pos < endPos)
        .map(p => ({ nome: p.nome, oab: p.oab }));
    };
    
    if (todasPartes.length > 0) {
      // ===================================================================
      // IMPROVED CLASSIFICATION v3:
      // In side-by-side EPROC tables, the OCR reads columns interleaved.
      // Structure: AUTOR col (Party1, DPU) | RÉU col (Party2, Procurador(es): Advs)
      // OCR output: Party1, DPU, Party2, Procurador(es): Advs
      //
      // KEY INSIGHT: The "Procurador(es):" label marks lawyers for the PARTY
      // immediately BEFORE it (usually the last RÉU), NOT a boundary.
      // 
      // For 2-party cases with side-by-side labels:
      // - First party = AUTOR
      // - Second party = RÉU
      // - DPU after first party = AUTOR's representative
      // - Procurador(es) after second party = RÉU's lawyers
      // ===================================================================
      
      if (labelsOnSameLine && todasPartes.length === 2) {
        // Two parties with side-by-side labels: first=AUTOR, second=RÉU
        // Find DPU (goes to AUTOR) and Procuradores (go to RÉU)
        const autorDpuProcs: ProcuradorExtraido[] = todosProcuradores
          .filter(p => p.pos > todasPartes[0].endPos && p.pos < todasPartes[1].pos)
          .map(p => ({ nome: p.nome, oab: p.oab }));
        
        const reuProcs: ProcuradorExtraido[] = todosProcuradores
          .filter(p => p.pos > todasPartes[1].endPos)
          .map(p => ({ nome: p.nome, oab: p.oab }));
        
        autoresDetalhados.push({
          nome: todasPartes[0].nome,
          documento: todasPartes[0].doc,
          tipo: todasPartes[0].tipo,
          procuradores: autorDpuProcs.length > 0 ? autorDpuProcs : undefined
        });
        reusDetalhados.push({
          nome: todasPartes[1].nome,
          documento: todasPartes[1].doc,
          tipo: todasPartes[1].tipo,
          procuradores: reuProcs.length > 0 ? reuProcs : undefined
        });
        
        console.log(`[extractPartiesEproc] v3 Two-party: AUTOR="${todasPartes[0].nome}" (${autorDpuProcs.length} procs), RÉU="${todasPartes[1].nome}" (${reuProcs.length} procs)`);
      } else if (labelsOnSameLine && todasPartes.length > 2) {
        // Multiple parties: use "Procurador(es):" as boundary between AUTORs and RÉUs
        console.log(`[extractPartiesEproc] v3 Multi-party: Using Procurador(es) label at ${procuradorLabelPos} as boundary`);
        
        for (let i = 0; i < todasPartes.length; i++) {
          const parte = todasPartes[i];
          const procuradores = findProcuradoresForParte(i);
          
          // Party is AUTOR if it appears before the "Procurador(es):" section
          if (procuradorLabelPos > 0 && parte.pos < procuradorLabelPos) {
            autoresDetalhados.push({
              nome: parte.nome,
              documento: parte.doc,
              tipo: parte.tipo,
              procuradores: procuradores.length > 0 ? procuradores : undefined
            });
          } else {
            reusDetalhados.push({
              nome: parte.nome,
              documento: parte.doc,
              tipo: parte.tipo,
              procuradores: procuradores.length > 0 ? procuradores : undefined
            });
          }
        }
      } else if (labelsOnSameLine) {
        // Exactly 2 parties with side-by-side labels: first=AUTOR, second=RÉU
        const proc0 = findProcuradoresForParte(0);
        const proc1 = findProcuradoresForParte(1);
        
        autoresDetalhados.push({
          nome: todasPartes[0].nome,
          documento: todasPartes[0].doc,
          tipo: todasPartes[0].tipo,
          procuradores: proc0.length > 0 ? proc0 : undefined
        });
        reusDetalhados.push({
          nome: todasPartes[1].nome,
          documento: todasPartes[1].doc,
          tipo: todasPartes[1].tipo,
          procuradores: proc1.length > 0 ? proc1 : undefined
        });
      } else if (autorLabelPos >= 0 && reuLabelPos > autorLabelPos && !labelsOnSameLine) {
        // Labels on different lines: use position relative to RÉU label
        for (let i = 0; i < todasPartes.length; i++) {
          const parte = todasPartes[i];
          const procuradores = findProcuradoresForParte(i);
          
          if (parte.pos < reuLabelPos) {
            autoresDetalhados.push({
              nome: parte.nome,
              documento: parte.doc,
              tipo: parte.tipo,
              procuradores: procuradores.length > 0 ? procuradores : undefined
            });
          } else {
            reusDetalhados.push({
              nome: parte.nome,
              documento: parte.doc,
              tipo: parte.tipo,
              procuradores: procuradores.length > 0 ? procuradores : undefined
            });
          }
        }
      } else {
        // Fallback: first party = AUTOR, rest = RÉUs
        const autorProcuradores = findProcuradoresForParte(0);
        autoresDetalhados.push({
          nome: todasPartes[0].nome,
          documento: todasPartes[0].doc,
          tipo: todasPartes[0].tipo,
          procuradores: autorProcuradores.length > 0 ? autorProcuradores : undefined
        });
        
        for (let i = 1; i < todasPartes.length; i++) {
          const procuradores = findProcuradoresForParte(i);
          reusDetalhados.push({
            nome: todasPartes[i].nome,
            documento: todasPartes[i].doc,
            tipo: todasPartes[i].tipo,
            procuradores: procuradores.length > 0 ? procuradores : undefined
          });
        }
      }
      
      const autorNomes = autoresDetalhados.map(a => a.nome).join("; ");
      const reuNomes = reusDetalhados.map(r => r.nome).join("; ");
      const procCount = [...autoresDetalhados, ...reusDetalhados].reduce((c, p) => c + (p.procuradores?.length || 0), 0);
      
      console.log(`[extractPartiesEproc] Strategy F v2: AUTORs="${autorNomes}", RÉUs="${reuNomes}", Procuradores=${procCount}`);
      
      return {
        autores: autorNomes || undefined,
        reus: reuNomes || undefined,
        autoresDetalhados,
        reusDetalhados
      };
    }
  }

  // =====================================================================
  // DEFINITIVE STRATEGY (EPROC/TJTO Capa - Pages 1-2):
  // AUTOR/REQUERENTE/EXEQUENTE always comes after label on same or next line
  // RÉU/REQUERIDO/EXECUTADO always comes after label on same or next line
  // DEPRECANTE/DEPRECADO for Carta Precatória (Letters Rogatory)
  // IMPETRANTE/IMPETRADO for Mandado de Segurança
  // NEVER return "Não identificado" if we find valid party names
  // =====================================================================
  
  // AUTHOR patterns - ordered by priority (includes DEPRECANTE for Carta Precatória)
  const autorPatterns = [
    // Carta Precatória: DEPRECANTE (requesting court/party)
    /\bDEPRECANTE\s*[:\s]*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bDEPRECADO\b|\n\s*\n|Valor\s+da\s+Causa))/i,
    // Mandado de Segurança: IMPETRANTE
    /\bIMPETRANTE\s*[:\s]*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bIMPETRADO\b|\n\s*\n|Valor\s+da\s+Causa))/i,
    // Pattern: "AUTOR: BANCO BRADESCO S.A." (same line, stops at CNPJ/CPF/RÉU/newline)
    /\bAUTOR\s*:\s*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bRÉU\b|\bREQUERIDO\b|\n\s*\n|Valor\s+da\s+Causa))/i,
    /\bREQUERENTE\s*:\s*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bRÉU\b|\bREQUERIDO\b|\n\s*\n|Valor\s+da\s+Causa))/i,
    /\bEXEQUENTE\s*:\s*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bRÉU\b|\bEXECUTADO\b|\n\s*\n|Valor\s+da\s+Causa))/i,
    /\bPROMOVENTE\s*:\s*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bRÉU\b|\bPROMOVIDO\b|\n\s*\n|Valor\s+da\s+Causa))/i,
    // Looser patterns: label followed by newline then name
    /\bDEPRECANTE\s*\n+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\n|CNPJ|CPF|,\s*inscrit)/i,
    /\bIMPETRANTE\s*\n+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\n|CNPJ|CPF|,\s*inscrit)/i,
    /\bAUTOR\s*\n+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\n|CNPJ|CPF|,\s*inscrit)/i,
  ];
  
  // DEFENDANT patterns - ordered by priority (includes DEPRECADO for Carta Precatória)
  const reuPatterns = [
    // Carta Precatória: DEPRECADO (requested court/party)
    /\bDEPRECADO\s*[:\s]*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bDEPRECANTE\b|\n\s*\n|Valor\s+da\s+Causa|Advogad))/i,
    // Mandado de Segurança: IMPETRADO
    /\bIMPETRADO\s*[:\s]*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bIMPETRANTE\b|\n\s*\n|Valor\s+da\s+Causa|Advogad))/i,
    /\bR[ÉE]U\s*:\s*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bAUTOR\b|\bREQUERENTE\b|\n\s*\n|Valor\s+da\s+Causa|Advogad))/i,
    /\bREQUERIDO\s*:\s*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bAUTOR\b|\bREQUERENTE\b|\n\s*\n|Valor\s+da\s+Causa|Advogad))/i,
    /\bEXECUTADO\s*:\s*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bAUTOR\b|\bEXEQUENTE\b|\n\s*\n|Valor\s+da\s+Causa|Advogad))/i,
    /\bPROMOVIDO\s*:\s*\n?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\s*(?:CNPJ|CPF|,\s*inscrit|,\s*pessoa|\bAUTOR\b|\bPROMOVENTE\b|\n\s*\n|Valor\s+da\s+Causa|Advogad))/i,
    // Looser patterns: label followed by newline then name
    /\bDEPRECADO\s*\n+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\n|CNPJ|CPF|,\s*inscrit)/i,
    /\bIMPETRADO\s*\n+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\n|CNPJ|CPF|,\s*inscrit)/i,
    /\bR[ÉE]U\s*\n+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.,\-\/]+?)(?:\n|CNPJ|CPF|,\s*inscrit)/i,
  ];
  
  let autorLabel: string | null = null;
  let reuLabel: string | null = null;
  
  // Try author patterns in order
  for (const pattern of autorPatterns) {
    const m = t.match(pattern);
    if (m && m[1]) {
      const candidate = norm(m[1]);
      // Accept if: not narrative, length > 3, contains at least one uppercase word
      if (candidate && candidate.length > 3 && !looksLikeNarrative(candidate) && /[A-ZÀ-Ú]{2,}/.test(candidate)) {
        autorLabel = candidate;
        console.log(`[extractPartiesEproc] AUTOR found: "${autorLabel}"`);
        break;
      }
    }
  }
  
  // Try defendant patterns in order
  for (const pattern of reuPatterns) {
    const m = t.match(pattern);
    if (m && m[1]) {
      const candidate = norm(m[1]);
      if (candidate && candidate.length > 3 && !looksLikeNarrative(candidate) && /[A-ZÀ-Ú]{2,}/.test(candidate)) {
        reuLabel = candidate;
        console.log(`[extractPartiesEproc] RÉU found: "${reuLabel}"`);
        break;
      }
    }
  }

  // Return found parties (NEVER return empty if we found names)
  if (autorLabel || reuLabel) {
    return { 
      autores: autorLabel || undefined, 
      reus: reuLabel || undefined, 
      autoresDetalhados, 
      reusDetalhados 
    };
  }

  // Strategy A (preferred): EXEQUENTE/EXECUTADO (common in execution / citation letter)
  const exeq = pickLine(/\bExequente\s*:\s*([^\n]+)/i);
  const exec = pickLine(/\bExecutad[oa]\s*:\s*([^\n]+)/i);

  if (exeq && exec && !looksLikeNarrative(exeq) && !looksLikeNarrative(exec)) {
    return { autores: exeq, reus: exec, autoresDetalhados, reusDetalhados };
  }

  // Strategy B: Inline "Autor:" + "RÉu:" in events (picks longest match)
  const autorInlineAll = [...t.matchAll(/\bAutor\s*:\s*([^\n]+)/gim)]
    .map(m => norm(m[1] || ""))
    .filter(s => s.length >= 4 && !looksLikeNarrative(s));

  const reuInlineAll = [...t.matchAll(/\bR[ÉE]u\s*:\s*([^\n]+)/gim)]
    .map(m => norm(m[1] || ""))
    .filter(s => s.length >= 4 && !looksLikeNarrative(s));

  if (reuInlineAll.length) {
    const reuName = reuInlineAll.sort((a, b) => b.length - a.length)[0];

    // Prefer EXECUTADO if it exists (more authoritative than event "RÉu:")
    const exec3 = pickLine(/\bExecutad[oa]\s*:\s*([^\n]+)/i);
    const exeq3 = pickLine(/\bExequente\s*:\s*([^\n]+)/i);

    if (exec3 && !looksLikeNarrative(exec3)) {
      const autorFinal =
        (autorInlineAll.length ? autorInlineAll.sort((a, b) => b.length - a.length)[0] : null) ||
        (exeq3 && !looksLikeNarrative(exeq3) ? exeq3 : null);

      return autorFinal
        ? { autores: autorFinal, reus: exec3, autoresDetalhados, reusDetalhados }
        : { reus: exec3, autoresDetalhados, reusDetalhados };
    }

    const autorName = autorInlineAll.length
      ? autorInlineAll.sort((a, b) => b.length - a.length)[0]
      : null;

    // If no autor in event, try isolated "Exequente:"
    const exeq2 = autorName ? null : pickLine(/\bExequente\s*:\s*([^\n]+)/i);
    return autorName
      ? { autores: autorName, reus: reuName, autoresDetalhados, reusDetalhados }
      : exeq2 && !looksLikeNarrative(exeq2)
        ? { autores: exeq2, reus: reuName, autoresDetalhados, reusDetalhados }
        : { reus: reuName, autoresDetalhados, reusDetalhados };
  }

  // Strategy C: Autor(es)/Réu(s) or Polo Ativo/Passivo (only if NOT narrative)
  const getBetween = (a: RegExp, b: RegExp): string | null => {
    const ma = a.exec(t);
    if (!ma) return null;
    const start = ma.index + ma[0].length;
    const mb = b.exec(t.slice(start));
    const end = mb ? start + mb.index : Math.min(start + 350, t.length);
    return norm(t.slice(start, end));
  };

  const autores = getBetween(
    /(?:^|\n)\s*(Autor\(es\)|POLO\s+ATIVO)\s*(?:\n|:)/i,
    /(?:^|\n)\s*(Réu\(s\)|POLO\s+PASSIVO)\s*(?:\n|:)/i
  );
  const reus = getBetween(
    /(?:^|\n)\s*(Réu\(s\)|POLO\s+PASSIVO)\s*(?:\n|:)/i,
    /(?:^|\n)\s*(Valor\s+da\s+Causa|Linha\s+do\s+Tempo|Eventos\s+Processuais|Advogad[oa])\b/i
  );

  if (autores && reus && !looksLikeNarrative(autores) && !looksLikeNarrative(reus)) {
    if (normalizeName(autores) !== normalizeName(reus)) {
      return { autores, reus, autoresDetalhados, reusDetalhados };
    }
  }

  // ==============================================================
  // Fase 1 - Strategy D: Extract author from initial petition body
  // Pattern: "NOME COMPLETO, brasileiro(a), estado civil, profissão, ... vem ... ajuizar"
  // ==============================================================
  const peticaoAutorMatch = t.match(
    /([A-ZÀ-Ú][A-ZÀ-Ú\s]{5,50}),\s*brasileiro[^,]{0,30},\s*(?:solteiro|casado|divorciado|viúvo|separado)[^,]{0,50},[^]*?(?:vem|v[êe]m)[^]{0,200}?ajuizar/i
  );
  
  if (peticaoAutorMatch) {
    const autorFromPeticao = norm(peticaoAutorMatch[1]);
    if (autorFromPeticao && autorFromPeticao.length >= 5 && !looksLikeNarrative(autorFromPeticao)) {
      // Try to extract CPF
      const cpfMatch = t.slice(peticaoAutorMatch.index || 0, (peticaoAutorMatch.index || 0) + 500)
        .match(/CPF[^\d]*(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})/i);
      
      if (cpfMatch) {
        autoresDetalhados.push({
          nome: autorFromPeticao,
          documento: cpfMatch[1],
          tipo: "PF"
        });
      }
      
      // Fase 1 - Strategy E: Extract multiple defendants from "em face de" / "contra" listings
      // Look for banks/companies with CNPJ after author declaration
      const afterAutor = t.slice((peticaoAutorMatch.index || 0) + peticaoAutorMatch[0].length);
      const reuMatches = [...afterAutor.matchAll(
        /([A-ZÀ-Ú][A-ZÀ-Ú\s.\/]+(?:S\.?A\.?|LTDA|BANK|BANCO|FINANC[A-Z]+)?)[,\s]*(?:inscrit[oa]?\s+no\s+)?(?:CNPJ|CGC)[^\d]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2})/gi
      )];
      
      for (const reuMatch of reuMatches) {
        const reuNome = norm(reuMatch[1]).replace(/\s+/g, " ").trim();
        const cnpj = reuMatch[2];
        if (reuNome && reuNome.length >= 5) {
          reusDetalhados.push({
            nome: reuNome,
            documento: cnpj,
            tipo: "PJ"
          });
        }
      }
      
      // Build string lists from detailed parties
      const reusStr = reusDetalhados.length > 0 
        ? reusDetalhados.map(r => r.nome).join("; ") 
        : undefined;
      
      return { 
        autores: autorFromPeticao, 
        reus: reusStr,
        autoresDetalhados,
        reusDetalhados 
      };
    }
  }

  // (Strategy F moved to beginning of function for priority)

  // Fallback: "Partes" block (if exists and not narrative)
  const partesNeutras = getBetween(
    /(?:^|\n)\s*Partes\s*(?:\n|:)/i,
    /(?:^|\n)\s*(Valor\s+da\s+Causa|Linha\s+do\s+Tempo|Eventos\s+Processuais|Advogad[oa])\b/i
  );
  if (partesNeutras && !looksLikeNarrative(partesNeutras)) {
    return { partesNeutras, autoresDetalhados, reusDetalhados };
  }

  return { autoresDetalhados, reusDetalhados };
}

// Infer if lawyer is acting "em causa própria"
export function inferCausaPropria(raw: string, partesTexto: string): boolean {
  const has = /atuando\s+em\s+causa\s+pr[oó]pria/i.test(raw);
  if (!has) return false;

  // Only validate if some lawyer name also appears as a party
  const oabs = extractOabsFromText(raw);
  const partesNorm = normalizeName(partesTexto);

  for (const o of oabs) {
    if (o.nome && partesNorm.includes(normalizeName(o.nome))) return true;
  }
  return false;
}

export function createEmptyExtractionResult(): EprocExtractionResult {
  return {
    capa: {
      numeroCnj: PLACEHOLDER_NAO_IDENTIFICADO,
      classeAcao: PLACEHOLDER_NAO_IDENTIFICADO,
      varaJuizo: PLACEHOLDER_NAO_IDENTIFICADO,
      comarca: PLACEHOLDER_NAO_IDENTIFICADO,
      situacaoProcessual: PLACEHOLDER_NAO_IDENTIFICADO,
      // Fase 2
      dataAutuacao: PLACEHOLDER_NAO_IDENTIFICADO,
      orgaoJulgador: PLACEHOLDER_NAO_IDENTIFICADO,
      juiz: PLACEHOLDER_NAO_IDENTIFICADO,
      assuntos: [],
      tipoAcao: PLACEHOLDER_NAO_IDENTIFICADO,
      // Fase 3 (Informações Adicionais)
      chaveProcesso: PLACEHOLDER_NAO_IDENTIFICADO,
      justicaGratuita: false,
      prioridadeAtendimento: false,
      segredoJustica: false,
      nivelSigilo: PLACEHOLDER_NAO_IDENTIFICADO,
      processosApensos: [],
      antecipacaoTutela: false,
      peticaoUrgente: false,
      vistaMinisterioPublico: false,
    },
    peticaoInicial: {
      autores: [],
      reus: [],
      partesNeutras: undefined,
      pedidos: [],
      causaDePedir: PLACEHOLDER_NAO_IDENTIFICADO,
      valorDaCausa: PLACEHOLDER_NAO_IDENTIFICADO,
      fundamentosLegaisCitados: [],
      datasDeFatosNarrados: [],
      autoresDetalhados: [],
      reusDetalhados: [],
    },
    advogado: {
      nome: PLACEHOLDER_NAO_IDENTIFICADO,
      oab: PLACEHOLDER_NAO_IDENTIFICADO,
      formatado: PLACEHOLDER_NAO_IDENTIFICADO,
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
      extractionQuality: undefined,
      ordemSuspeita: undefined,
      datePercentage: undefined,
    },
  };
}

/**
 * Extract EPROC data from raw text WITHOUT AI interpretation
 * Pure regex-based extraction for faithful, literal data capture
 * 
 * @param rawText - The raw text extracted from PDF
 * @param bookmarks - Optional bookmark extraction result for enhanced accuracy
 */
export function extractEprocDataPure(
  rawText: string,
  bookmarks?: BookmarkExtractionResult | null
): EprocExtractionResult {
  const result = createEmptyExtractionResult();
  const camposAusentes: string[] = [];

  // === 1. CAPA DO PROCESSO ===
  
  // CNJ - PRIORIZAR bookmarks (100% preciso) sobre regex
  if (bookmarks?.cnj) {
    result.capa.numeroCnj = bookmarks.cnj;
  } else {
    // Fallback: regex no texto
    const cnjMatch = rawText.match(/\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4}/);
    if (cnjMatch) {
      result.capa.numeroCnj = cnjMatch[0];
    } else {
      camposAusentes.push("numeroCnj");
    }
  }

  // Fase 1: Classe da ação - CORRIGIDO: limitar captura
  const classeMatch = rawText.match(
    /(?:classe|tipo\s+d[ae]\s+a[çc][ãa]o)[:\s]+([A-Za-zÀ-ÿ\s]+?)(?:\s+Compet[êe]ncia|\s+Data\s+de|\s+Valor|\n|$)/i
  );
  if (classeMatch) {
    result.capa.classeAcao = classeMatch[1].trim().replace(/\s+/g, " ");
  } else {
    camposAusentes.push("classeAcao");
  }

  // Fase 1: Vara/Juízo - CORRIGIDO: limitar captura antes do nome do juiz ou próximo campo
  const varaMatch = rawText.match(
    /(?:Juízo\s+d[ao]\s+)?(\d+[ªºa]\s*(?:Vara|Escrivania)\s*(?:C[íi]vel|Criminal|do\s+Trabalho|Federal|da\s+Fam[íi]lia|de\s+Exec[uç]ões)?(?:\s+de\s+[A-ZÀ-Úa-zà-ÿ\s-]+)?)(?:\s+Juiz|\s+Competência|\n|$)/i
  ) || rawText.match(
    /[ÓO]rg[ãa]o\s+Julgador[:\s]+([A-ZÀ-Úa-zà-ÿ\s\d.ª°-]+?)(?:\s+Juiz|\s+Competência|\s+Data|\n|$)/i
  );
  if (varaMatch) {
    result.capa.varaJuizo = varaMatch[1].trim().replace(/\s+/g, " ");
  } else {
    camposAusentes.push("varaJuizo");
  }

  // Fase 1: Comarca - CORRIGIDO: pegar preposições (de/da/do)
  const comarcaMatch = rawText.match(
    /(?:Comarca|Foro)\s+(?:de\s+|da\s+|do\s+)?([A-ZÀ-Ú][a-zà-ÿ]+(?:[\s-][A-ZÀ-Úa-zà-ÿ]+)*)(?:\s*[-\/]\s*[A-Z]{2})?/i
  );
  if (comarcaMatch) {
    result.capa.comarca = comarcaMatch[1].trim();
  } else {
    // Fallback: try to extract from Órgão Julgador (e.g., "... de Wanderlândia")
    const orgaoComarcaMatch = rawText.match(/[ÓO]rg[ãa]o\s+Julgador[:\s]+[^]*?(?:de|da)\s+([A-ZÀ-Ú][a-zà-ÿ]+(?:[\s-][A-ZÀ-Úa-zà-ÿ]+)*)/i);
    if (orgaoComarcaMatch) {
      result.capa.comarca = orgaoComarcaMatch[1].trim();
    } else {
      camposAusentes.push("comarca");
    }
  }

  // Situação processual - CORRIGIDO: limitar captura ao primeiro delimitador lógico
  const situacaoMatch = rawText.match(
    /(?:Situa[çc][ãa]o|Status|Fase|Movimento)[:\s]+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ÿ\s\-\/]+?)(?:\s+[ÓO]rg[ãa]o|\s+Juiz|Assuntos|\s+Competência|\s+Data|\n|$)/i
  );
  if (situacaoMatch) {
    result.capa.situacaoProcessual = situacaoMatch[1].trim().replace(/\s+/g, " ");
  } else {
    camposAusentes.push("situacaoProcessual");
  }

  // ====== Fase 2: Novos campos da capa ======
  
  // Data de autuação
  const dataAutuacaoMatch = rawText.match(
    /Data\s+de\s+autua[çc][ãa]o[:\s]*(\d{1,2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i
  );
  if (dataAutuacaoMatch) {
    result.capa.dataAutuacao = dataAutuacaoMatch[1].trim();
  } else {
    camposAusentes.push("dataAutuacao");
  }

  // Órgão Julgador (completo)
  const orgaoJulgadorMatch = rawText.match(
    /[ÓO]rg[ãa]o\s+Julgador[:\s]+([^\n]+)/i
  );
  if (orgaoJulgadorMatch) {
    result.capa.orgaoJulgador = orgaoJulgadorMatch[1].trim();
  }

  // Juiz
  const juizMatch = rawText.match(
    /Juiz(?:\(a\))?[:\s]+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ÿ\s]+?)(?:\n|$|Assuntos)/i
  );
  if (juizMatch) {
    result.capa.juiz = juizMatch[1].trim().replace(/\s+/g, " ");
  }

  // Assuntos (código + descrição + principal) - CORRIGIDO: limpar cabeçalho de tabela
  const assuntosBlock = rawText.match(/Assuntos\s*\n?([\s\S]*?)(?=\n\s*(?:Valor|Partes|Autor|Linha|Eventos|Informações|$))/i);
  if (assuntosBlock) {
    // Limpar cabeçalho de tabela (Código Descrição Principal)
    const assuntosText = assuntosBlock[1]
      .replace(/C[óo]digo\s+Descri[çc][ãa]o\s+Principal\s*/gi, "")
      .trim();
    
    // Match: "02050312 Contratos Bancários, Espécies de Contratos... Sim/Principal"
    const assuntoLines = [...assuntosText.matchAll(
      /(\d{6,10})\s+([^,\n]+(?:,\s*[^,\n]+)*?)(?:\s+(Sim|Não|Principal))?(?:\n|$)/gi
    )];
    for (const am of assuntoLines) {
      result.capa.assuntos.push({
        codigo: am[1],
        descricao: am[2].trim(),
        principal: am[3]?.toLowerCase() === "sim" || am[3]?.toLowerCase() === "principal"
      });
    }
  }

  // Tipo de ação (da petição inicial)
  const tipoAcaoMatch = rawText.match(
    /(?:ajuizar|propor|ingressar\s+com)[:\s]*\n?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ÿ\s]+?(?:C\/C|COM|E)[A-ZÀ-Úa-zà-ÿ\s]+?)(?:;|em\s+face|contra|\n)/i
  ) || rawText.match(
    /(?:AÇÃO|A[ÇC][ÃA]O)\s+(?:DE\s+|ORDINÁRIA\s+DE\s+)?([A-ZÀ-Úa-zà-ÿ\s]+?)(?:;|em\s+face|contra|\n)/i
  );
  if (tipoAcaoMatch) {
    result.capa.tipoAcao = tipoAcaoMatch[1].trim().replace(/\s+/g, " ");
  }

  // FALLBACK: Se classeAcao não foi encontrado, usar tipoAcao
  if (result.capa.classeAcao === PLACEHOLDER_NAO_IDENTIFICADO && 
      result.capa.tipoAcao !== PLACEHOLDER_NAO_IDENTIFICADO) {
    result.capa.classeAcao = result.capa.tipoAcao;
  }

  // ====== Fase 3: Informações Adicionais ======

  // Chave do Processo
  const chaveMatch = rawText.match(/Chave\s+(?:do\s+)?Processo[:\s]+(\d+)/i);
  if (chaveMatch) {
    result.capa.chaveProcesso = chaveMatch[1];
  }

  // Justiça Gratuita / Custas Judiciais
  const custasMatch = rawText.match(/Custas\s+Judiciais[:\s]+([^\n]+)/i);
  if (custasMatch) {
    result.capa.justicaGratuita = /Justi[çc]a\s+Gratuita|Gratuidade|Isent[oa]/i.test(custasMatch[1]);
  } else {
    // Fallback: procurar menção direta
    result.capa.justicaGratuita = /Justi[çc]a\s+Gratuita|Gratuidade\s+(?:de\s+)?Justi[çc]a|AJG|Assist[êe]ncia\s+Judici[áa]ria/i.test(rawText);
  }

  // Nível de Sigilo
  const sigiloMatch = rawText.match(/N[íi]vel\s+de\s+Sigilo(?:\s+do\s+Processo)?[:\s]+([^\n]+)/i);
  if (sigiloMatch) {
    const sigiloText = sigiloMatch[1].trim();
    result.capa.nivelSigilo = sigiloText;
    result.capa.segredoJustica = !/Sem\s+Sigilo|P[úu]blico|Nenhum/i.test(sigiloText);
  } else {
    result.capa.segredoJustica = /Segredo\s+de\s+Justi[çc]a|Sigilo\s+Total|Sigiloso/i.test(rawText);
  }

  // Prioridade de Atendimento
  const prioridadeMatch = rawText.match(/Prioridade\s+(?:de\s+)?Atendimento[:\s]+([^\n]+)/i);
  if (prioridadeMatch) {
    result.capa.prioridadeAtendimento = /Sim|Idoso|PCD|Deficiente|Criança|Adolescente/i.test(prioridadeMatch[1]);
  }

  // Antecipação de Tutela - IMPORTANTE: verificar negação antes de marcar como requerida
  const tutelaMatch = rawText.match(/Antecipa[çc][ãa]o\s+de\s+Tutela[:\s]+([^\n]+)/i);
  if (tutelaMatch) {
    const tutelaText = tutelaMatch[1].trim();
    // Se começa com "Não" ou contém "Não Requerida", é false
    const hasNegation = /^N[ãa]o\b/i.test(tutelaText) || /N[ãa]o\s+Requerida/i.test(tutelaText);
    result.capa.antecipacaoTutela = !hasNegation && /Sim|Requerida|Deferida|Concedida/i.test(tutelaText);
  }

  // Petição Urgente - mesma lógica de negação
  const urgenteMatch = rawText.match(/Peti[çc][ãa]o\s+Urgente[:\s]+([^\n]+)/i);
  if (urgenteMatch) {
    const urgenteText = urgenteMatch[1].trim();
    const hasNegation = /^N[ãa]o\b/i.test(urgenteText);
    result.capa.peticaoUrgente = !hasNegation && /Sim/i.test(urgenteText);
  }

  // Vista Ministério Público - mesma lógica
  const mpMatch = rawText.match(/Vista\s+Minist[ée]rio\s+P[úu]blico[:\s]+([^\n]+)/i);
  if (mpMatch) {
    const mpText = mpMatch[1].trim();
    const hasNegation = /^N[ãa]o\b/i.test(mpText);
    result.capa.vistaMinisterioPublico = !hasNegation && /Sim/i.test(mpText);
  }

  // Processos Apensos/Vinculados (CNJs relacionados)
  // Estratégia 1: Label explícito "Processos Apensos"
  const apensosMatch = rawText.match(/Processos?\s+Apensos?[:\s]*([\s\S]*?)(?=\n\s*(?:Informações|Eventos|Valor|$))/i);
  if (apensosMatch) {
    const apensosText = apensosMatch[1];
    const cnjs = [...apensosText.matchAll(/(\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4})/g)];
    result.capa.processosApensos = cnjs.map(m => m[1]);
  }
  
  // Estratégia 2: CNJs com contexto processual (ex: "0016278-05.2020.8.27.2700/TJTO | 2o. grau | Agravo")
  const vinculadosPattern = /(\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4})[\/\w]*\s*\|\s*(?:Dependente|2[oº]\.?\s*grau|Agravo|Recurso|Apela[çc][ãa]o|Embargos?|Incidente)/gi;
  const vinculadosMatches = [...rawText.matchAll(vinculadosPattern)];
  for (const match of vinculadosMatches) {
    const cnj = match[1];
    if (!result.capa.processosApensos.includes(cnj)) {
      result.capa.processosApensos.push(cnj);
    }
  }

  // === 2. PETIÇÃO INICIAL / PARTES ===
  const parties = extractPartiesEproc(rawText);
  
  if (parties.autores) {
    result.peticaoInicial.autores = [parties.autores];
  }
  if (parties.reus) {
    // Fase 1: Handle multiple defendants (split by ;) + LIMPAR "Pessoa Física/Jurídica"
    result.peticaoInicial.reus = parties.reus
      .split(/;\s*/)
      .map(r => r.replace(/^Pessoa\s+(F[íi]sica|Jur[íi]dica)\s+/i, "").trim())
      .filter(r => r.length > 3);
  }
  if (parties.partesNeutras) {
    result.peticaoInicial.partesNeutras = parties.partesNeutras;
  }
  if (parties.autoresDetalhados) {
    result.peticaoInicial.autoresDetalhados = parties.autoresDetalhados;
  }
  if (parties.reusDetalhados) {
    result.peticaoInicial.reusDetalhados = parties.reusDetalhados;
  }
  
  // Only mark as missing if no parties info at all
  if (!parties.autores && !parties.reus && !parties.partesNeutras) {
    camposAusentes.push("partes");
  }

  // Valor da causa
  const valorMatch = rawText.match(/(?:valor da causa)[:\s]+R?\$?\s*([\d.,]+)/i);
  if (valorMatch) {
    result.peticaoInicial.valorDaCausa = `R$ ${valorMatch[1].trim()}`;
  } else {
    camposAusentes.push("valorDaCausa");
  }

  // === 3. ADVOGADO ===
  // IMPROVED: First try to use procuradores already extracted from parties (Strategy F)
  // This is more accurate than regex-based extraction
  let lawyerName = PLACEHOLDER_NAO_IDENTIFICADO;
  let oabNumber = PLACEHOLDER_NAO_IDENTIFICADO;
  let oabs: OabEntry[] = [];
  let emCausaPropria = false;
  
  // Try to get lawyer from author's procuradores first (preferred)
  const autorProcs = parties.autoresDetalhados?.flatMap(a => a.procuradores || []) || [];
  const reuProcs = parties.reusDetalhados?.flatMap(r => r.procuradores || []) || [];
  const allProcsFromParties = [...autorProcs, ...reuProcs];
  
  if (autorProcs.length > 0) {
    // Use first author's procurador as the main lawyer (client's lawyer)
    const firstAutorProc = autorProcs[0];
    lawyerName = firstAutorProc.nome;
    oabNumber = firstAutorProc.oab;
    
    // Build OabEntry array from all procuradores
    oabs = allProcsFromParties.map(p => {
      const oabMatch = p.oab.match(/^([A-Z]{2,3})(\d+[A-Z]?)$/i);
      return {
        nome: p.nome,
        oabUf: oabMatch ? oabMatch[1].toUpperCase() : "??",
        oabNumero: oabMatch ? oabMatch[2] : p.oab
      };
    });
    
    console.log(`[extractEprocDataPure] Using procurador from parties: ${lawyerName} (${oabNumber})`);
  } else {
    // Fallback: Extract all OABs from text using regex
    oabs = extractOabsFromText(rawText);
    
    // Extract lawyer name (clean format: only name, no extra text)
    const advMatch = rawText.match(/(?:advogad[oa]|patrono|procurador)[:\s]+([A-Za-zÀ-ÿ\s]+?)(?:,|\s*[-–]\s*OAB|\s*OAB|\n|$)/i);
    
    if (advMatch) {
      lawyerName = advMatch[1].trim().replace(/\s+/g, " ");
    } else if (oabs.length > 0 && oabs[0].nome) {
      lawyerName = oabs[0].nome;
    } else {
      camposAusentes.push("advogadoNome");
    }
    
    // Use first OAB if available
    if (oabs.length > 0) {
      oabNumber = `${oabs[0].oabUf} ${oabs[0].oabNumero}`;
    } else {
      camposAusentes.push("advogadoOab");
    }
    
    // Infer "causa própria" only if no procuradores were found in parties
    const partesTexto = parties.autores || parties.reus || parties.partesNeutras || "";
    emCausaPropria = inferCausaPropria(rawText, partesTexto);
  }
  
  result.advogado = {
    nome: lawyerName,
    oab: oabNumber,
    formatado: lawyerName !== PLACEHOLDER_NAO_IDENTIFICADO && oabNumber !== PLACEHOLDER_NAO_IDENTIFICADO
      ? `${lawyerName} — OAB ${oabNumber}${emCausaPropria ? " (em causa própria)" : ""}`
      : lawyerName !== PLACEHOLDER_NAO_IDENTIFICADO
        ? lawyerName
        : oabNumber !== PLACEHOLDER_NAO_IDENTIFICADO
          ? `OAB ${oabNumber}`
          : PLACEHOLDER_NAO_IDENTIFICADO,
    oabs,
    emCausaPropria,
  };

  // === 4. EVENTOS PROCESSUAIS (TIMELINE EPROC) ===
  // PRIORIZAR bookmarks (100% precisos) sobre regex no texto
  if (bookmarks?.hasBookmarks && bookmarks.documentos.length > 0) {
    console.log(`[extractEprocDataPure] Using BOOKMARK-based timeline: ${bookmarks.documentos.length} documents`);
    
    // Group documents by event number
    const eventsByNumber = new Map<number, EprocDocumentBookmark[]>();
    for (const doc of bookmarks.documentos) {
      if (doc.isCapa) continue; // Skip capa page
      if (!eventsByNumber.has(doc.eventoNumero)) {
        eventsByNumber.set(doc.eventoNumero, []);
      }
      eventsByNumber.get(doc.eventoNumero)!.push(doc);
    }
    
    // Create events from bookmarks with TJTO enrichment
    const bookmarkEvents: EprocEventoExtraido[] = [];
    
    // IMPROVED DATE EXTRACTION: Search entire text for event-specific patterns
    // Pattern 1: PÁGINA DE SEPARAÇÃO blocks with event number and date
    // Pattern 2: "Evento N ... Data: DD/MM/YYYY"
    // Pattern 3: Context around event number mention
    
    // Pre-extract all PÁGINA DE SEPARAÇÃO data using patterns.ts helper
    const separadorDataMap = extractSeparadorData(rawText);
    console.log(`[extractEprocDataPure] Pre-extracted ${separadorDataMap.size} PÁGINA DE SEPARAÇÃO blocks for date lookup`);
    
    for (const [eventoNum, docs] of eventsByNumber) {
      const firstDoc = docs[0];
      const allDocLabels = docs.map(d => d.tipoDocumento).join(", ");
      
      // PHASE 1: Get TJTO code and enriched label from tipoDocumento
      const tjtoMapping = getTjtoFromTipoDoc(firstDoc.tipoDocumento);
      const codigoTjto = tjtoMapping?.code || null;
      const labelEnriquecido = tjtoMapping?.label || firstDoc.tipoDocumento;
      
      // PHASE 2: IMPROVED DATE EXTRACTION - Multiple strategies
      let extractedDate = PLACEHOLDER_NAO_IDENTIFICADO;
      let extractedHour: string | null = null;
      
      // Strategy 1: Use pre-extracted PÁGINA DE SEPARAÇÃO data (most reliable)
      const separadorData = separadorDataMap.get(eventoNum);
      if (separadorData?.data) {
        extractedDate = separadorData.data;
        extractedHour = separadorData.hora;
        console.log(`[extractEprocDataPure] Event ${eventoNum}: Date from SEPARADOR: ${extractedDate}`);
      }
      
      // Strategy 2: Search for "Evento N" followed by date in nearby context
      if (extractedDate === PLACEHOLDER_NAO_IDENTIFICADO) {
        // Build a regex to find this specific event number with nearby date
        const eventContextPattern = new RegExp(
          `(?:#\\s*)?Evento\\s+${eventoNum}\\b[\\s\\S]{0,800}?Data:\\s*(\\d{1,2}\\/\\d{1,2}\\/\\d{4})(?:\\s*(\\d{2}:\\d{2}(?::\\d{2})?))?`,
          "i"
        );
        const contextMatch = rawText.match(eventContextPattern);
        if (contextMatch && contextMatch[1]) {
          const validatedDate = validateAndNormalizeDate(contextMatch[1]);
          if (validatedDate) {
            extractedDate = validatedDate;
            extractedHour = contextMatch[2] || null;
            console.log(`[extractEprocDataPure] Event ${eventoNum}: Date from context search: ${extractedDate}`);
          }
        }
      }
      
      // Strategy 3: If page position is available, search in page text
      if (extractedDate === PLACEHOLDER_NAO_IDENTIFICADO && firstDoc.pageStart && rawText.length > 0) {
        // More aggressive estimation: 4000 chars per page with 1000 char buffer
        const charsPerPage = 4000;
        const buffer = 1000;
        const estimatedStart = Math.max(0, (firstDoc.pageStart - 1) * charsPerPage - buffer);
        const estimatedEnd = Math.min(rawText.length, (firstDoc.pageStart + 1) * charsPerPage + buffer);
        const textBlock = rawText.slice(estimatedStart, estimatedEnd);
        
        // Search for any "Data: DD/MM/YYYY" pattern in this block
        const dateResult = extractDateFromContext(textBlock);
        if (dateResult.data) {
          extractedDate = dateResult.data;
          extractedHour = dateResult.hora;
          console.log(`[extractEprocDataPure] Event ${eventoNum}: Date from page ${firstDoc.pageStart} context: ${extractedDate}`);
        }
      }
      
      bookmarkEvents.push({
        numeroEvento: eventoNum,
        data: extractedDate,
        hora: extractedHour,
        tipoEvento: firstDoc.tipoDocumento,
        descricaoLiteral: docs.length > 1 
          ? `${labelEnriquecido} (+${docs.length - 1} documento${docs.length > 2 ? "s" : ""})`
          : labelEnriquecido,
        documentoVinculado: allDocLabels,
        codigoTjto,
        labelEnriquecido,
        usuarioRegistro: null,
        pecasAnexas: docs.map(d => {
          const docTjto = getTjtoFromTipoDoc(d.tipoDocumento);
          return {
            codigo: docTjto?.code || `DOC${d.docNumero}`,
            paginas: d.pageCount || 1,
            label: docTjto?.label || d.tipoDocumento,
          };
        }),
        // Bookmark metadata
        pageStart: firstDoc.pageStart,
        pageEnd: docs[docs.length - 1].pageEnd,
        source: "PDF_BOOKMARK",
        confidence: codigoTjto ? "HIGH" : "MEDIUM",
      });
    }
    
    // Sort by event number
    bookmarkEvents.sort((a, b) => (a.numeroEvento ?? 0) - (b.numeroEvento ?? 0));
    result.eventos = bookmarkEvents;
    
    console.log(`[extractEprocDataPure] BOOKMARK EXTRACTION SUCCESS: ${bookmarkEvents.length} events from ${bookmarks.documentos.length} documents`);
  } else {
    // Fallback: regex-based extraction
    result.eventos = extractEprocEvents(rawText);
  }
  
  result.meta.totalEventos = result.eventos.length;
  
  // Calculate timeline quality metrics (DEFINITIVE ARCHITECTURE)
  const quality = calculateTimelineQuality(result.eventos);
  result.meta.extractionQuality = quality.extractionQuality;
  result.meta.ordemSuspeita = quality.ordemSuspeita;
  result.meta.datePercentage = quality.datePercentage;
  
  console.log(`[extractEprocDataPure] Timeline Quality: ${quality.extractionQuality}, ` +
    `${quality.totalEventsWithDate}/${quality.totalEvents} eventos com data (${quality.datePercentage}%), ` +
    `ordemSuspeita=${quality.ordemSuspeita}`);

  // === 4. PEÇAS POSTERIORES ===
  
  const pecaPatterns = [
    { tipo: "CONTESTACAO" as const, pattern: /(?:contestação|defesa do réu)/gi },
    { tipo: "REPLICA" as const, pattern: /réplica/gi },
    { tipo: "SENTENCA" as const, pattern: /sentença/gi },
    { tipo: "DECISAO" as const, pattern: /(?:decisão|despacho)/gi },
    { tipo: "RESPOSTA" as const, pattern: /resposta/gi },
  ];

  for (const { tipo, pattern } of pecaPatterns) {
    // Find events that match this piece type
    const matchingEvents = result.eventos.filter(e => 
      pattern.test(e.descricaoLiteral)
    );
    
    for (const evento of matchingEvents) {
      result.pecasPosteriores.push({
        tipo,
        nomeEvento: evento.descricaoLiteral,
        documentoAssociado: evento.documentoVinculado || PLACEHOLDER_NAO_IDENTIFICADO,
        textoIntegral: "", // Would need full document content
        data: evento.data,
        parteQueApresentou: PLACEHOLDER_NAO_IDENTIFICADO,
      });
    }
  }

  result.meta.totalPecas = result.pecasPosteriores.length;
  result.meta.camposAusentes = camposAusentes;
  result.meta.dataExtracao = new Date().toISOString();

  return result;
}

// =====================================================================
// DEFINITIVE EPROC/TJTO ARCHITECTURE - Quality metrics for timeline
// =====================================================================
export interface EprocTimelineQuality {
  extractionQuality: "ALTA" | "MEDIA" | "BAIXA";
  ordemSuspeita: boolean; // True if dates appear regressive or inconsistent
  totalEventsWithDate: number;
  totalEvents: number;
  datePercentage: number;
}

// normalizeJudicialText is now imported from ./patterns

/**
 * Extract EPROC events (TIMELINE) from raw text - literal extraction
 * 
 * DEFINITIVE ARCHITECTURE (EPROC/TJTO):
 * - ONLY source of truth: "Processo..., Evento X, Tipo Y, Página Z" header
 * - This pattern appears at top of EVERY event page in EPROC PDFs
 * - Fallback strategies ONLY used when NO EPROC headers are found
 */
function extractEprocEvents(rawText: string): EprocEventoExtraido[] {
  const eventos: EprocEventoExtraido[] = [];
  const seenEventNumbers = new Set<number>();
  
  // STEP 1: Apply judicial text normalization (from patterns.ts)
  const normalizedText = normalizeJudicialText(rawText);

  // =====================================================================
  // PHASE 1: PRE-SCAN "PÁGINA DE SEPARAÇÃO" BLOCKS (using patterns.ts helper)
  // =====================================================================
  const separadorDataMap = extractSeparadorData(normalizedText);
  console.log(`[extractEprocEvents] PHASE 1: Found ${separadorDataMap.size} PÁGINA DE SEPARAÇÃO blocks`);

  // =====================================================================
  // PHASE 2 & 3: EXTRACT AND GROUP PEÇAS (using patterns.ts helper)
  // =====================================================================
  const pecasByEvento = extractPecasFromHeaders(normalizedText);
  console.log(`[extractEprocEvents] PHASE 2-3: Grouped ${[...pecasByEvento.values()].flat().length} peças across ${pecasByEvento.size} events`);

  // =====================================================================
  // PHASE 4: BUILD EVENTS - MERGE SEPARADOR DATA + PEÇAS
  // Priority: PÁGINA DE SEPARAÇÃO data > header context search
  // =====================================================================
  const allEventNumbers = new Set([...separadorDataMap.keys(), ...pecasByEvento.keys()]);

  console.log(`[extractEprocEvents] PHASE 4: Building ${allEventNumbers.size} unique events`);

  for (const eventNum of allEventNumbers) {
    if (seenEventNumbers.has(eventNum)) continue;
    seenEventNumbers.add(eventNum);

    const separadorData = separadorDataMap.get(eventNum);
    const pecas = pecasByEvento.get(eventNum) || [];

    // Priority 1: Use PÁGINA DE SEPARAÇÃO data (most reliable)
    let data = separadorData?.data || null;
    let hora = separadorData?.hora || null;
    let tipoEvento = separadorData?.tipoEvento || null;
    const usuario = separadorData?.usuario || null;

    // Priority 2: If no separador data, search in header context (using patterns.ts helpers)
    if (!data && pecas.length > 0) {
      const firstPecaIdx = pecas[0].primeiraOcorrencia;
      // Search MUCH wider (5000 chars before) to find PÁGINA DE SEPARAÇÃO
      const searchStart = Math.max(0, firstPecaIdx - 5000);
      const searchEnd = Math.min(normalizedText.length, firstPecaIdx + 300);
      const contextBlock = normalizedText.slice(searchStart, searchEnd);

      // Extract date/time from context
      const dateResult = extractDateFromContext(contextBlock);
      if (dateResult.data) {
        data = dateResult.data;
        hora = dateResult.hora;
      }

      // Extract event type from context
      if (!tipoEvento) {
        tipoEvento = extractEventTypeFromContext(contextBlock);
      }
    }

    // Use first peça code as fallback tipo if still not found
    if (!tipoEvento && pecas.length > 0) {
      tipoEvento = pecas[0].codigo;
    }

    // Event must have at least a number
    if (eventNum === null) continue;

    // CORREÇÃO: Filtrar tipos inválidos que são apenas labels de campo (ex: "Data", "Evento")
    const INVALID_TIPO_LABELS = ["DATA", "EVENTO", "USUARIO", "PAGINA", "PROCESSO"];
    const tipoLimpo = tipoEvento && !INVALID_TIPO_LABELS.includes(tipoEvento.toUpperCase()) 
      ? tipoEvento 
      : null;

    // Build description from tipo or peças
    let descricao = tipoLimpo ? tipoLimpo.replace(/_/g, " ") : null;
    
    // Se não temos tipo válido, tentar usar o primeiro código de peça como descrição
    if (!descricao && pecas.length > 0) {
      descricao = pecas[0].codigo;
    }
    
    // Fallback final
    if (!descricao) {
      descricao = `Evento ${eventNum}`;
    }

    eventos.push({
      numeroEvento: eventNum,
      data: data || PLACEHOLDER_NAO_IDENTIFICADO,
      hora,
      tipoEvento: tipoLimpo || (pecas.length > 0 ? pecas[0].codigo : "EVENTO"),
      descricaoLiteral: normalizeEventText(descricao),
      documentoVinculado: null,
      codigoTjto: tipoLimpo || (pecas.length > 0 ? pecas[0].codigo : null),
      labelEnriquecido: null,
      usuarioRegistro: usuario,
      pecasAnexas: pecas.length > 0 ? pecas.map(p => ({
        codigo: p.codigo,
        paginas: p.paginaMax,
        label: undefined, // Will be enriched via TJTO dictionary
      })) : undefined,
    });
  }

  // Sort by event number (EPROC events are always numbered sequentially)
  eventos.sort((a, b) => (a.numeroEvento ?? 0) - (b.numeroEvento ?? 0));

  // Log final result
  console.log(`[extractEprocEvents] PHASE 5 RESULT:`, {
    totalEvents: eventos.length,
    eventsWithDate: eventos.filter(e => e.data && e.data !== PLACEHOLDER_NAO_IDENTIFICADO).length,
    eventsWithPecas: eventos.filter(e => e.pecasAnexas && e.pecasAnexas.length > 0).length,
    totalPecas: eventos.reduce((sum, e) => sum + (e.pecasAnexas?.length || 0), 0),
  });

  if (eventos.length > 0) {
    console.log(`[extractEprocEvents] EPROC EXTRACTION SUCCESS: ${eventos.length} events extracted`);
    return eventos;
  }
  
  // =====================================================================
  // FALLBACK: Only when NO EPROC headers found (non-EPROC document)
  // =====================================================================
  console.log(`[extractEprocEvents] No EPROC headers found - using fallback strategies`);
  
  // Fallback Strategy 1: "PÁGINA DE SEPARAÇÃO" blocks (using patterns.ts)
  const separadorBlockPattern = new RegExp(EPROC.SEPARADOR_BLOCK.source, EPROC.SEPARADOR_BLOCK.flags);
  const blocks = normalizedText.match(separadorBlockPattern) || [];
  
  if (blocks.length > 0) {
    console.log(`[extractEprocEvents] Fallback: Found ${blocks.length} separator blocks`);
    for (const block of blocks) {
      const parsed = parseEprocBlock(block);
      if (parsed && parsed.numeroEvento !== null && !seenEventNumbers.has(parsed.numeroEvento)) {
        seenEventNumbers.add(parsed.numeroEvento);
        eventos.push(parsed);
      }
    }
    
    eventos.sort((a, b) => (a.numeroEvento ?? 0) - (b.numeroEvento ?? 0));
    return eventos;
  }
  
  // Fallback Strategy 2: Generic "Evento N" pattern (using patterns.ts)
  const eventoPattern = new RegExp(EPROC.EVENTO_GENERICO.source, EPROC.EVENTO_GENERICO.flags);
  let match: RegExpExecArray | null;
  
  while ((match = eventoPattern.exec(normalizedText)) !== null) {
    const eventNum = parseInt(match[1], 10);
    if (!seenEventNumbers.has(eventNum)) {
      const parsed = parseEprocBlockOCR(match[0], eventNum);
      if (parsed) {
        seenEventNumbers.add(eventNum);
        eventos.push(parsed);
      }
    }
  }
  
  eventos.sort((a, b) => (a.numeroEvento ?? 0) - (b.numeroEvento ?? 0));
  console.log(`[extractEprocEvents] Fallback: Extracted ${eventos.length} events`);
  return eventos;
}

/**
 * Calculate timeline quality metrics
 * - extractionQuality: ALTA (>80% with dates), MEDIA (50-80%), BAIXA (<50%)
 * - ordemSuspeita: true if dates appear regressive or inconsistent
 */
export function calculateTimelineQuality(eventos: EprocEventoExtraido[]): EprocTimelineQuality {
  const totalEvents = eventos.length;
  
  if (totalEvents === 0) {
    return {
      extractionQuality: "BAIXA",
      ordemSuspeita: false,
      totalEventsWithDate: 0,
      totalEvents: 0,
      datePercentage: 0,
    };
  }
  
  // Count events with valid dates
  const eventsWithDate = eventos.filter(e => 
    e.data && 
    e.data !== PLACEHOLDER_NAO_IDENTIFICADO &&
    /\d{2}\/\d{2}\/\d{4}/.test(e.data)
  );
  const totalEventsWithDate = eventsWithDate.length;
  const datePercentage = Math.round((totalEventsWithDate / totalEvents) * 100);
  
  // Check for regressive dates (date order doesn't match event order)
  let ordemSuspeita = false;
  
  if (eventsWithDate.length >= 2) {
    const sortedByEventNum = [...eventsWithDate].sort((a, b) => 
      (a.numeroEvento ?? 0) - (b.numeroEvento ?? 0)
    );
    
    let prevTimestamp = 0;
    let regressiveCount = 0;
    
    for (const evento of sortedByEventNum) {
      const ts = parseLocalDateToTimestamp(evento.data);
      if (ts > 0 && prevTimestamp > 0) {
        if (ts < prevTimestamp) {
          regressiveCount++;
        }
      }
      if (ts > 0) prevTimestamp = ts;
    }
    
    // If more than 10% of dates are regressive, mark as suspicious
    ordemSuspeita = regressiveCount > eventsWithDate.length * 0.1;
  }
  
  // Determine quality level
  let extractionQuality: "ALTA" | "MEDIA" | "BAIXA";
  if (datePercentage >= 80) {
    extractionQuality = "ALTA";
  } else if (datePercentage >= 50) {
    extractionQuality = "MEDIA";
  } else {
    extractionQuality = "BAIXA";
  }
  
  return {
    extractionQuality,
    ordemSuspeita,
    totalEventsWithDate,
    totalEvents,
    datePercentage,
  };
}

// parseLocalDateToTimestamp is now imported from ./patterns

/**
 * Parse a single EPROC event block (content after "PÁGINA DE SEPARAÇÃO")
 * Expected structure:
 *   Evento N
 *   Evento: EVENT_TYPE
 *   Data: dd/mm/yyyy hh:mm:ss
 *   Usuário: ...
 *   Processo: ...
 *   Sequência Evento: N
 */
function parseEprocBlock(blockText: string): EprocEventoExtraido | null {
  if (!blockText || blockText.trim().length < 10) return null;

  // Extract event number using PATTERNS
  const eventNumMatch = blockText.match(PATTERNS.EVENT_NUM);
  const numeroEvento = eventNumMatch ? parseInt(eventNumMatch[1], 10) : null;

  // Extract event type using PATTERNS
  const tipoEventoMatch = blockText.match(PATTERNS.EVENT_TYPE);
  const tipoEvento = tipoEventoMatch ? tipoEventoMatch[1] : "EVENTO";

  // Extract date and time using EPROC.DATA_LABEL
  const dateResult = extractDateFromContext(blockText);
  let data = dateResult.data || "";
  let hora = dateResult.hora;
  
  // Fallback: look for any date in the block
  if (!data) {
    const altDateMatch = blockText.match(PATTERNS.DATE_TIME);
    if (altDateMatch) {
      data = validateAndNormalizeDate(altDateMatch[1]) || "";
      hora = altDateMatch[2] || null;
    }
  }

  // No date found = invalid event
  if (!data) return null;

  // Extract linked document: "Processo ..., Evento 15, INF3, Página 1"
  const linkedDocMatch = blockText.match(/(Processo[^,\n]*,\s*Evento\s*\d+[^,\n]*,\s*(?:[A-Z]+\d*\s*,\s*)?P[áa]gina\s*\d+)/i);
  const documentoVinculado = linkedDocMatch ? linkedDocMatch[1].trim() : null;

  // Build literal description - take first meaningful lines
  const descricaoLiteral = normalizeEventText(buildEventDescription(blockText, tipoEvento));

  return {
    numeroEvento,
    data,
    hora,
    tipoEvento,
    descricaoLiteral,
    documentoVinculado,
    codigoTjto: tipoEvento !== "EVENTO" ? tipoEvento : null,
    labelEnriquecido: null,
  };
}

/**
 * Build a readable description from the event block
 */
function buildEventDescription(blockText: string, tipoEvento: string): string {
  // Clean up the block
  const lines = blockText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
  
  // Skip header lines (Evento N, Evento:, Data:, Usuário:, Processo:, Sequência)
  const skipPatterns = [
    /^Evento\s+\d+$/i,
    /^Evento:\s*/i,
    /^Data:\s*/i,
    /^Usu[aá]rio:\s*/i,
    /^Processo:\s*/i,
    /^Sequ[êe]ncia\s+Evento:\s*/i,
    /^pelo\s+sistema\.\)?$/i,
  ];
  
  const contentLines = lines.filter(line => {
    return !skipPatterns.some(p => p.test(line));
  });

  // If we have content lines, use them; otherwise use tipo
  // NO TRUNCATION - modo literal deve preservar tudo
  if (contentLines.length > 0) {
    return contentLines.join("\n");
  }
  
  return tipoEvento.replace(/_/g, " ");
}

// validateAndNormalizeDate is now imported from ./patterns

/**
 * Parse EPROC block from OCR text (handles dirty/noisy text)
 */
function parseEprocBlockOCR(blockText: string, eventNumber: number): EprocEventoExtraido | null {
  if (!blockText || blockText.trim().length < 10) return null;

  const numeroEvento = eventNumber;

  // Extract event type: "Evento: CODE" or just the code after "Evento N"
  // CORREÇÃO: Excluir labels comuns como "Data", "Evento", etc.
  const INVALID_TIPO_LABELS_OCR = ["DATA", "EVENTO", "USUARIO", "PAGINA", "PROCESSO"];
  const tipoEventoMatch = blockText.match(/Evento:\s*([A-Z0-9_]{3,})/i) ||
                          blockText.match(/(?:Evento|EVENTO)\s*\d+\s*[\n\r]+\s*([A-Z][A-Z0-9_]{2,})/i);
  let tipoEvento = tipoEventoMatch ? tipoEventoMatch[1].toUpperCase() : "EVENTO";
  
  // Filtrar tipos inválidos
  if (INVALID_TIPO_LABELS_OCR.includes(tipoEvento)) {
    tipoEvento = "EVENTO";
  }

  // Extract date with validation - try multiple patterns
  let data: string | null = null;
  let hora: string | null = null;
  
  // Pattern 1: "Data: dd/mm/yyyy hh:mm:ss"
  const dataMatch1 = blockText.match(/Data:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(\d{2}:\d{2}:\d{2})?/i);
  if (dataMatch1) {
    data = validateAndNormalizeDate(dataMatch1[1]);
    hora = dataMatch1[2] || null;
  }
  
  // Pattern 2: Any date in the block (fallback)
  if (!data) {
    const dateMatches = [...blockText.matchAll(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(\d{2}:\d{2}:\d{2})?/g)];
    for (const dm of dateMatches) {
      const validated = validateAndNormalizeDate(dm[1]);
      if (validated) {
        data = validated;
        hora = dm[2] || null;
        break; // Use first valid date
      }
    }
  }

  // No valid date = invalid event
  if (!data) return null;

  // Extract linked document
  const linkedDocMatch = blockText.match(/(Processo[^,\n]*,\s*Evento\s*\d+[^,\n]*,\s*(?:[A-Z]+\d*\s*,\s*)?P[áa]gina\s*\d+)/i);
  const documentoVinculado = linkedDocMatch ? linkedDocMatch[1].trim() : null;

  // Build description
  const descricaoLiteral = normalizeEventText(buildEventDescription(blockText, tipoEvento));

  return {
    numeroEvento,
    data,
    hora,
    tipoEvento,
    descricaoLiteral,
    documentoVinculado,
    codigoTjto: tipoEvento !== "EVENTO" ? tipoEvento : null,
    labelEnriquecido: null,
  };
}

// normalizeEventText is now imported from ./patterns

/**
 * Check if extraction result has sufficient data
 */
export function hasMinimalExtractionData(result: EprocExtractionResult): boolean {
  const hasEvents = result.eventos.length > 0;
  const hasCnj = result.capa.numeroCnj !== PLACEHOLDER_NAO_IDENTIFICADO;
  const hasParties = result.peticaoInicial.autores.length > 0 || 
                     result.peticaoInicial.reus.length > 0 ||
                     !!result.peticaoInicial.partesNeutras;
  
  return hasEvents || hasCnj || hasParties;
}

/**
 * Format extraction result for display
 */
export function formatExtractionForDisplay(result: EprocExtractionResult): string {
  const lines: string[] = [];
  
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("                    EXTRAÇÃO EPROC - DADOS ESTRUTURADOS");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  
  // Capa
  lines.push("▌ CAPA DO PROCESSO");
  lines.push(`  • Número CNJ: ${result.capa.numeroCnj}`);
  lines.push(`  • Classe da Ação: ${result.capa.classeAcao}`);
  lines.push(`  • Tipo de Ação: ${result.capa.tipoAcao}`);
  lines.push(`  • Vara/Juízo: ${result.capa.varaJuizo}`);
  lines.push(`  • Órgão Julgador: ${result.capa.orgaoJulgador}`);
  lines.push(`  • Juiz: ${result.capa.juiz}`);
  lines.push(`  • Comarca: ${result.capa.comarca}`);
  lines.push(`  • Data de Autuação: ${result.capa.dataAutuacao}`);
  lines.push(`  • Situação: ${result.capa.situacaoProcessual}`);
  if (result.capa.assuntos.length > 0) {
    lines.push(`  • Assuntos:`);
    for (const a of result.capa.assuntos) {
      lines.push(`    - [${a.codigo}] ${a.descricao}${a.principal ? " (Principal)" : ""}`);
    }
  }
  lines.push("");

  // Informações Adicionais
  lines.push("▌ INFORMAÇÕES ADICIONAIS");
  if (result.capa.chaveProcesso !== PLACEHOLDER_NAO_IDENTIFICADO) {
    lines.push(`  • Chave do Processo: ${result.capa.chaveProcesso}`);
  }
  lines.push(`  • Justiça Gratuita: ${result.capa.justicaGratuita ? "✓ Sim" : "Não"}`);
  if (result.capa.nivelSigilo !== PLACEHOLDER_NAO_IDENTIFICADO) {
    lines.push(`  • Nível de Sigilo: ${result.capa.nivelSigilo}`);
  }
  if (result.capa.segredoJustica) {
    lines.push(`  • 🔒 Segredo de Justiça`);
  }
  if (result.capa.prioridadeAtendimento) {
    lines.push(`  • ⚡ Prioridade de Atendimento`);
  }
  if (result.capa.antecipacaoTutela) {
    lines.push(`  • 🚨 Antecipação de Tutela Requerida`);
  }
  if (result.capa.peticaoUrgente) {
    lines.push(`  • ⏰ Petição Urgente`);
  }
  if (result.capa.vistaMinisterioPublico) {
    lines.push(`  • 📋 Vista ao Ministério Público`);
  }
  if (result.capa.processosApensos.length > 0) {
    lines.push(`  • Processos Apensos:`);
    for (const cnj of result.capa.processosApensos) {
      lines.push(`    - ${cnj}`);
    }
  }
  lines.push("");
  
  // Partes
  lines.push("▌ PARTES");
  if (result.peticaoInicial.partesNeutras) {
    lines.push(`  • Partes (sem classificação): ${result.peticaoInicial.partesNeutras}`);
  } else {
    if (result.peticaoInicial.autores.length > 0) {
      lines.push(`  • Autor(es): ${result.peticaoInicial.autores.join(", ")}`);
      // Show CPF if available
      for (const a of result.peticaoInicial.autoresDetalhados) {
        lines.push(`    - ${a.nome}`);
        if (a.documento) {
          lines.push(`      ${a.tipo === "PF" ? "CPF" : "CNPJ"}: ${a.documento}`);
        }
        if (a.procuradores && a.procuradores.length > 0) {
          lines.push(`      Adv: ${a.procuradores.map(p => `${p.nome} (OAB ${p.oab})`).join("; ")}`);
        }
      }
    } else {
      lines.push(`  • Autor(es): ${PLACEHOLDER_NAO_IDENTIFICADO}`);
    }
    if (result.peticaoInicial.reus.length > 0) {
      lines.push(`  • Réu(s): ${result.peticaoInicial.reus.join(", ")}`);
      for (const r of result.peticaoInicial.reusDetalhados) {
        lines.push(`    - ${r.nome}`);
        if (r.documento) {
          lines.push(`      ${r.tipo === "PF" ? "CPF" : "CNPJ"}: ${r.documento}`);
        }
        if (r.procuradores && r.procuradores.length > 0) {
          lines.push(`      Adv: ${r.procuradores.map(p => `${p.nome} (OAB ${p.oab})`).join("; ")}`);
        }
      }
    } else {
      lines.push(`  • Réu(s): ${PLACEHOLDER_NAO_IDENTIFICADO}`);
    }
  }
  lines.push(`  • Valor da Causa: ${result.peticaoInicial.valorDaCausa}`);
  lines.push("");
  
  // Advogado
  lines.push("▌ ADVOGADO");
  lines.push(`  • ${result.advogado.formatado}`);
  if (result.advogado.oabs.length > 1) {
    lines.push("  • Outros advogados:");
    for (let i = 1; i < result.advogado.oabs.length; i++) {
      const oab = result.advogado.oabs[i];
      const nomeStr = oab.nome ? `${oab.nome} — ` : "";
      lines.push(`    - ${nomeStr}OAB ${oab.oabUf} ${oab.oabNumero}`);
    }
  }
  if (result.advogado.emCausaPropria) {
    lines.push("  ⚖ Atuando em causa própria");
  }
  lines.push("");
  
  // Timeline
  const eventCount = result.eventos.length;
  const eventLabel = eventCount === 1 ? "EVENTO PROCESSUAL" : "EVENTOS PROCESSUAIS";
  lines.push(`▌ LINHA DO TEMPO (${eventCount} ${eventLabel})`);
  if (eventCount === 0) {
    lines.push("  Nenhum evento identificado nos documentos analisados.");
  } else {
    for (const evento of result.eventos) {
      const numStr = evento.numeroEvento !== null ? `Evento ${evento.numeroEvento}` : "Evento";
      const horaStr = evento.hora ? ` ${evento.hora}` : "";
      const codeStr = evento.codigoTjto ? ` — ${evento.codigoTjto}` : "";
      // Only show date if it exists and is not placeholder/undefined
      const hasValidDate = evento.data && evento.data !== PLACEHOLDER_NAO_IDENTIFICADO && evento.data !== "undefined";
      const dateStr = hasValidDate ? ` — ${evento.data}${horaStr}` : "";
      lines.push(`  ┌─ ${numStr}${dateStr}${codeStr}`);
      lines.push(`  │  ${evento.descricaoLiteral}`);
      if (evento.documentoVinculado) {
        lines.push(`  │  📎 ${evento.documentoVinculado}`);
      }
      lines.push(`  └──────────────────────────────────────────────`);
    }
  }
  lines.push("");
  
  // Peças
  if (result.pecasPosteriores.length > 0) {
    lines.push("▌ PEÇAS IDENTIFICADAS");
    for (const peca of result.pecasPosteriores) {
      lines.push(`  • ${peca.tipo} (${peca.data}): ${peca.nomeEvento}`);
    }
    lines.push("");
  }
  
  // Metadados
  lines.push("▌ METADADOS DA EXTRAÇÃO");
  lines.push(`  • Data da extração: ${new Date(result.meta.dataExtracao).toLocaleString("pt-BR")}`);
  lines.push(`  • Total de eventos: ${result.meta.totalEventos}`);
  lines.push(`  • Total de peças: ${result.meta.totalPecas}`);
  if (result.meta.camposAusentes.length > 0) {
    lines.push(`  • Campos ausentes: ${result.meta.camposAusentes.join(", ")}`);
  }
  lines.push("");
  
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(FRASE_FINAL_EXTRACAO);
  
  return lines.join("\n");
}
