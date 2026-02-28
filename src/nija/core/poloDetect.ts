// src/lib/nijaPoloDetect.ts
// Utility for automatic detection of polo (REU/AUTOR) from EPROC extracted text

export type NijaPolo = "REU" | "AUTOR" | "INDEFINIDO";

export type NijaPoloSource = 
  | "EPROC_CAMPOS" 
  | "EPROC_PARTES" 
  | "METADADOS_CLIENTE" 
  | "HEURISTICA_TEXTO" 
  | "INDEFINIDO";

export type NijaPoloDetectResult = {
  poloDetected: NijaPolo;
  poloSource: NijaPoloSource;
  confidence: number; // 0..1
  evidences: string[]; // 1-5 lines
};

interface DetectPoloInput {
  rawText?: string;
  lines?: string[];
  clientName?: string;
  clientDoc?: string; // CPF/CNPJ (only digits compared)
  clientMetaRole?: string | null; // e.g.: "REU", "AUTOR", "EXECUTADO" etc.
}

// Polo pair patterns: left = AUTOR-like, right = REU-like
const POLO_PAIRS: Array<[string[], string[]]> = [
  [["AUTOR", "AUTORA", "AUTORES"], ["RÉU", "REU", "RÉ", "RE", "REUS", "RÉUS"]],
  [["REQUERENTE", "REQUERENTES"], ["REQUERIDO", "REQUERIDA", "REQUERIDOS"]],
  [["EXEQUENTE", "EXEQUENTES"], ["EXECUTADO", "EXECUTADA", "EXECUTADOS"]],
  [["IMPETRANTE", "IMPETRANTES"], ["IMPETRADO", "IMPETRADA", "IMPETRADOS"]],
  [["AGRAVANTE", "AGRAVANTES"], ["AGRAVADO", "AGRAVADA", "AGRAVADOS"]],
  [["RECORRENTE", "RECORRENTES"], ["RECORRIDO", "RECORRIDA", "RECORRIDOS"]],
  [["RECLAMANTE", "RECLAMANTES"], ["RECLAMADO", "RECLAMADA", "RECLAMADOS"]],
  [["APELANTE", "APELANTES"], ["APELADO", "APELADA", "APELADOS"]],
  [["EMBARGANTE", "EMBARGANTES"], ["EMBARGADO", "EMBARGADA", "EMBARGADOS"]],
];

// All AUTOR-like terms
const AUTOR_TERMS = POLO_PAIRS.flatMap(([a]) => a);
// All REU-like terms
const REU_TERMS = POLO_PAIRS.flatMap(([, r]) => r);

/**
 * Normalize CPF/CNPJ to only digits
 */
function normalizeDoc(doc: string | undefined | null): string {
  if (!doc) return "";
  return doc.replace(/\D/g, "");
}

/**
 * Normalize name: uppercase, no punctuation, collapsed spaces
 */
