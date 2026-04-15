// src/lib/nijaAnalyzer.ts
// NIJA SUPREMO – ANALYZER V2 (Dual Mode com detecção expandida)
// Orquestra documentos + contexto do caso + NIJA_ENGINE, sem IA e sem custo.

import {
  runNijaEngine,
  getNijaCoreOverview,
  type NijaCaseContextInput,
  type NijaDetectedDefectInput,
  type NijaEngineRecommendation,
} from "@/nija/core/pipeline";

import type { NijaRamo } from "@/nija/core/engine";

// Import detectores automáticos que aceitam apenas texto
import {
  detectNotaPromissoriaVinculada,
  detectJurosCapitalizados,
  detectVencimentoAntecipadoAbusivo,
  detectImpenhorabilidade,
  type DetectionResult,
} from "@/nija/analysis/defectDetectors";

// =========================
// Tipos públicos do ANALYZER
// =========================

import type {
  NijaAnalysisMode,
  NijaDocumentInput,
  NijaAnalyzerResponse,
} from "@/types/nija-contracts";

export type {
  NijaAnalysisMode,
  NijaDocumentInput,
  NijaAnalyzerResponse,
};

// Resultado intermediário da heurística com metadados de contexto
export interface NijaDetectedDefectWithContext extends NijaDetectedDefectInput {
  trecho?: string;
  offset?: { start: number; end: number };
  tipoDocumento?: string;
  secaoDocumento?: string;
}

export interface NijaAnalyzerRequest {
  mode: NijaAnalysisMode;
  caseContext: NijaCaseContextInput;
  documents: NijaDocumentInput[];
  preDetectedDefects?: NijaDetectedDefectInput[];
}

// =========================
// Funções internas auxiliares
// =========================

function validateDocumentsForAnalysis(documents: NijaDocumentInput[]): string[] {
  const warnings: string[] = [];

  if (documents.length === 0) {
    warnings.push("Nenhum documento foi fornecido para análise pelo NIJA.");
    return warnings;
  }

  for (const doc of documents) {
    if (!doc.content || doc.content.trim().length === 0) {
      warnings.push(
        `Documento "${doc.filename}" (ID: ${doc.id}) está sem texto extraído ou está vazio.`
      );
    } else if (doc.content.trim().length < 200) {
      warnings.push(
        `Documento "${doc.filename}" (ID: ${doc.id}) possui texto muito curto; a análise jurídica pode ficar limitada.`
      );
    }
  }

  return warnings;
}

/**
 * Heurística expandida V2 com extração de contexto.
 * Detecta padrões textuais associados a vícios do catálogo NIJA.
 * Agora inclui trecho, offset, tipo de documento e seção.
 */
