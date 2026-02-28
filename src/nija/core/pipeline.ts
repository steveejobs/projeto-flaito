// src/lib/nijaEngine.ts
// NIJA SUPREMO – ENGINE V2
// Camada de orquestração que usa o NIJA_CORE_SPEC sem IA, sem custo.
// Agora com suporte a filtro por POLO (AUTOR vs RÉU)

import {
  NIJA_CORE_SPEC,
  NijaRamo,
  NijaDefect,
  NijaStrategyTemplate,
  NijaSeverity,
  NijaImpact,
} from "@/nija/core/engine";
import {
  NijaPolo,
  filterStrategiesByPolo,
  adjustSeverityForPolo,
  buildPoloAwareResumoTatico,
} from "@/nija/core/poloFilter";

// =========================
// Tipos de entrada/saída
// =========================

export interface NijaDetectedDefectInput {
  code: string;
  notas?: string | null;
  ramoInferido?: NijaRamo;
  severityOverride?: NijaSeverity;
  impactOverride?: NijaImpact;
  
  // Campos de contexto opcionais que serão propagados para o finding
  trecho?: string | null;
  offset?: { start: number; end: number };
  tipoDocumento?: string;  // Ex.: "Sentença", "Contestação"
  secaoDocumento?: string; // Ex.: "Fundamentação", "Dispositivo"
  documentoId?: string;    // ID do documento de origem
  documentoData?: string;  // Data do documento
  
  // Campos de rastreabilidade de polo/partes
  parteEnvolvida?: string | null;   // Ex.: "Autor", "Réu", "Exequente", "Executado"
  parteQuePraticou?: string | null; // Quem praticou o ato viciado
  ladoAfetado?: string | null;      // Quem se beneficia da alegação do vício
}

export interface NijaCaseContextInput {
  ramo?: NijaRamo;
  descricaoCaso?: string;
  observacoes?: string;
  polo?: NijaPolo;
}

// Novos campos de contexto para rastreabilidade
export interface NijaAto {
  tipo: string;        // Ex.: "Sentença", "Decisão de saneamento", "Contestação"
  id?: string;         // id interno do documento, se existir
  data?: string;       // ISO ou texto livre da data
}

export interface NijaTecnico {
  motivoDeteccao: string;
  criteriosAplicados: string[];
  fundamentosLegais: string[];
}

export interface NijaEngineFinding {
  defect: NijaDefect;
  notas?: string;
  ramoSugerido?: NijaRamo;
  severity?: string;
  impact?: string;
  
  // Campos de contexto
  ato?: NijaAto;
  secaoDocumento?: string;   // Ex.: "Fundamentação", "Preliminares", "Dispositivo"
  parteEnvolvida?: string;   // Ex.: "Autor", "Réu", "Exequente", "Executado"
  trecho?: string;           // Trecho textual exato que disparou a análise
  offset?: { start: number; end: number }; // índices no texto concatenado
  tecnico?: NijaTecnico;
}

export interface NijaEngineRecommendation {
  ramoFinal?: NijaRamo;
  poloFinal?: NijaPolo;
  findings: NijaEngineFinding[];
  mainStrategies: NijaStrategyTemplate[];
  secondaryStrategies: NijaStrategyTemplate[];
  unresolvedDefects: string[];
  resumoTatico: string;
}

// =========================
// Helpers internos
// =========================

function getDefectByCode(code: string): NijaDefect | undefined {
  return NIJA_CORE_SPEC.defectCatalog.find((d) => d.code === code);
}

// OBS: A inferência de ramo pelo catálogo de vícios foi DESATIVADA.
// REGRA: o ramo deve vir do contexto LEXOS (case.area) ou do nijaAnalyzer (cabeçalho/léxico),
// nunca por "chute" baseado em vícios típicos.
// Mantemos a função removida para evitar uso acidental.
// (Se precisar reativar no futuro, faça isso explicitamente e com validação humana.)
//
// function inferRamoFromDefects(defects: NijaEngineFinding[]): NijaRamo | undefined { ... }