function normalizeName(name: string | undefined | null): string {
  if (!name) return "";
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncate string to max length
 */
function truncate(str: string, max: number = 80): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

/**
 * Check if a line contains a polo term and extract it
 */
function extractPoloFromLine(line: string): { polo: NijaPolo; term: string } | null {
  const upper = line.toUpperCase();
  
  for (const term of REU_TERMS) {
    if (upper.includes(term)) {
      return { polo: "REU", term };
    }
  }
  
  for (const term of AUTOR_TERMS) {
    if (upper.includes(term)) {
      return { polo: "AUTOR", term };
    }
  }
  
  return null;
}

/**
 * Check if text/line contains the client's document (CPF/CNPJ)
 */
function containsClientDoc(text: string, clientDocNorm: string): boolean {
  if (!clientDocNorm || clientDocNorm.length < 8) return false;
  const textDigits = text.replace(/\D/g, "");
  return textDigits.includes(clientDocNorm);
}

/**
 * Check if text/line contains the client's name
 */
function containsClientName(text: string, clientNameNorm: string): boolean {
  if (!clientNameNorm || clientNameNorm.length < 5) return false;
  const textNorm = normalizeName(text);
  // Check if the full name is present, or significant parts (at least 2 words)
  if (textNorm.includes(clientNameNorm)) return true;
  
  // Try partial match (first 2 significant words)
  const nameParts = clientNameNorm.split(" ").filter(p => p.length > 2);
  if (nameParts.length >= 2) {
    const partialName = nameParts.slice(0, 2).join(" ");
    return textNorm.includes(partialName);
  }
  
  return false;
}

/**
 * Main detection function with priority rules
 */
export function detectPoloFromEprocText(input: DetectPoloInput): NijaPoloDetectResult {
  const { rawText = "", lines: inputLines, clientName, clientDoc, clientMetaRole } = input;
  
  const evidences: string[] = [];
  const lines = inputLines || rawText.split("\n");
  const clientDocNorm = normalizeDoc(clientDoc);
  const clientNameNorm = normalizeName(clientName);
  
  // ============================================
  // RULE A: EPROC_CAMPOS - Explicit polo labels
  // ============================================
  // Look for lines with polo labels AND client association (doc or name)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const poloMatch = extractPoloFromLine(line);
    
    if (poloMatch) {
      // Check if this line or nearby lines (±3) contain the client
      const contextStart = Math.max(0, i - 3);
      const contextEnd = Math.min(lines.length, i + 4);
      const contextBlock = lines.slice(contextStart, contextEnd).join(" ");
      
      // Priority 1: CPF/CNPJ match (highest confidence)
      if (clientDocNorm && containsClientDoc(contextBlock, clientDocNorm)) {
        evidences.push(truncate(`CPF/CNPJ ${clientDoc} encontrado próximo a "${poloMatch.term}"`));
        return {
          poloDetected: poloMatch.polo,
          poloSource: "EPROC_CAMPOS",
          confidence: 0.95,
          evidences: evidences.slice(0, 5),
        };
      }
      
      // Priority 2: Name match (medium confidence)
      if (clientNameNorm && containsClientName(contextBlock, clientNameNorm)) {
        evidences.push(truncate(`Nome "${clientName}" encontrado próximo a "${poloMatch.term}"`));
        return {
          poloDetected: poloMatch.polo,
          poloSource: "EPROC_CAMPOS",
          confidence: 0.75,
          evidences: evidences.slice(0, 5),
        };
      }
    }
  }
  
  // ============================================
  // RULE B: EPROC_PARTES - "Partes e Representantes" section
  // ============================================
  const partesHeaderIdx = lines.findIndex(l => 
    /partes\s*(e|E)\s*representantes/i.test(l) || 
    /partes\s*do\s*processo/i.test(l) ||
    /qualifica[çc][ãa]o\s*das\s*partes/i.test(l)
  );
  
  if (partesHeaderIdx >= 0) {
    // Analyze up to 50 lines after the header
    const partesSection = lines.slice(partesHeaderIdx, partesHeaderIdx + 50).join("\n");
    
    for (let i = partesHeaderIdx; i < Math.min(lines.length, partesHeaderIdx + 50); i++) {
      const line = lines[i];
      const poloMatch = extractPoloFromLine(line);
      
      if (poloMatch) {
        // Check nearby context for client
        const contextStart = Math.max(partesHeaderIdx, i - 2);
        const contextEnd = Math.min(lines.length, i + 3);
        const contextBlock = lines.slice(contextStart, contextEnd).join(" ");
        
        // CPF/CNPJ match
        if (clientDocNorm && containsClientDoc(contextBlock, clientDocNorm)) {
          evidences.push(truncate(`CPF/CNPJ ${clientDoc} na seção "Partes" como "${poloMatch.term}"`));
          return {
            poloDetected: poloMatch.polo,
            poloSource: "EPROC_PARTES",
            confidence: 0.95,
            evidences: evidences.slice(0, 5),
          };
        }
        
        // Name match
        if (clientNameNorm && containsClientName(contextBlock, clientNameNorm)) {
          evidences.push(truncate(`Nome "${clientName}" na seção "Partes" como "${poloMatch.term}"`));
          return {
            poloDetected: poloMatch.polo,
            poloSource: "EPROC_PARTES",
            confidence: 0.75,
            evidences: evidences.slice(0, 5),
          };
        }
      }
    }
  }
  
  // ============================================
  // RULE C: METADADOS_CLIENTE - Client metadata role
  // ============================================
  if (clientMetaRole) {
    const roleUpper = clientMetaRole.toUpperCase();
    
    // Check for REU-like terms
    for (const term of REU_TERMS) {
      if (roleUpper.includes(term)) {
        evidences.push(truncate(`Papel do cliente nos metadados: "${clientMetaRole}"`));
        return {
          poloDetected: "REU",
          poloSource: "METADADOS_CLIENTE",
          confidence: 0.85,
          evidences: evidences.slice(0, 5),
        };
      }
    }
    
    // Check for AUTOR-like terms
    for (const term of AUTOR_TERMS) {
      if (roleUpper.includes(term)) {
        evidences.push(truncate(`Papel do cliente nos metadados: "${clientMetaRole}"`));
        return {
          poloDetected: "AUTOR",
          poloSource: "METADADOS_CLIENTE",
          confidence: 0.85,
          evidences: evidences.slice(0, 5),
        };
      }
    }
  }
  
  // ============================================
  // RULE D: HEURISTICA_TEXTO - Text proximity heuristic
  // ============================================
  if (clientNameNorm && clientNameNorm.length >= 5) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (containsClientName(line, clientNameNorm)) {
        // Check ±2 lines for polo terms
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(lines.length, i + 3);
        
        for (let j = contextStart; j < contextEnd; j++) {
          const contextLine = lines[j];
          const poloMatch = extractPoloFromLine(contextLine);
          
          if (poloMatch) {
            evidences.push(truncate(`Nome "${clientName}" próximo a "${poloMatch.term}" (linha ${j + 1})`));
            return {
              poloDetected: poloMatch.polo,
              poloSource: "HEURISTICA_TEXTO",
              confidence: 0.60,
              evidences: evidences.slice(0, 5),
            };
          }
        }
      }
    }
  }
  
  // ============================================
  // RULE E: INDEFINIDO - No evidence found
  // ============================================
  evidences.push("Nenhuma associação clara entre cliente e polo encontrada");
  
  return {
    poloDetected: "INDEFINIDO",
    poloSource: "INDEFINIDO",
    confidence: 0,
    evidences: evidences.slice(0, 5),
  };
}