function basicHeuristicDefectDetection(
  documents: NijaDocumentInput[]
): NijaDetectedDefectInput[] {
  const defects: NijaDetectedDefectInput[] = [];
  const detectedCodes = new Set<string>();

  // Concatenar textos com mapeamento de offsets por documento
  let fullText = "";
  const docOffsets: { docId: string; start: number; end: number; kind?: string; label?: string }[] = [];
  
  for (const doc of documents) {
    const content = doc.content || "";
    const start = fullText.length;
    fullText += content + "\n";
    const end = fullText.length;
    docOffsets.push({ docId: doc.id, start, end, kind: doc.kind, label: doc.label || doc.filename });
  }

  const fullTextLower = fullText.toLowerCase();

  // Helper para encontrar trecho e contexto
  const findTrechoAndContext = (pattern: string): {
    trecho: string;
    offset: { start: number; end: number };
    docKind?: string;
    docLabel?: string;
  } | null => {
    const idx = fullTextLower.indexOf(pattern.toLowerCase());
    if (idx === -1) return null;
    
    // Extrair trecho com contexto (até 100 chars antes e 150 depois)
    const contextStart = Math.max(0, idx - 100);
    const contextEnd = Math.min(fullText.length, idx + pattern.length + 150);
    const trecho = fullText.substring(contextStart, contextEnd).trim();
    
    // Encontrar qual documento contém esse offset
    let docKind: string | undefined;
    let docLabel: string | undefined;
    for (const docOff of docOffsets) {
      if (idx >= docOff.start && idx < docOff.end) {
        docKind = docOff.kind;
        docLabel = docOff.label;
        break;
      }
    }
    
    return { 
      trecho: `...${trecho}...`, 
      offset: { start: idx, end: idx + pattern.length },
      docKind,
      docLabel
    };
  };

  // Helper para adicionar defeito com contexto
  const addDefect = (
    code: string, 
    notas: string, 
    searchPattern: string,
    tipoDocumentoFallback?: string,
    secaoDocumento?: string
  ) => {
    if (detectedCodes.has(code)) return;
    detectedCodes.add(code);
    
    const context = findTrechoAndContext(searchPattern);
    
    defects.push({ 
      code, 
      notas,
      trecho: context?.trecho,
      offset: context?.offset,
      tipoDocumento: context?.docKind || tipoDocumentoFallback,
      secaoDocumento
    });
  };

  // ==================== PRESCRIÇÃO MATERIAL ====================
  if (
    fullTextLower.includes("prescrição") &&
    (fullTextLower.includes("reconheço a prescrição") ||
      fullTextLower.includes("declaro prescrito") ||
      fullTextLower.includes("pronuncio a prescrição") ||
      fullTextLower.includes("prazo prescricional") ||
      fullTextLower.includes("prescrição consumada") ||
      fullTextLower.includes("já prescrito"))
  ) {
    addDefect(
      "PRESCRICAO_MATERIAL",
      "Há menção expressa à prescrição no documento. Conferir datas e prazos na linha do tempo.",
      "prescrição",
      "Sentença ou Decisão",
      "Mérito / Preliminares"
    );
  }

  // ==================== PRESCRIÇÃO INTERCORRENTE ====================
  if (
    (fullTextLower.includes("arquivado") && fullTextLower.includes("art. 40")) ||
    fullTextLower.includes("prescrição intercorrente") ||
    fullTextLower.includes("sem movimentação há mais de") ||
    fullTextLower.includes("paralisado por mais de") ||
    (fullTextLower.includes("arquivamento") && fullTextLower.includes("inércia do exequente"))
  ) {
    addDefect(
      "PRESCRICAO_INTERCORRENTE",
      "Identificados indícios de paralisação prolongada do processo. Verificar datas de arquivamento e retomada.",
      "prescrição intercorrente",
      "Decisão ou Despacho",
      "Andamentos processuais"
    );
  }

  // ==================== DECADÊNCIA ====================
  if (
    fullTextLower.includes("decadência") ||
    fullTextLower.includes("decadencial") ||
    fullTextLower.includes("prazo decadencial") ||
    fullTextLower.includes("direito potestativo")
  ) {
    addDefect(
      "DECADENCIA",
      "Há menção a decadência no documento. Verificar natureza do direito e prazo aplicável.",
      "decadência",
      "Sentença ou Contestação",
      "Mérito / Preliminares"
    );
  }

  // ==================== NULIDADE DE CITAÇÃO ====================
  if (
    fullTextLower.includes("não foi citado") ||
    fullTextLower.includes("ausência de citação") ||
    fullTextLower.includes("nulidade da citação") ||
    fullTextLower.includes("citação inexistente") ||
    fullTextLower.includes("citação nula") ||
    fullTextLower.includes("citação por edital inválida") ||
    fullTextLower.includes("não houve citação válida") ||
    fullTextLower.includes("não citado")
  ) {
    addDefect(
      "NULIDADE_ABS_CITACAO_INEXISTENTE",
      "Texto indica discussão sobre ausência ou nulidade de citação. Conferir AR, certidões e intimações.",
      "citação",
      "Mandado / AR / Certidão",
      "Atos de comunicação"
    );
  }

  // ==================== INCOMPETÊNCIA ABSOLUTA ====================
  if (
    fullTextLower.includes("incompetência absoluta") ||
    fullTextLower.includes("incompetência material") ||
    fullTextLower.includes("incompetência em razão da matéria") ||
    fullTextLower.includes("incompetência funcional") ||
    (fullTextLower.includes("incompetente") && fullTextLower.includes("juízo"))
  ) {
    addDefect(
      "INCOMPETENCIA_ABSOLUTA",
      "Há indícios de discussão sobre incompetência absoluta. Verificar natureza da causa e juízo competente.",
      "incompetência",
      "Contestação ou Exceção",
      "Preliminares"
    );
  }

  // ==================== CDA / EXECUÇÃO FISCAL ====================
  if (
    fullTextLower.includes("certidão de dívida ativa") ||
    fullTextLower.includes("cda nº") ||
    fullTextLower.includes("cda n.") ||
    fullTextLower.includes("execução fiscal") ||
    fullTextLower.includes("vício na cda") ||
    fullTextLower.includes("nulidade da cda") ||
    fullTextLower.includes("requisitos da cda")
  ) {
    addDefect(
      "CDA_IRREGULAR",
      "Documento menciona CDA/execução fiscal. A irregularidade específica depende de confrontar a CDA com os requisitos legais.",
      "cda",
      "Certidão de Dívida Ativa",
      "Título executivo"
    );
  }

  // ==================== CERCEAMENTO DE DEFESA ====================
  if (
    fullTextLower.includes("cerceamento de defesa") ||
    fullTextLower.includes("indeferimento de prova") ||
    fullTextLower.includes("prova essencial indeferida") ||
    fullTextLower.includes("prova indeferida") ||
    fullTextLower.includes("negou a produção de prova") ||
    (fullTextLower.includes("julgamento antecipado") && fullTextLower.includes("prova pericial"))
  ) {
    addDefect(
      "CERCEAMENTO_DEFESA",
      "Há menção a cerceamento de defesa ou indeferimento de prova relevante. Verificar decisões de saneamento e sentença.",
      "cerceamento",
      "Decisão de Saneamento ou Sentença",
      "Instrução probatória"
    );
  }

  // ==================== PROVA ILÍCITA ====================
  if (
    fullTextLower.includes("prova ilícita") ||
    fullTextLower.includes("interceptação telefônica") ||
    fullTextLower.includes("gravação sem autorização") ||
    fullTextLower.includes("prova obtida ilicitamente") ||
    fullTextLower.includes("frutos da árvore envenenada") ||
    fullTextLower.includes("escuta ilegal") ||
    fullTextLower.includes("busca e apreensão ilegal")
  ) {
    addDefect(
      "PROVA_ILICITA",
      "Há indícios de discussão sobre prova ilícita. Verificar origem e meio de obtenção das provas.",
      "prova ilícita",
      "Sentença ou Acórdão",
      "Fundamentação"
    );
  }

  // ==================== SENTENÇA EXTRA/ULTRA/CITRA PETITA ====================
  if (
    fullTextLower.includes("extra petita") ||
    fullTextLower.includes("ultra petita") ||
    fullTextLower.includes("citra petita") ||
    fullTextLower.includes("julgou além do pedido") ||
    fullTextLower.includes("julgou fora do pedido") ||
    fullTextLower.includes("não apreciou o pedido") ||
    fullTextLower.includes("omissão quanto ao pedido") ||
    fullTextLower.includes("além dos limites do pedido")
  ) {
    addDefect(
      "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
      "Há indícios de sentença que extrapolou ou omitiu pedidos. Comparar dispositivo com a inicial.",
      "petita",
      "Sentença",
      "Dispositivo"
    );
  }

  // ==================== ILEGITIMIDADE PASSIVA ====================
  if (
    fullTextLower.includes("ilegitimidade passiva") ||
    fullTextLower.includes("parte ilegítima") ||
    fullTextLower.includes("não é parte legítima") ||
    fullTextLower.includes("ilegitimidade de parte")
  ) {
    addDefect(
      "ILEGITIMIDADE_PASSIVA",
      "Há discussão sobre ilegitimidade passiva. Verificar relação jurídica material.",
      "ilegitimidade passiva",
      "Contestação",
      "Preliminares"
    );
  }

  // ==================== ILEGITIMIDADE ATIVA ====================
  if (
    fullTextLower.includes("ilegitimidade ativa") ||
    fullTextLower.includes("autor não é parte legítima") ||
    fullTextLower.includes("legitimidade do autor")
  ) {
    addDefect(
      "ILEGITIMIDADE_ATIVA",
      "Há discussão sobre ilegitimidade ativa. Verificar titularidade do direito.",
      "ilegitimidade ativa",
      "Contestação",
      "Preliminares"
    );
  }

  // ==================== COISA JULGADA ====================
  if (
    fullTextLower.includes("coisa julgada") ||
    fullTextLower.includes("trânsito em julgado") ||
    fullTextLower.includes("res judicata") ||
    fullTextLower.includes("ofensa à coisa julgada") ||
    fullTextLower.includes("já transitou em julgado")
  ) {
    addDefect(
      "COISA_JULGADA",
      "Há menção a coisa julgada. Verificar existência de processo anterior com mesmo objeto.",
      "coisa julgada",
      "Contestação ou Sentença",
      "Preliminares"
    );
  }

  // ==================== LITISPENDÊNCIA ====================
  if (
    fullTextLower.includes("litispendência") ||
    fullTextLower.includes("ação idêntica em trâmite") ||
    fullTextLower.includes("mesma ação já proposta")
  ) {
    addDefect(
      "LITISPENDENCIA",
      "Há indícios de litispendência. Verificar existência de ação idêntica em trâmite.",
      "litispendência",
      "Contestação",
      "Preliminares"
    );
  }

  // ==================== FALTA DE INTERESSE DE AGIR ====================
  if (
    fullTextLower.includes("falta de interesse") ||
    fullTextLower.includes("ausência de interesse de agir") ||
    fullTextLower.includes("interesse processual") ||
    fullTextLower.includes("carência de ação")
  ) {
    addDefect(
      "FALTA_INTERESSE_AGIR",
      "Há discussão sobre interesse de agir. Verificar necessidade e adequação da via eleita.",
      "interesse de agir",
      "Contestação ou Sentença",
      "Condições da ação"
    );
  }

  // ==================== INÉPCIA DA INICIAL ====================
  if (
    fullTextLower.includes("inépcia da inicial") ||
    fullTextLower.includes("petição inepta") ||
    fullTextLower.includes("falta de pedido") ||
    fullTextLower.includes("pedido genérico") ||
    fullTextLower.includes("causa de pedir ausente") ||
    fullTextLower.includes("pedidos incompatíveis")
  ) {
    addDefect(
      "INEPCIA_INICIAL",
      "Há discussão sobre inépcia da petição inicial. Verificar requisitos do art. 319 do CPC.",
      "inépcia",
      "Petição Inicial",
      "Requisitos formais"
    );
  }

  // ==================== AUSÊNCIA DE FUNDAMENTAÇÃO ====================
  if (
    fullTextLower.includes("ausência de fundamentação") ||
    fullTextLower.includes("falta de fundamentação") ||
    fullTextLower.includes("decisão não fundamentada") ||
    fullTextLower.includes("art. 93, ix") ||
    fullTextLower.includes("nula a sentença por ausência de fundamentos") ||
    fullTextLower.includes("motivação insuficiente")
  ) {
    addDefect(
      "AUSENCIA_FUNDAMENTACAO",
      "Há indícios de decisão sem fundamentação adequada. Verificar art. 93, IX, CF e art. 489, §1º, CPC.",
      "fundamentação",
      "Sentença ou Decisão",
      "Fundamentação"
    );
  }

  // ==================== EXCESSO DE EXECUÇÃO ====================
  if (
    fullTextLower.includes("excesso de execução") ||
    fullTextLower.includes("cobrança a maior") ||
    fullTextLower.includes("valor cobrado excede") ||
    fullTextLower.includes("execução em valor superior") ||
    fullTextLower.includes("penhora excessiva")
  ) {
    addDefect(
      "EXCESSO_EXECUCAO",
      "Há indícios de excesso de execução. Verificar memória de cálculo e valores cobrados.",
      "excesso de execução",
      "Impugnação ou Embargos",
      "Memória de cálculo"
    );
  }

  // ==================== ERRO DE CÁLCULO ====================
  if (
    fullTextLower.includes("erro de cálculo") ||
    fullTextLower.includes("erro aritmético") ||
    fullTextLower.includes("erro material") ||
    fullTextLower.includes("cálculo incorreto")
  ) {
    addDefect(
      "ERRO_CALCULO",
      "Há menção a erro de cálculo ou material. Verificar valores e operações aritméticas.",
      "erro de cálculo",
      "Sentença ou Planilha",
      "Cálculos"
    );
  }

  // ==================== MULTA CONFISCATÓRIA ====================
  if (
    fullTextLower.includes("multa confiscatória") ||
    fullTextLower.includes("caráter confiscatório") ||
    fullTextLower.includes("multa superior a 100%") ||
    fullTextLower.includes("multa de 150%") ||
    fullTextLower.includes("multa de 200%") ||
    (fullTextLower.includes("multa") && fullTextLower.includes("vedação ao confisco"))
  ) {
    addDefect(
      "MULTA_CONFISCATORIA",
      "Há indícios de multa com caráter confiscatório. Verificar percentual aplicado e limite do STF.",
      "multa confiscatória",
      "Auto de Infração ou CDA",
      "Penalidades"
    );
  }

  // ==================== FALTA DE INTIMAÇÃO ====================
  if (
    fullTextLower.includes("não intimado") ||
    fullTextLower.includes("ausência de intimação") ||
    fullTextLower.includes("falta de intimação") ||
    fullTextLower.includes("intimação inexistente")
  ) {
    addDefect(
      "FALTA_INTIMACAO",
      "Possível falta de intimação identificada. Verificar certidões e publicações.",
      "intimação",
      "Despacho ou Certidão",
      "Atos de comunicação"
    );
  }

  // ==================== DETECTORES AUTOMÁTICOS EXPANDIDOS (BANCÁRIO/EXECUÇÃO) ====================
  // Executa os detectores heurísticos que aceitam apenas texto (sem parâmetros adicionais)
  // Outros detectores (TAC, foro, penhora, prescrição cambial, testemunha, taxa juros) 
  // requerem parâmetros adicionais e são executados em contextos específicos
  
  const textOnlyDetectors: Array<{
    detector: (text: string) => DetectionResult;
    searchPattern: string;
  }> = [
    { detector: detectNotaPromissoriaVinculada, searchPattern: "nota promissória" },
    { detector: detectJurosCapitalizados, searchPattern: "capitalização" },
    { detector: detectVencimentoAntecipadoAbusivo, searchPattern: "vencimento antecipado" },
    { detector: detectImpenhorabilidade, searchPattern: "impenhorabilidade" },
  ];

  for (const { detector, searchPattern } of textOnlyDetectors) {
    const result = detector(fullText);
    if (result && result.detected && !detectedCodes.has(result.suggestedCode)) {
      detectedCodes.add(result.suggestedCode);
      const context = findTrechoAndContext(searchPattern);
      defects.push({
        code: result.suggestedCode,
        notas: result.evidence || `Detectado padrão: ${searchPattern}`,
        trecho: context?.trecho,
        offset: context?.offset,
        tipoDocumento: context?.docKind || result.context?.tipoDocumento,
        secaoDocumento: result.context?.secaoDocumento,
      });
    }
  }

  return defects;
}
/**
 * ETAPA 1 – IDENTIFICAÇÃO DO RAMO (CAMADAS DE PRIORIDADE)
 * 
 * ORDEM OBRIGATÓRIA DE DETECÇÃO (NUNCA INVERTER):
 * (1) CONTEXTO DO LEXOS (context.case.area) - MAIOR PRIORIDADE
 * (2) CABEÇALHO / METADADOS DO PROCESSO (primeiras ~10 páginas)
 * (3) LÉXICO / CONTEÚDO (corpo das peças) - TERCEIRA CAMADA
 * 
 * REGRAS DE SEGURANÇA ABSOLUTAS:
 * - É PROIBIDO usar qualquer ramo como padrão por omissão.
 * - É ESPECIALMENTE PROIBIDO adotar "TRABALHISTA" como default.
 */

