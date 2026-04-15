// supabase/functions/_shared/medical-safety.ts
// Camada de proteção P0 contra alucinações diagnósticas e prescritivas da IA.

export interface SafetyResult {
  isSafe: boolean;
  sanitizedContent: string;
  blockedReason?: string;
}

/**
 * Padrões que indicam tentativa de diagnóstico ou conclusão clínica assertiva.
 */
const FORBIDDEN_INTENTS = [
  // Diagnóstico
  /\b(você|o paciente) (tem|possui|sofre de|apresenta a doença)\b/i,
  /\bdiagnóstico (fechado|é|confirmado de)\b/i,
  /\bpatologia (detectada|confirmada)\b/i,
  
  // Prescrição
  /\b(tome|tomar|ingerir|use|aplicar) \d+(mg|g|ml|gotas)\b/i,
  /\b(receito|prescrevo|indico o uso de)\b/i,
  /\b(protocolo de tratamento|ciclo de)\b/i,
  
  // Tratamento / Cura
  /\b(cura para|tratamento definitivo de)\b/i,
  /\b(essencial para tratar|combater a doença)\b/i
];

/**
 * Keywords que acionam alerta imediato para revisão humana redobrada.
 */
const SENSITIVE_KEYWORDS = [
  "cura", "doença", "medicamento", "remédio", "posologia", 
  "diagnóstico", "prescrição", "tratamento", "patologia",
  "receita", "fármaco", "dose", "dosagem"
];

const SAFE_FAIL_RESPONSE = {
  summary: "Análise técnica interrompida por protocolo de segurança clínica.",
  details: "A resposta gerada pela IA continha padrões diagnósticos ou prescritivos não permitidos. O profissional deve realizar a análise manual.",
  findings: [],
  requires_review: true,
  safety_blocked: true
};

/**
 * Valida a resposta da IA contra regras éticas e de segurança P0.
 */
export function validateMedicalResponse(content: string): SafetyResult {
  const normalizedContent = content.toLowerCase();

  // 1. Verificar intenções proibidas (Regex)
  for (const pattern of FORBIDDEN_INTENTS) {
    if (pattern.test(content)) {
      console.warn(`[SAFETY] Blocked due to forbidden intent: ${pattern}`);
      return {
        isSafe: false,
        sanitizedContent: JSON.stringify(SAFE_FAIL_RESPONSE),
        blockedReason: "FORBIDDEN_INTENT_DETECTED"
      };
    }
  }

  // 2. Verificar densidade de keywords sensíveis 
  // Se houver excesso de termos médicos assertivos sem linguagem sugestiva, bloqueia.
  const hits = SENSITIVE_KEYWORDS.filter(kw => normalizedContent.includes(kw));
  
  // Se usar muitas keywords críticas mas NÃO usar termos de cautela (sugere, compatível, investigar)
  const cautionTerms = ["sugere", "compatível", "investigar", "observado", "referência", "profissional"];
  const hasCaution = cautionTerms.some(t => normalizedContent.includes(t));

  if (hits.length > 4 && !hasCaution) {
    console.warn(`[SAFETY] Blocked due to high sensitivity density without caution terms.`);
    return {
      isSafe: false,
      sanitizedContent: JSON.stringify(SAFE_FAIL_RESPONSE),
      blockedReason: "LACK_OF_CAUTIONARY_LANGUAGE"
    }
  }

  return {
    isSafe: true,
    sanitizedContent: content
  };
}
