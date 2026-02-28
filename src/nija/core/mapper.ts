// src/lib/nijaMapper.ts
// NIJA SUPREMO – Mapeador de Vícios IA → Catálogo Técnico
// Converte vícios detectados pela IA para códigos do catálogo NIJA_CORE_SPEC

import { NIJA_CORE_SPEC, NijaDefect } from "@/nija/core/engine";

/**
 * Mapeamento fuzzy de códigos/labels da IA para códigos do catálogo.
 * A IA pode usar nomes ligeiramente diferentes, este mapa normaliza.
 */
const VICIO_MAP: Record<string, string> = {
  // Prescrição
  "prescricao_material": "PRESCRICAO_MATERIAL",
  "prescricao_intercorrente": "PRESCRICAO_INTERCORRENTE",
  "prescricao": "PRESCRICAO_MATERIAL",
  "prescricao_parcial": "PRESCRICAO_MATERIAL",
  "decadencia": "DECADENCIA",
  "decadencia_direito": "DECADENCIA",
  
  // Nulidades de citação
  "nulidade_citacao": "NULIDADE_ABS_CITACAO_INEXISTENTE",
  "citacao_invalida": "NULIDADE_ABS_CITACAO_INEXISTENTE",
  "ausencia_citacao": "NULIDADE_ABS_CITACAO_INEXISTENTE",
  "citacao_nula": "NULIDADE_ABS_CITACAO_INEXISTENTE",
  "nulidade_abs_citacao_inexistente": "NULIDADE_ABS_CITACAO_INEXISTENTE",
  
  // Competência
  "incompetencia_absoluta": "INCOMPETENCIA_ABSOLUTA",
  "incompetencia": "INCOMPETENCIA_ABSOLUTA",
  
  // Ilegitimidade
  "ilegitimidade_passiva": "ILEGITIMIDADE_PASSIVA",
  "ilegitimidade_ativa": "ILEGITIMIDADE_ATIVA",
  "ilegitimidade": "ILEGITIMIDADE_PASSIVA",
  "parte_ilegitima": "ILEGITIMIDADE_PASSIVA",
  
  // Cerceamento
  "cerceamento_defesa": "CERCEAMENTO_DEFESA",
  "cerceamento_de_defesa": "CERCEAMENTO_DEFESA",
  "cerceamento": "CERCEAMENTO_DEFESA",
  
  // Inépcia e formalidades
  "inepcia_inicial": "INEPCIA_INICIAL",
  "inepcia_peticao_inicial": "INEPCIA_INICIAL",
  "peticao_inepta": "INEPCIA_INICIAL",
  "inepcia": "INEPCIA_INICIAL",
  
  // Coisa julgada e litispendência
  "coisa_julgada": "COISA_JULGADA",
  "ofensa_coisa_julgada": "COISA_JULGADA",
  "litispendencia": "LITISPENDENCIA",
  
  // Interesse e condições da ação
  "falta_interesse_agir": "FALTA_INTERESSE_AGIR",
  "ausencia_interesse": "FALTA_INTERESSE_AGIR",
  
  // Sentença viciada
  "sentenca_extra_petita": "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
  "sentenca_ultra_petita": "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
  "sentenca_citra_petita": "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
  "extra_petita": "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
  "ultra_petita": "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
  "citra_petita": "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
  "nulidade_sentenca": "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
  
  // Fundamentação
  "ausencia_fundamentacao": "AUSENCIA_FUNDAMENTACAO",
  "falta_fundamentacao": "AUSENCIA_FUNDAMENTACAO",
  "fundamentacao_deficiente": "AUSENCIA_FUNDAMENTACAO",
  
  // CDA e execução
  "cda_irregular": "CDA_IRREGULAR",
  "cda_nula": "CDA_IRREGULAR",
  "nulidade_cda": "CDA_IRREGULAR",
  "excesso_execucao": "EXCESSO_EXECUCAO",
  "excesso_de_execucao": "EXCESSO_EXECUCAO",
  
  // Provas
  "prova_ilicita": "PROVA_ILICITA",
  "prova_invalida": "PROVA_ILICITA",
  "ilicitude_prova": "PROVA_ILICITA",
};

