// src/lib/nija/eprocDetector.ts
// Detector de sistema processual - Heurística para identificar padrão EPROC

export type DetectedProcessSystem = "EPROC" | "UNKNOWN";

/**
 * Verifica se o texto contém número CNJ válido
 */
function hasCnj(text: string): boolean {
  return /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/.test(text);
}

/**
 * Detecta se o texto segue o padrão EPROC baseado em heurísticas
 * Não usa IA - apenas regex e contagem de sinais
 * 
 * Critérios:
 * - CNJ + pelo menos 2 sinais fortes OU
 * - 4+ sinais fortes sem CNJ
 */
export function detectProcessSystemFromText(raw: string): DetectedProcessSystem {
  const t = (raw || "").toUpperCase();

  // Heurísticas fortes do padrão EPROC (capa + eventos)
  const strongSignals = [
    "EVENTOS DO PROCESSO",
    "EVENTO",
    "PROCESSO",
    "PÁGINA",
    "INF",
    "DOCUMENTO",
    "PETIÇÃO",
    "INTIMAÇÃO",
    "CITAÇÃO",
    "DESPACHO",
    "SENTENÇA",
    "DECISÃO",
    "VARA",
    "COMARCA",
    "JUÍZO",
    "JUIZO",
    "AUTOR",
    "RÉU",
    "REU",
    "EXEQUENTE",
    "EXECUTADO",
  ];

  const hits = strongSignals.reduce((acc, s) => acc + (t.includes(s) ? 1 : 0), 0);

  // Critérios: CNJ + pelo menos 2 sinais fortes OU 4+ sinais fortes
  if ((hasCnj(raw) && hits >= 2) || hits >= 4) {
    return "EPROC";
  }

  return "UNKNOWN";
}

/**
 * Retorna descrição amigável do sistema detectado
 */
export function getSystemLabel(sys: DetectedProcessSystem): string {
  switch (sys) {
    case "EPROC":
      return "Processo Eletrônico (EPROC)";
    case "UNKNOWN":
      return "Formato não reconhecido";
  }
}