/**
 * (2) Detecta ramo pelo CABEÇALHO / METADADOS do processo
 * Analisa as primeiras ~10 páginas buscando indicadores claros.
 */
function detectRamoFromCabecalho(
  documents: NijaDocumentInput[]
): { ramo: NijaRamo | undefined; confianca: "ALTA" | "MEDIA" | "BAIXA" | undefined } {
  // Pegar texto das primeiras páginas (aproximadamente primeiros 20000 caracteres de cada doc)
  const headerText = documents
    .map((d) => (d.content || "").substring(0, 20000))
    .join("\n")
    .toLowerCase();

  // CÍVEL - indicadores de alta confiança
  if (
    headerText.includes("procedimento comum cível") ||
    headerText.includes("competência: cível") ||
    headerText.includes("vara cível") ||
    headerText.includes("1ª vara cível") ||
    headerText.includes("2ª vara cível") ||
    headerText.includes("3ª vara cível") ||
    headerText.includes("4ª vara cível") ||
    headerText.includes("juízo cível") ||
    headerText.includes("ação de cobrança") ||
    headerText.includes("ação de indenização") ||
    headerText.includes("procedimento ordinário") ||
    headerText.includes("procedimento sumário")
  ) {
    return { ramo: "CIVIL", confianca: "ALTA" };
  }

  // TRABALHISTA - indicadores de alta confiança
  if (
    headerText.includes("vara do trabalho") ||
    headerText.includes("1ª vara do trabalho") ||
    headerText.includes("2ª vara do trabalho") ||
    headerText.includes("reclamação trabalhista") ||
    headerText.includes("reclamante:") ||
    headerText.includes("reclamado:") ||
    headerText.includes("trt") ||
    headerText.includes("tribunal regional do trabalho") ||
    headerText.includes("justiça do trabalho")
  ) {
    return { ramo: "TRABALHISTA", confianca: "ALTA" };
  }

  // PENAL - indicadores de alta confiança
  if (
    headerText.includes("ação penal") ||
    headerText.includes("vara criminal") ||
    headerText.includes("1ª vara criminal") ||
    headerText.includes("2ª vara criminal") ||
    headerText.includes("juízo criminal") ||
    headerText.includes("denúncia do ministério público") ||
    headerText.includes("acusado:") ||
    headerText.includes("processo criminal")
  ) {
    return { ramo: "PENAL", confianca: "ALTA" };
  }

  // Execução Fiscal
  if (
    headerText.includes("execução fiscal") ||
    headerText.includes("vara de execuções fiscais") ||
    headerText.includes("certidão de dívida ativa")
  ) {
    return { ramo: "EXECUCAO_FISCAL", confianca: "ALTA" };
  }

  // Família
  if (
    headerText.includes("vara de família") ||
    headerText.includes("vara da família") ||
    headerText.includes("ação de divórcio") ||
    headerText.includes("ação de alimentos")
  ) {
    return { ramo: "FAMILIA", confianca: "ALTA" };
  }

  // Juizados
  if (
    headerText.includes("juizado especial") ||
    headerText.includes("jecível") ||
    headerText.includes("juizado especial cível")
  ) {
    return { ramo: "JUIZADOS", confianca: "ALTA" };
  }

  return { ramo: undefined, confianca: undefined };
}