/**
 * Normaliza um código/label para o formato de comparação.
 * Remove acentos, espaços, caracteres especiais e converte para lowercase.
 */
function normalizeCode(code: string): string {
  return code
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9_]/g, "_") // Substitui caracteres especiais por _
    .replace(/_+/g, "_") // Remove underscores duplicados
    .replace(/^_|_$/g, ""); // Remove underscores no início/fim
}

/**
 * Mapeia um código de vício da IA para o código do catálogo técnico.
 * Retorna null se não encontrar correspondência.
 */
export function mapAIVicioToCatalog(codigoIA: string): string | null {
  const normalized = normalizeCode(codigoIA);
  
  // Primeiro tenta match direto no mapa
  if (VICIO_MAP[normalized]) {
    return VICIO_MAP[normalized];
  }
  
  // Tenta match por substring para pegar variações
  for (const [key, catalogCode] of Object.entries(VICIO_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return catalogCode;
    }
  }
  
  // Tenta match direto no catálogo (caso a IA já tenha enviado o código correto)
  const directMatch = NIJA_CORE_SPEC.defectCatalog.find(
    (d) => normalizeCode(d.code) === normalized
  );
  if (directMatch) {
    return directMatch.code;
  }
  
  // Tenta match por label no catálogo
  const labelMatch = NIJA_CORE_SPEC.defectCatalog.find((d) => {
    const normalizedLabel = normalizeCode(d.label);
    return normalizedLabel.includes(normalized) || normalized.includes(normalizedLabel);
  });
  if (labelMatch) {
    return labelMatch.code;
  }
  
  return null;
}

/**
 * Obtém o defeito completo do catálogo a partir de um código da IA.
 * Retorna undefined se não encontrar.
 */
export function getDefectFromAICode(codigoIA: string): NijaDefect | undefined {
  const catalogCode = mapAIVicioToCatalog(codigoIA);
  if (!catalogCode) return undefined;
  
  return NIJA_CORE_SPEC.defectCatalog.find((d) => d.code === catalogCode);
}

/**
 * Enriquece um vício da IA com dados técnicos do catálogo.
 * Preserva os dados originais da IA e adiciona informações do catálogo.
 */
export interface AIVicio {
  codigo: string;
  label?: string;
  gravidade?: string;
  natureza?: string;
  atoRelacionado?: string;
  trecho?: string;
  fundamentosLegais?: string[];
  observacoes?: string;
}

export interface EnrichedVicio extends AIVicio {
  catalogCode: string | null;
  catalogDefect: NijaDefect | null;
  technicalDetails: {
    category: string;
    severity: string;
    impact: string;
    legalLogic: string;
    typicalConsequences: string[];
    recommendedActions: string[];
    fundamentosLegaisEnriquecidos: string[];
  } | null;
}

// =========================
// Filtro Semântico de Negação
// =========================

/**
 * Padrões de negação comuns em decisões judiciais.
 * Quando esses padrões aparecem no trecho, o vício foi REJEITADO/AFASTADO.
 */
const NEGATION_PATTERNS = [
  "não há",
  "nao ha",
  "não se pode alegar",
  "nao se pode alegar",
  "afastado o",
  "afastada a",
  "afastando o",
  "afastando a",
  "afasta-se",
  "afasta se",
  "inexistência de",
  "inexistencia de",
  "rejeita-se",
  "rejeita se",
  "improcedente o",
  "improcedente a",
  "não restou configurado",
  "nao restou configurado",
  "não restou configurada",
  "nao restou configurada",
  "não se verifica",
  "nao se verifica",
  "ausência de",
  "ausencia de",
  "não prospera",
  "nao prospera",
];