function rankStrategies(
  ramo: NijaRamo | undefined,
  findings: NijaEngineFinding[]
): { main: NijaStrategyTemplate[]; secondary: NijaStrategyTemplate[] } {
  const codes = new Set(findings.map((f) => f.defect.code));
  const all = NIJA_CORE_SPEC.strategyCatalog;

  type Scored = {
    strat: NijaStrategyTemplate;
    score: number;
    hasDefectMatch: boolean;
  };

  const scored: Scored[] = all.map((strat) => {
    let score = 0;
    let hasDefectMatch = false;

    for (const c of strat.recommendedWhenDefects) {
      if (codes.has(c)) {
        score += 3;
        hasDefectMatch = true;
      }
    }

    if (ramo && strat.applicableRamos.includes(ramo)) {
      score += 2;
    }

    return { strat, score, hasDefectMatch };
  });

  const filtered = scored.filter((s) => s.score > 0);
  filtered.sort((a, b) => b.score - a.score);

  const main: NijaStrategyTemplate[] = [];
  const secondary: NijaStrategyTemplate[] = [];

  for (const s of filtered) {
    if (s.hasDefectMatch) {
      main.push(s.strat);
    } else {
      secondary.push(s.strat);
    }
  }

  return { main, secondary };
}

// =========================
// Helpers para preenchimento de contexto
// =========================

function inferTipoDocumento(defectCode: string): string {
  // Infere o tipo de documento provável baseado no tipo de vício
  const codeUpper = defectCode.toUpperCase();
  
  if (codeUpper.includes("SENTENCA") || codeUpper.includes("FUNDAMENTACAO")) {
    return "Sentença";
  }
  if (codeUpper.includes("CDA") || codeUpper.includes("EXECUCAO")) {
    return "Certidão de Dívida Ativa";
  }
  if (codeUpper.includes("CITACAO")) {
    return "Mandado de Citação / AR";
  }
  if (codeUpper.includes("INICIAL") || codeUpper.includes("INEPCIA")) {
    return "Petição Inicial";
  }
  
  return "Documento Processual";
}

function inferSecaoDocumento(defectCode: string): string {
  const codeUpper = defectCode.toUpperCase();
  
  if (codeUpper.includes("FUNDAMENTACAO")) {
    return "Fundamentação";
  }
  if (codeUpper.includes("PRESCRICAO") || codeUpper.includes("DECADENCIA")) {
    return "Mérito / Preliminares";
  }
  if (codeUpper.includes("CITACAO") || codeUpper.includes("ILEGITIMIDADE")) {
    return "Preliminares";
  }
  if (codeUpper.includes("SENTENCA")) {
    return "Dispositivo / Fundamentação";
  }
  if (codeUpper.includes("EXECUCAO") || codeUpper.includes("CALCULO")) {
    return "Memória de Cálculo / Planilha";
  }
  
  return "Corpo do documento";
}

function inferParteEnvolvida(defectCode: string): string {
  const codeUpper = defectCode.toUpperCase();
  
  if (codeUpper.includes("ILEGITIMIDADE_PASSIVA")) {
    return "Réu/Executado";
  }
  if (codeUpper.includes("ILEGITIMIDADE_ATIVA")) {
    return "Autor/Exequente";
  }
  if (codeUpper.includes("CITACAO")) {
    return "Réu";
  }
  if (codeUpper.includes("CDA") || codeUpper.includes("EXECUCAO_FISCAL")) {
    return "Executado";
  }
  if (codeUpper.includes("CERCEAMENTO")) {
    return "Parte prejudicada";
  }
  
  return "Parte interessada";
}

function buildMotivoDeteccao(defect: NijaDefect, input: NijaDetectedDefectInput): string {
  // Combina a lógica jurídica do defeito com as notas específicas
  let motivo = defect.legalLogic;
  
  if (input.notas) {
    motivo += ` Observação específica: ${input.notas}`;
  }
  
  return motivo;
}