/**
 * (3) Detecta ramo pelo LÉXICO / CONTEÚDO das peças
 * Terceira camada - somente se as anteriores não forem conclusivas.
 * Exige CONJUNTO de sinais (não apenas uma palavra solta).
 */
function detectRamoFromLexico(
  documents: NijaDocumentInput[]
): { ramo: NijaRamo | undefined; confianca: "ALTA" | "MEDIA" | "BAIXA" | undefined } {
  const text = documents
    .map((d) => d.content || "")
    .join("\n")
    .toLowerCase();

  // Contadores de sinais por ramo
  let scoreTrabalhista = 0;
  let scoreCivel = 0;
  let scorePenal = 0;
  let scoreExecFiscal = 0;
  let scoreTributario = 0;
  let scorePrevidenciario = 0;
  let scoreFamilia = 0;
  let scoreConsumidor = 0;
  let scoreAdministrativo = 0;

  // TRABALHISTA - exige múltiplos sinais
  if (text.includes("consolidação das leis do trabalho") || text.includes("clt")) scoreTrabalhista += 2;
  if (text.includes("reclamação trabalhista")) scoreTrabalhista += 3;
  if (text.includes("reclamante")) scoreTrabalhista += 1;
  if (text.includes("reclamado")) scoreTrabalhista += 1;
  if (text.includes("justiça do trabalho")) scoreTrabalhista += 2;
  if (text.includes("fgts")) scoreTrabalhista += 1;
  if (text.includes("verbas rescisórias")) scoreTrabalhista += 2;
  if (text.includes("aviso prévio")) scoreTrabalhista += 1;
  if (text.includes("horas extras")) scoreTrabalhista += 1;

  // CÍVEL - sinais
  if (text.includes("procedimento comum cível") || text.includes("procedimento comum")) scoreCivel += 2;
  if (text.includes("autor") && text.includes("réu") && !text.includes("reclamante")) scoreCivel += 1;
  if (text.includes("ação de cobrança")) scoreCivel += 2;
  if (text.includes("ação de indenização")) scoreCivel += 2;
  if (text.includes("responsabilidade civil")) scoreCivel += 1;
  if (text.includes("obrigação de fazer")) scoreCivel += 1;

  // PENAL - sinais
  if (text.includes("ação penal")) scorePenal += 3;
  if (text.includes("denúncia")) scorePenal += 1;
  if (text.includes("código penal")) scorePenal += 2;
  if (text.includes("crime")) scorePenal += 1;
  if (text.includes("réu primário")) scorePenal += 2;
  if (text.includes("sentença condenatória")) scorePenal += 2;
  if (text.includes("regime inicial")) scorePenal += 2;
  if (text.includes("acusado")) scorePenal += 1;

  // Execução Fiscal
  if (text.includes("execução fiscal")) scoreExecFiscal += 3;
  if (text.includes("certidão de dívida ativa")) scoreExecFiscal += 2;
  if (text.includes("lei 6.830")) scoreExecFiscal += 2;
  if (text.includes("cda nº") || text.includes("cda n.")) scoreExecFiscal += 2;

  // Tributário
  if (text.includes("icms") || text.includes("iss")) scoreTributario += 1;
  if (text.includes("iptu") || text.includes("ipva")) scoreTributario += 1;
  if (text.includes("imposto de renda")) scoreTributario += 1;
  if (text.includes("auto de infração")) scoreTributario += 2;
  if (text.includes("lançamento tributário")) scoreTributario += 2;

  // Previdenciário
  if (text.includes("inss")) scorePrevidenciario += 2;
  if (text.includes("benefício previdenciário")) scorePrevidenciario += 2;
  if (text.includes("aposentadoria")) scorePrevidenciario += 2;
  if (text.includes("auxílio-doença") || text.includes("auxilio doenca")) scorePrevidenciario += 2;
  if (text.includes("lei 8.213")) scorePrevidenciario += 2;

  // Família
  if (text.includes("divórcio") || text.includes("ação de divórcio")) scoreFamilia += 2;
  if (text.includes("guarda")) scoreFamilia += 1;
  if (text.includes("pensão alimentícia") || text.includes("alimentos")) scoreFamilia += 2;
  if (text.includes("partilha de bens")) scoreFamilia += 2;

  // Consumidor
  if (text.includes("relação de consumo")) scoreConsumidor += 2;
  if (text.includes("código de defesa do consumidor") || text.includes("cdc")) scoreConsumidor += 2;
  if (text.includes("vício do produto")) scoreConsumidor += 2;
  if (text.includes("propaganda enganosa")) scoreConsumidor += 2;

  // Administrativo
  if (text.includes("processo administrativo")) scoreAdministrativo += 2;
  if (text.includes("ato administrativo")) scoreAdministrativo += 1;
  if (text.includes("licitação")) scoreAdministrativo += 2;
  if (text.includes("servidor público")) scoreAdministrativo += 1;
  if (text.includes("mandado de segurança")) scoreAdministrativo += 2;

  // Encontrar o maior score (exige pelo menos 3 pontos para ter confiança)
  const scores: { ramo: NijaRamo; score: number }[] = [
    { ramo: "TRABALHISTA", score: scoreTrabalhista },
    { ramo: "CIVIL", score: scoreCivel },
    { ramo: "PENAL", score: scorePenal },
    { ramo: "EXECUCAO_FISCAL", score: scoreExecFiscal },
    { ramo: "TRIBUTARIO", score: scoreTributario },
    { ramo: "PREVIDENCIARIO", score: scorePrevidenciario },
    { ramo: "FAMILIA", score: scoreFamilia },
    { ramo: "CONSUMIDOR", score: scoreConsumidor },
    { ramo: "ADMINISTRATIVO", score: scoreAdministrativo },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];

  // Exige score mínimo de 3 e diferença significativa para o segundo
  if (best.score >= 5) {
    return { ramo: best.ramo, confianca: "ALTA" };
  } else if (best.score >= 3 && best.score - (second?.score || 0) >= 2) {
    return { ramo: best.ramo, confianca: "MEDIA" };
  } else if (best.score >= 2) {
    return { ramo: best.ramo, confianca: "BAIXA" };
  }

  // Não foi possível identificar com segurança
  return { ramo: undefined, confianca: undefined };
}