/**
 * Verifica se o trecho contém padrões de negação.
 */
function isNegatedTrecho(trecho?: string): boolean {
  if (!trecho) return false;
  const norm = trecho.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return NEGATION_PATTERNS.some((p) => norm.includes(p));
}

/**
 * Filtro semântico simples para descartar vícios que aparecem em contexto negado.
 * Ex.: "não se podendo alegar cerceamento de defesa" NÃO deve virar CERCEAMENTO_DEFESA.
 * 
 * @param v - Vício detectado pela IA
 * @returns true se o vício deve ser IGNORADO (contexto negado)
 */
export function shouldIgnoreAIDefect(v: AIVicio): boolean {
  if (!v.trecho) return false;

  // Casos mais sensíveis a falsos positivos
  const code = v.codigo.toLowerCase();
  const labelLower = v.label?.toLowerCase() || "";
  
  const isCerceamento =
    code.includes("cerceamento") || labelLower.includes("cerceamento");
  const isIlegitimidade =
    code.includes("ilegitimidade") || labelLower.includes("ilegitimidade");
  const isInteresseAgir =
    code.includes("interesse_agir") ||
    code.includes("interesse de agir") ||
    labelLower.includes("interesse de agir") ||
    labelLower.includes("falta de interesse");
  const isPrescricao =
    code.includes("prescricao") || labelLower.includes("prescrição") || labelLower.includes("prescricao");
  const isDecadencia =
    code.includes("decadencia") || labelLower.includes("decadência") || labelLower.includes("decadencia");

  // Se o trecho contém negação e o vício é sensível, ignorar
  if (isNegatedTrecho(v.trecho) && (isCerceamento || isIlegitimidade || isInteresseAgir || isPrescricao || isDecadencia)) {
    return true;
  }

  return false;
}

export function enrichAIVicio(vicio: AIVicio): EnrichedVicio {
  const catalogCode = mapAIVicioToCatalog(vicio.codigo);
  const catalogDefect = catalogCode
    ? NIJA_CORE_SPEC.defectCatalog.find((d) => d.code === catalogCode) || null
    : null;
  
  const technicalDetails = catalogDefect
    ? {
        category: catalogDefect.category,
        severity: catalogDefect.severity,
        impact: catalogDefect.impact,
        legalLogic: catalogDefect.legalLogic,
        typicalConsequences: catalogDefect.typicalConsequences,
        recommendedActions: catalogDefect.recommendedActions,
        fundamentosLegaisEnriquecidos: buildLegalFoundations(catalogDefect),
      }
    : null;
  
  return {
    ...vicio,
    catalogCode,
    catalogDefect,
    technicalDetails,
  };
}

/**
 * Constrói fundamentos legais padronizados a partir do defeito do catálogo.
 */
function buildLegalFoundations(defect: NijaDefect): string[] {
  const fundamentos: string[] = [];
  
  switch (defect.category) {
    case "ESTRUTURAL":
      fundamentos.push("Art. 485 e 337 do CPC – Pressupostos processuais");
      fundamentos.push("Art. 5º, LV, CF – Contraditório e ampla defesa");
      break;
    case "TEMPORAL":
      fundamentos.push("Arts. 189-211 do CC – Prescrição e decadência");
      fundamentos.push("Art. 332, §1º do CPC – Prescrição e decadência");
      fundamentos.push("Súmula 150/STF – Prescrição da execução");
      break;
    case "PROCESSUAL":
      fundamentos.push("Arts. 17-18 do CPC – Condições da ação");
      fundamentos.push("Art. 485, VI do CPC – Extinção por carência");
      break;
    case "PROBATORIO":
      fundamentos.push("Arts. 369-380 do CPC – Provas");
      fundamentos.push("Art. 5º, LVI, CF – Inadmissibilidade de provas ilícitas");
      break;
    case "FORMAL":
      fundamentos.push("Art. 93, IX, CF – Fundamentação das decisões");
      fundamentos.push("Art. 489, §1º do CPC – Elementos da sentença");
      break;
    case "MATERIAL":
      fundamentos.push("Art. 141 do CPC – Princípio da congruência");
      fundamentos.push("Art. 492 do CPC – Julgamento ultra/extra/citra petita");
      break;
  }
  
  // Adiciona contextos típicos
  if (defect.typicalContexts && defect.typicalContexts.length > 0) {
    const ramos = defect.typicalContexts.slice(0, 3).join(", ");
    fundamentos.push(`Aplicável especialmente em: ${ramos}`);
  }
  
  return fundamentos;
}

