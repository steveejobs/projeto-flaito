// src/lib/nija/displayHelpers.ts
// Helpers de exibição para o módulo NIJA

import type { NijaRamo } from "@/nija/core/engine";

/**
 * Retorna classes CSS para badge de severidade
 */
export function severityLabelColor(severity?: string): string {
  switch (severity) {
    case "CRITICA":
      return "bg-red-600 text-white";
    case "ALTA":
      return "bg-orange-500 text-white";
    case "MEDIA":
      return "bg-yellow-500 text-black";
    case "BAIXA":
      return "bg-green-600 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Retorna label legível para impacto
 */
export function impactLabel(impact?: string): string {
  switch (impact) {
    case "POTENCIAL_REVERSAO_TOTAL":
      return "Reversão total";
    case "POTENCIAL_REVERSAO_PARTE":
      return "Reversão parcial";
    case "PONTO_DE_ATENCAO":
      return "Ponto de atenção";
    case "SEM_IMPACTO_RELEVANTE":
      return "Impacto reduzido";
    default:
      return "Impacto não classificado";
  }
}

/**
 * Retorna label legível para ramo jurídico
 */
export function ramoLabel(ramo?: NijaRamo): string | undefined {
  if (!ramo) return undefined;
  const labels: Record<string, string> = {
    CIVIL: "Cível",
    PENAL: "Penal",
    TRABALHISTA: "Trabalhista",
    TRIBUTARIO: "Tributário",
    PREVIDENCIARIO: "Previdenciário",
    FAMILIA: "Família",
    ADMINISTRATIVO: "Administrativo",
    FAZENDARIO: "Fazendário",
    JUIZADOS: "Juizados Especiais",
    EXECUCAO_FISCAL: "Execução Fiscal",
    CONSUMIDOR: "Consumidor",
    OUTRO: "Outro",
  };
  return labels[ramo] || ramo;
}

/**
 * Formata tamanho de arquivo em bytes para string legível
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