/**
 * Função principal de inferência de ramo seguindo as 3 camadas de prioridade.
 * 
 * @param documents - Documentos a analisar
 * @param contextArea - Área vinda do contexto LEXOS (context.case.area) - MAIOR PRIORIDADE
 * @returns Ramo identificado ou undefined se não foi possível identificar com segurança
 */
function inferRamoFromDocuments(
  documents: NijaDocumentInput[],
  contextArea?: string
): NijaRamo | undefined {
  // (1) CONTEXTO DO LEXOS (MAIOR PRIORIDADE)
  // Se existir context.case.area, usar esse valor como ramo principal
  if (contextArea && contextArea.trim().length > 0) {
    const normalized = contextArea.toUpperCase().trim();
    
    // Mapear valores conhecidos para NijaRamo
    const ramoMap: Record<string, NijaRamo> = {
      "CIVIL": "CIVIL",
      "CÍVEL": "CIVIL",
      "CIVEL": "CIVIL",
      "TRABALHISTA": "TRABALHISTA",
      "PENAL": "PENAL",
      "CRIMINAL": "PENAL",
      "TRIBUTARIO": "TRIBUTARIO",
      "TRIBUTÁRIO": "TRIBUTARIO",
      "EXECUCAO_FISCAL": "EXECUCAO_FISCAL",
      "EXECUÇÃO FISCAL": "EXECUCAO_FISCAL",
      "PREVIDENCIARIO": "PREVIDENCIARIO",
      "PREVIDENCIÁRIO": "PREVIDENCIARIO",
      "FAMILIA": "FAMILIA",
      "FAMÍLIA": "FAMILIA",
      "CONSUMIDOR": "CONSUMIDOR",
      "ADMINISTRATIVO": "ADMINISTRATIVO",
      "FAZENDARIO": "FAZENDARIO",
      "FAZENDÁRIO": "FAZENDARIO",
      "JUIZADOS": "JUIZADOS",
    };

    const mappedRamo = ramoMap[normalized];
    if (mappedRamo) {
      // PRIORIDADE MÁXIMA: usar o que veio do contexto LEXOS
      return mappedRamo;
    }
  }

  // (2) CABEÇALHO / METADADOS DO PROCESSO NO PDF
  const cabecalhoResult = detectRamoFromCabecalho(documents);
  if (cabecalhoResult.ramo && cabecalhoResult.confianca === "ALTA") {
    return cabecalhoResult.ramo;
  }

  // (3) LÉXICO / CONTEÚDO (TERCEIRA CAMADA)
  const lexicoResult = detectRamoFromLexico(documents);
  if (lexicoResult.ramo && (lexicoResult.confianca === "ALTA" || lexicoResult.confianca === "MEDIA")) {
    return lexicoResult.ramo;
  }

  // Se o cabeçalho tiver algum resultado, usar como fallback
  if (cabecalhoResult.ramo) {
    return cabecalhoResult.ramo;
  }

  // Se o léxico tiver algum resultado com baixa confiança, NÃO assumir ramo.
  // REGRA DE SEGURANÇA: sem sinais fortes/convergentes, manter indefinido.
  if (lexicoResult.ramo) {
    return undefined;
  }

  // REGRA DE SEGURANÇA: Se não for possível identificar com segurança,
  // retornar undefined (NÃO assumir nenhum ramo como padrão)
  // O chamador deve tratar isso como "INDEFINIDO – requer confirmação do advogado"
  return undefined;
}

