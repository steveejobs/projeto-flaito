// src/lib/nijaPoloFilter.ts
// NIJA SUPREMO – Filtro de Estratégias por Polo (AUTOR vs RÉU)
// Filtra estratégias compatíveis com o lado de atuação no processo

import { NijaStrategyTemplate, NIJA_CORE_SPEC } from "@/nija/core/engine";

export type NijaPolo = "AUTOR" | "REU" | "INDEFINIDO";

/**
 * Vícios/Estratégias que são mais adequados para cada polo.
 * 
 * AUTOR (atacante): Estratégias ofensivas, correção de polo, prescrição intercorrente
 * RÉU (defensor): Estratégias defensivas, preliminares, nulidades, prescrição material
 */

// Códigos de defeitos tipicamente usados pelo RÉU (defesa)
const DEFECTS_REU: string[] = [
  // Temporais - Defesa clássica
  "PRESCRICAO_MATERIAL",
  "PRESCRICAO_INTERCORRENTE",
  "DECADENCIA",
  
  // Estruturais - Nulidades a favor do réu
  "NULIDADE_ABS_CITACAO_INEXISTENTE",
  "INCOMPETENCIA_ABSOLUTA",
  
  // Processuais - Carência de ação, ilegitimidade
  "ILEGITIMIDADE_PASSIVA",
  "ILEGITIMIDADE_ATIVA",
  "COISA_JULGADA",
  "LITISPENDENCIA",
  "FALTA_INTERESSE_AGIR",
  
  // Formais - Inépcia, falta de fundamentação
  "INEPCIA_INICIAL",
  "AUSENCIA_FUNDAMENTACAO",
  
  // Probatórios
  "PROVA_ILICITA",
  "CDA_IRREGULAR",
  
  // Materiais
  "EXCESSO_EXECUCAO",
  "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
  
  // Cerceamento (réu foi prejudicado)
  "CERCEAMENTO_DEFESA",
  
  // NOVOS - Título Executivo
  "TITULO_SEM_TESTEMUNHA",
  "TITULO_SEM_LIQUIDEZ",
  "TITULO_SEM_CERTEZA",
  "TITULO_SEM_EXIGIBILIDADE",
  "NOTA_PROMISSORIA_VINCULADA",
  "TITULO_PRESCRITO_CAMBIAL",
  
  // NOVOS - Bancários
  "JUROS_CAPITALIZADOS",
  "TAXA_JUROS_ABUSIVA",
  "TAC_INDEVIDA",
  "IOF_FINANCIADO",
  "VENCIMENTO_ANTECIPADO_ABUSIVO",
  "FORO_ELEICAO_ABUSIVO",
  
  // NOVOS - Processuais Execução
  "PENHORA_EXCESSIVA",
  "IMPENHORABILIDADE",
  "INTIMACAO_PENHORA_NULA",
];

// Códigos de defeitos tipicamente usados pelo AUTOR (ataque)
const DEFECTS_AUTOR: string[] = [
  // Temporais - Autor pode alegar se processo estava parado por culpa do réu
  "PRESCRICAO_INTERCORRENTE",
  
  // Processuais - Correção de polo, vícios sanáveis
  "ILEGITIMIDADE_PASSIVA", // Autor pode corrigir polo passivo
  "ILEGITIMIDADE_ATIVA", // Autor pode regularizar situação
  
  // Estruturais - Se o autor foi prejudicado por nulidade
  "INCOMPETENCIA_ABSOLUTA",
  
  // Formais - Vícios na decisão que prejudicaram o autor
  "AUSENCIA_FUNDAMENTACAO",
  "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
  
  // Cerceamento (autor foi prejudicado)
  "CERCEAMENTO_DEFESA",
  
  // Provas - Autor pode alegar prova ilícita usada contra ele
  "PROVA_ILICITA",
];

/**
 * Verifica se um defeito é compatível com o polo de atuação.
 */
export function isDefectCompatibleWithPolo(defectCode: string, polo: NijaPolo): boolean {
  if (polo === "INDEFINIDO") return true;
  
  const allowedDefects = polo === "AUTOR" ? DEFECTS_AUTOR : DEFECTS_REU;
  return allowedDefects.includes(defectCode);
}

/**
 * Filtra estratégias com base no polo de atuação.
 * Estratégias são filtradas se seus vícios recomendados são incompatíveis.
 */