/**
 * Mapeia todos os vícios da IA para o catálogo, retornando estatísticas.
 * Aplica filtro semântico para descartar vícios em contexto negado.
 */
export function mapAllAIVicios(vicios: AIVicio[]): {
  enriched: EnrichedVicio[];
  mapped: number;
  unmapped: number;
  unmappedCodes: string[];
  ignored: number;
  ignoredCodes: string[];
} {
  // Primeiro filtra vícios que aparecem em contexto negado
  const filtered = vicios.filter((v) => !shouldIgnoreAIDefect(v));
  const ignored = vicios.length - filtered.length;
  const ignoredCodes = vicios
    .filter((v) => shouldIgnoreAIDefect(v))
    .map((v) => v.codigo);
  
  // Enriquece os vícios válidos
  const enriched = filtered.map(enrichAIVicio);
  const mapped = enriched.filter((v) => v.catalogCode !== null).length;
  const unmapped = enriched.filter((v) => v.catalogCode === null).length;
  const unmappedCodes = enriched
    .filter((v) => v.catalogCode === null)
    .map((v) => v.codigo);
  
  return { enriched, mapped, unmapped, unmappedCodes, ignored, ignoredCodes };
}

/**
 * Normaliza o nome do ato processual para exibição consistente.
 * Converte variações como "inicial", "peticao_inicial" → "Petição Inicial"
 */
export function normalizeAto(x?: string): string {
  if (!x) return "Ato não identificado";

  const key = x.toLowerCase().replace(/[^a-z0-9]/gi, "");
  const map: Record<string, string> = {
    inicial: "Petição Inicial",
    peticaoinicial: "Petição Inicial",
    contestacao: "Contestação",
    defesa: "Contestação",
    decisao: "Decisão",
    despacho: "Despacho",
    sentenca: "Sentença",
    citacao: "Citação",
    intimacao: "Intimação",
    recurso: "Recurso",
    embargo: "Embargos",
    embargos: "Embargos",
    agravo: "Agravo",
    apelacao: "Apelação",
    manifestacao: "Manifestação",
    impugnacao: "Impugnação",
    replica: "Réplica",
    laudo: "Laudo Pericial",
    pericia: "Laudo Pericial",
    audiencia: "Audiência",
    cda: "Certidão de Dívida Ativa",
  };

  return map[key] || x;
}

/**
 * Infere o tipo de documento baseado no código do defeito.
 */
export function inferTipoDocumento(defectCode: string): string {
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

/**
 * Infere a parte envolvida baseado no polo de atuação.
 */
export function inferParteFromPolo(polo: "AUTOR" | "REU" | "INDEFINIDO"): string {
  if (polo === "REU") return "Réu/Executado";
  if (polo === "AUTOR") return "Autor/Exequente";
  return "Parte interessada";
}

/**
 * Infere quem se beneficia da alegação baseado no polo.
 */
export function inferBeneficiario(polo: "AUTOR" | "REU" | "INDEFINIDO"): string {
  // Se o advogado atua pelo réu, as alegações beneficiam o réu
  if (polo === "REU") return "Réu/Executado";
  if (polo === "AUTOR") return "Autor/Exequente";
  return "Parte alegante";
}