// =========================
// FUNÇÃO PRINCIPAL – ANALYZER (Dual Mode)
// =========================

export function runNijaAnalyzer(
  request: NijaAnalyzerRequest
): NijaAnalyzerResponse {
  const { mode, caseContext, documents, preDetectedDefects } = request;

  const warnings = validateDocumentsForAnalysis(documents);
  const coreOverview = getNijaCoreOverview();

  // 1) Determinar lista de defeitos de entrada
  let usedDefects: NijaDetectedDefectInput[] = [];

  if (preDetectedDefects && preDetectedDefects.length > 0) {
    // modo supervisionado clássico (defeitos já vieram de IA/advogado)
    usedDefects = preDetectedDefects;
  } else if (mode === "AUTOMATIC") {
    const autoDefects = basicHeuristicDefectDetection(documents);
    usedDefects = autoDefects;

    if (autoDefects.length === 0) {
      warnings.push(
        "Modo automático ativado, mas nenhuma heurística conseguiu associar vícios catalogados. Recomenda-se análise complementar com IA ou revisão manual."
      );
    } else {
      warnings.push(
        `Modo automático detectou ${autoDefects.length} vício(s) por heurística. Recomenda-se validação humana.`
      );
    }
  } else {
    // SUPERVISED sem defeitos prévios → não inventar nada
    warnings.push(
      "Modo supervisionado sem defeitos pré-detectados. O NIJA_ENGINE será executado sem vícios, resultando em recomendação neutra."
    );
    usedDefects = [];
  }

  // 2) Ajustar contexto usando as 3 CAMADAS DE PRIORIDADE para identificar o ramo:
  // (1) CONTEXTO DO LEXOS (caseContext.ramo) - MAIOR PRIORIDADE
  // (2) CABEÇALHO / METADADOS DO PROCESSO NO PDF
  // (3) LÉXICO / CONTEÚDO (corpo das peças)
  const adjustedContext: NijaCaseContextInput = {
    ...caseContext,
  };

  // Passar o ramo do contexto como prioridade máxima
  const ramoInferido = inferRamoFromDocuments(documents, caseContext.ramo);
  if (ramoInferido) {
    adjustedContext.ramo = ramoInferido;
  } else if (!adjustedContext.ramo) {
    // REGRA DE SEGURANÇA: Se não foi possível identificar com segurança,
    // NÃO assumir nenhum ramo como padrão (especialmente NÃO assumir TRABALHISTA)
    warnings.push(
      "O ramo do direito não é inequivocamente identificável apenas pelos elementos do arquivo. Recomenda-se confirmação manual pelo advogado."
    );
  }

  // 3) Rodar o ENGINE com o contexto + defeitos
  const recommendation: NijaEngineRecommendation = runNijaEngine(
    adjustedContext,
    usedDefects
  );

  // 4) Montar resposta final
  return {
    mode,
    ramoFinal: recommendation.ramoFinal,
    coreOverview,
    recommendation,
    usedDefects,
    warnings,
  };
}