export function filterStrategiesByPolo(
  strategies: NijaStrategyTemplate[],
  polo: NijaPolo
): NijaStrategyTemplate[] {
  if (polo === "INDEFINIDO") return strategies;
  
  const allowedDefects = polo === "AUTOR" ? DEFECTS_AUTOR : DEFECTS_REU;
  
  return strategies.filter((strategy) => {
    // Se a estratégia tem defeitos recomendados, pelo menos um deve ser compatível
    if (strategy.recommendedWhenDefects && strategy.recommendedWhenDefects.length > 0) {
      return strategy.recommendedWhenDefects.some((defectCode) =>
        allowedDefects.includes(defectCode)
      );
    }
    // Estratégias sem defeitos específicos são permitidas para ambos os polos
    return true;
  });
}

/**
 * Ranqueia e filtra estratégias do catálogo com base no polo.
 */
export function getStrategiesForPolo(
  polo: NijaPolo,
  detectedDefectCodes: string[]
): {
  main: NijaStrategyTemplate[];
  secondary: NijaStrategyTemplate[];
} {
  const allStrategies = NIJA_CORE_SPEC.strategyCatalog;
  const codesSet = new Set(detectedDefectCodes);
  
  // Primeiro filtra por polo
  const filteredByPolo = filterStrategiesByPolo(allStrategies, polo);
  
  // Depois separa em principais (match com vícios) e secundárias
  const main: NijaStrategyTemplate[] = [];
  const secondary: NijaStrategyTemplate[] = [];
  
  for (const strategy of filteredByPolo) {
    const hasMatch = strategy.recommendedWhenDefects.some((code) => codesSet.has(code));
    if (hasMatch) {
      main.push(strategy);
    } else if (strategy.applicableRamos.length > 0) {
      secondary.push(strategy);
    }
  }
  
  return { main, secondary };
}

/**
 * Gera um resumo tático considerando o polo de atuação.
 */
export function buildPoloAwareResumoTatico(
  polo: NijaPolo,
  defectsCount: number,
  mainStrategiesLabels: string[],
  ramoLabel?: string
): string {
  const poloLabel = polo === "AUTOR" ? "Autor/Exequente" : polo === "REU" ? "Réu/Executado" : "Não definido";
  
  const parts: string[] = [];
  
  parts.push(`Perspectiva de atuação: ${poloLabel}.`);
  
  if (ramoLabel) {
    parts.push(`Ramo identificado: ${ramoLabel}.`);
  }
  
  if (defectsCount > 0) {
    if (polo === "REU") {
      parts.push(`Foram identificados ${defectsCount} vício(s) processual(is) que podem fundamentar a defesa.`);
    } else if (polo === "AUTOR") {
      parts.push(`Foram identificados ${defectsCount} ponto(s) de atenção que podem afetar a pretensão ou serem explorados estrategicamente.`);
    } else {
      parts.push(`${defectsCount} vício(s) identificado(s).`);
    }
  }
  
  if (mainStrategiesLabels.length > 0) {
    if (polo === "REU") {
      parts.push(`Estratégias defensivas prioritárias: ${mainStrategiesLabels.join("; ")}.`);
    } else if (polo === "AUTOR") {
      parts.push(`Estratégias ofensivas sugeridas: ${mainStrategiesLabels.join("; ")}.`);
    } else {
      parts.push(`Estratégias sugeridas: ${mainStrategiesLabels.join("; ")}.`);
    }
  }
  
  return parts.join(" ");
}

/**
 * Ajusta a severidade/prioridade de um defeito com base no polo.
 * Alguns defeitos são mais críticos dependendo do lado de atuação.
 */
export function adjustSeverityForPolo(
  defectCode: string,
  baseSeverity: string,
  polo: NijaPolo
): string {
  // Prescrição material é CRÍTICA para o réu (defesa forte)
  if (defectCode === "PRESCRICAO_MATERIAL" && polo === "REU") {
    return "CRITICA";
  }
  
  // Inépcia da inicial é CRÍTICA para o réu
  if (defectCode === "INEPCIA_INICIAL" && polo === "REU") {
    return "CRITICA";
  }
  
  // CDA irregular é CRÍTICA para o executado
  if (defectCode === "CDA_IRREGULAR" && polo === "REU") {
    return "CRITICA";
  }
  
  // Cerceamento é mais crítico para quem foi cerceado
  if (defectCode === "CERCEAMENTO_DEFESA") {
    return "CRITICA";
  }
  
  return baseSeverity;
}
