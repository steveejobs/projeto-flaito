/**
 * Stage 0 Cleanup & Quality Module (v1)
 * Deterministic rules for judicial document canonicalization.
 */

export const CLEANUP_RULES_V1 = [
  // Page numbering (Página 1 de 5, Fls 10, etc.)
  /Página\s+\d+\s+de\s+\d+/gi,
  /Fls\.?\s*:\s*\d+/gi,
  /Folha\s*\d+/gi,
  
  // Repetitive Judicial Headers (Conservative)
  /Tribunal de Justiça do Estado de [A-ZÀ-Ú ]+/gi,
  /PODER JUDICIÁRIO DO [A-ZÀ-Ú ]+/gi,
  /CORREGEDORIA GERAL DA JUSTIÇA/gi,
  
  // Addresses and boilerplate contacts
  /Rua\s+[^\n]+,\s*CEP:\s*\d{5}-\d{3}/gi,
  /Telefone:\s*\(\d{2}\)\s*\d{4,5}-\d{4}/gi,
  /E-mail:\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  
  // Digital signatures notices (deterministic layout)
  /Assinado eletronicamente por:[^\n]+/gi,
  /Documento assinado digitalmente nos termos da Lei[^\n]+/gi,
  
  // Non-material repetitive symbols
  /-{5,}/g,
  /_{5,}/g,
  /\.{10,}/g,
];

export function applyCleanup(text: string): string {
  let cleaned = text;
  
  // 1. Uniform line breaks
  cleaned = cleaned.replace(/\r\n/g, "\n");
  
  // 2. Remove boilerplate (Conservative)
  for (const rule of CLEANUP_RULES_V1) {
    cleaned = cleaned.replace(rule, "");
  }
  
  // 3. Normalize whitespace (Preserving paragraphs)
  cleaned = cleaned.replace(/[ \t]+/g, " ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  
  return cleaned.trim();
}

export function calculateQuality(rawText: string, cleanedText: string): { score: "GOOD" | "NOISY" | "BROKEN"; metrics: any } {
  const charCount = cleanedText.length;
  const wordCount = cleanedText.split(/\s+/).length;
  const lineCount = cleanedText.split("\n").length;
  
  // Deterministic checks
  const avgWordLen = charCount / (wordCount || 1);
  const density = charCount / (lineCount || 1);
  const cleanupRatio = cleanedText.length / (rawText.length || 1);

  let score: "GOOD" | "NOISY" | "BROKEN" = "GOOD";

  if (charCount < 100) {
    score = "BROKEN"; // Insufficient content
  } else if (avgWordLen > 25 || avgWordLen < 3) {
    score = "NOISY"; // Likely OCR failure or column layout issues
  } else if (density > 500) {
    score = "NOISY"; // Too much text per line, probably unformatted
  }
  
  return {
    score,
    metrics: { charCount, wordCount, lineCount, avgWordLen, density, cleanupRatio }
  };
}

export function generateSectionIndex(markdown: string) {
  const sections: { section_id: string; title: string; start_pos: number }[] = [];
  
  // Typical Brazilian Judicial Headers
  const sectionHeuristics = [
    { id: "relatorio", pattern: /^(RELATÓRIO|RELATADO)/im },
    { id: "fundamentacao", pattern: /^(FUNDAMENTAÇÃO|RAZÕES DE DECIDIR|DO DIREITO)/im },
    { id: "voto", pattern: /^(VOTO)/im },
    { id: "dispositivo", pattern: /^(DISPOSITIVO|ANTE O EXPOSTO|ACORDAM)/im },
    { id: "fatos", pattern: /^(DOS FATOS|DA SÍNTESE)/im },
    { id: "pedidos", pattern: /^(DOS PEDIDOS|DO REQUERIMENTO)/im },
  ];

  for (const h of sectionHeuristics) {
    const match = markdown.match(h.pattern);
    if (match && match.index !== undefined) {
      sections.push({
        section_id: h.id,
        title: match[0],
        start_pos: match.index
      });
    }
  }

  return sections.sort((a, b) => a.start_pos - b.start_pos);
}