function buildCriteriosAplicados(defect: NijaDefect, input: NijaDetectedDefectInput): string[] {
  const criterios: string[] = [];
  
  // Adiciona critérios baseados na categoria do defeito
  switch (defect.category) {
    case "TEMPORAL":
      criterios.push("Verificação de prazos e datas-limite");
      criterios.push("Análise de causas interruptivas e suspensivas");
      break;
    case "ESTRUTURAL":
      criterios.push("Verificação de pressupostos processuais");
      criterios.push("Análise de regularidade formal dos atos");
      break;
    case "PROCESSUAL":
      criterios.push("Verificação de condições da ação");
      criterios.push("Análise de legitimidade e interesse");
      break;
    case "PROBATORIO":
      criterios.push("Análise de suficiência probatória");
      criterios.push("Verificação de licitude da prova");
      break;
    case "FORMAL":
      criterios.push("Verificação de requisitos formais");
      criterios.push("Análise de fundamentação adequada");
      break;
    case "MATERIAL":
      criterios.push("Análise de mérito da pretensão");
      criterios.push("Verificação de valores e cálculos");
      break;
    default:
      criterios.push("Análise jurídica sistemática");
  }
  
  // Adiciona critérios específicos do defeito
  if (defect.recommendedActions && defect.recommendedActions.length > 0) {
    criterios.push(`Ações recomendadas: ${defect.recommendedActions.slice(0, 2).join("; ")}`);
  }
  
  return criterios;
}

function buildFundamentosLegais(defect: NijaDefect): string[] {
  const fundamentos: string[] = [];
  
  // Fundamentos genéricos por categoria
  switch (defect.category) {
    case "ESTRUTURAL":
      fundamentos.push("Arts. 485 e 337 do CPC - Pressupostos processuais");
      fundamentos.push("Art. 5º, LV, CF - Contraditório e ampla defesa");
      break;
    case "TEMPORAL":
      fundamentos.push("Arts. 189-211 do CC - Prescrição e decadência");
      fundamentos.push("Art. 332, §1º do CPC - Prescrição e decadência");
      break;
    case "PROCESSUAL":
      fundamentos.push("Arts. 17-18 do CPC - Condições da ação");
      fundamentos.push("Art. 485, VI do CPC - Extinção por carência");
      break;
    case "PROBATORIO":
      fundamentos.push("Arts. 369-380 do CPC - Provas");
      fundamentos.push("Art. 5º, LVI, CF - Inadmissibilidade de provas ilícitas");
      break;
    case "FORMAL":
      fundamentos.push("Art. 93, IX, CF - Fundamentação das decisões");
      fundamentos.push("Art. 489, §1º do CPC - Elementos da sentença");
      break;
    case "MATERIAL":
      fundamentos.push("Art. 141 do CPC - Princípio da congruência");
      fundamentos.push("Art. 492 do CPC - Julgamento ultra/extra/citra petita");
      break;
    default:
      fundamentos.push("Código de Processo Civil - Normas gerais");
  }
  
  // Adiciona contextos típicos como orientação
  if (defect.typicalContexts && defect.typicalContexts.length > 0) {
    const ramos = defect.typicalContexts.slice(0, 3).join(", ");
    fundamentos.push(`Aplicável especialmente em: ${ramos}`);
  }
  
  return fundamentos;
}

function buildResumoTatico(
  ramo: NijaRamo | undefined,
  findings: NijaEngineFinding[],
  mainStrategies: NijaStrategyTemplate[]
): string {
  const partes: string[] = [];

  // REGRA ABSOLUTA: o ramo NÃO é chute/heurística do motor.
  // Ele deve vir do contexto (case.area / nijaAnalyzer). Se vier vazio, manter INDEFINIDO.
  if (ramo) {
    partes.push(`Ramo identificado: ${ramo}.`);
  } else {
    partes.push(
      "Ramo identificado: INDEFINIDO – ramo não identificado com segurança. Confirme manualmente."
    );
  }

  if (findings.length > 0) {
    const criticos = findings.filter(
      (f) => f.severity === "CRITICA" || f.impact === "POTENCIAL_REVERSAO_TOTAL"
    );
    const altos = findings.filter(
      (f) => f.severity === "ALTA" || f.impact === "POTENCIAL_REVERSAO_PARTE"
    );

    if (criticos.length > 0) {
      partes.push(
        `Foram detectados vícios críticos com potencial de reversão relevante: ${criticos
          .map((f) => f.defect.label)
          .join("; ")}.`
      );
    }

    if (altos.length > 0) {
      partes.push(
        `Há também vícios com impacto elevado: ${altos
          .map((f) => f.defect.label)
          .join("; ")}.`
      );
    }
  }

  if (mainStrategies.length > 0) {
    partes.push(
      `Estratégias prioritárias sugeridas: ${mainStrategies
        .map((s) => s.label)
        .join("; ")}.`
    );
  }

  return partes.join(" ");
}

