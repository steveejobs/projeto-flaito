// src/lib/nija/helpers.ts
// NIJA Helper Functions - Pure utility functions for metadata normalization

// ======================================================
// TYPES
// ======================================================

export interface NormalizedPartyPrefill {
  clientName: string;
  opponentName: string;
  city: string;
}

// ======================================================
// HELPERS
// ======================================================

/**
 * Extrai o ano do número do processo CNJ/eProc
 * Exemplo: 0014085-38.2016.8.27.2706 → "2016"
 */
export function extractProcessYear(processNumber: string): string {
  if (!processNumber) return "";
  const match = processNumber.match(/\.(\d{4})\./);
  return match?.[1] || "";
}

/**
 * Normaliza comarca para cidade (remove prefixos e UF)
 * "Comarca de Araguaína/TO" → "Araguaína"
 * "Foro de São Paulo - SP" → "São Paulo"
 */
export function normalizeComarcaToCity(comarca: string): string {
  if (!comarca) return "";
  return comarca
    .replace(/^Comarca\s+de\s+/i, "")
    .replace(/^Foro\s+de\s+/i, "")
    .replace(/\s*[-\/]\s*[A-Z]{2}$/i, "") // Remove UF no final
    .replace(/\s*[-\/].*$/, "") // Remove sufixo após hífen/barra
    .trim();
}

/**
 * Normaliza as partes conforme o polo de atuação.
 * 
 * REGRA OBRIGATÓRIA:
 * - actingSide === "REU": cliente = parte passiva (réu/executado), contrária = parte ativa (autor/exequente)
 * - actingSide === "AUTOR": cliente = parte ativa (autor), contrária = parte passiva (réu)
 * 
 * Cidade: prioriza comarca/foro do juízo (NUNCA endereço de parte)
 */
export function normalizePartyPrefill(
  actingSide: "REU" | "AUTOR",
  detected: { authorName?: string; defendantName?: string; comarca?: string; vara?: string },
  existing: { clientName?: string; opponentName?: string; city?: string }
): NormalizedPartyPrefill {
  let clientName = existing.clientName || "";
  let opponentName = existing.opponentName || "";
  
  if (actingSide === "AUTOR") {
    // Cliente = parte ativa (autor/exequente)
    if (detected.authorName && !clientName) clientName = detected.authorName;
    // Parte contrária = parte passiva (réu/executado)
    if (detected.defendantName && !opponentName) opponentName = detected.defendantName;
  } else {
    // actingSide === "REU"
    // Cliente = parte passiva (réu/executado)
    if (detected.defendantName && !clientName) clientName = detected.defendantName;
    // Parte contrária = parte ativa (autor/exequente)
    if (detected.authorName && !opponentName) opponentName = detected.authorName;
  }
  
  // Cidade: prioriza comarca do juízo, NUNCA endereço de parte
  let city = existing.city || "";
  if (!city && detected.comarca) {
    city = normalizeComarcaToCity(detected.comarca);
  }
  
  return { clientName, opponentName, city };
}