// =========================
// API principal do ENGINE
// =========================

export function runNijaEngine(
  context: NijaCaseContextInput,
  defectsInput: NijaDetectedDefectInput[]
): NijaEngineRecommendation {
  const findings: NijaEngineFinding[] = [];
  const unresolvedDefects: string[] = [];
  const polo: NijaPolo = context.polo || "INDEFINIDO";

  for (const input of defectsInput) {
    const d = getDefectByCode(input.code);
    if (!d) {
      unresolvedDefects.push(input.code);
      continue;
    }

    // Ajustar severidade com base no polo
    const baseSeverity = input.severityOverride ?? d.severity;
    const adjustedSeverity = adjustSeverityForPolo(d.code, baseSeverity, polo);
    const impact = input.impactOverride ?? d.impact;

    // Construir o objeto ato
    const ato: NijaAto = {
      tipo: input.tipoDocumento || inferTipoDocumento(d.code),
      id: input.documentoId,
      data: input.documentoData,
    };

    // Construir objeto tecnico
    const tecnico: NijaTecnico = {
      motivoDeteccao: buildMotivoDeteccao(d, input),
      criteriosAplicados: buildCriteriosAplicados(d, input),
      fundamentosLegais: buildFundamentosLegais(d),
    };

    findings.push({
      defect: d,
      notas: input.notas ?? undefined,
      ramoSugerido: input.ramoInferido,
      severity: adjustedSeverity,
      impact,
      ato,
      secaoDocumento: input.secaoDocumento || inferSecaoDocumento(d.code),
      parteEnvolvida: input.parteEnvolvida ?? inferParteEnvolvida(d.code),
      trecho: input.trecho ?? undefined,
      offset: input.offset,
      tecnico,
    });
  }

  const ramoFinal: NijaRamo | undefined = context.ramo;

  // REGRA ABSOLUTA: não inferir ramo via defeitos/findings.
  // Se não veio do contexto/analyzer, mantém indefinido para confirmação humana.

  // Ranquear estratégias e filtrar por polo
  let { main, secondary } = rankStrategies(ramoFinal, findings);
  
  // Filtrar estratégias pelo polo de atuação
  main = filterStrategiesByPolo(main, polo);
  secondary = filterStrategiesByPolo(secondary, polo);
  
  // Construir resumo tático com consciência do polo
  const resumoTatico = polo !== "INDEFINIDO"
    ? buildPoloAwareResumoTatico(
        polo,
        findings.length,
        main.map((s) => s.label),
        ramoFinal
      )
    : buildResumoTatico(ramoFinal, findings, main);

  return {
    ramoFinal,
    poloFinal: polo,
    findings,
    mainStrategies: main,
    secondaryStrategies: secondary,
    unresolvedDefects,
    resumoTatico,
  };
}

// =========================
// Utilidade para depuração / painel interno
// =========================

export function getNijaCoreOverview() {
  return {
    version: NIJA_CORE_SPEC.version,
    invariants: NIJA_CORE_SPEC.invariants,
    totalDefects: NIJA_CORE_SPEC.defectCatalog.length,
    totalStrategies: NIJA_CORE_SPEC.strategyCatalog.length,
    defectCodes: NIJA_CORE_SPEC.defectCatalog.map((d) => d.code),
    strategyCodes: NIJA_CORE_SPEC.strategyCatalog.map((s) => s.code),
  };
}
