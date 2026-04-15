/**
 * NIJA CONTRACTS (Shared)
 * Este arquivo é a ÚNICA fonte de verdade para os contratos entre Frontend, Core e Edge Functions.
 * Organizado por seções: Documentos, Extração, Análise, Detecção e Modos.
 */

// ==========================================
// 1. MODOS E CONFIGURAÇÃO
// ==========================================

export type NijaOperationMode = "EXTRACTION_ONLY" | "NIJA_ANALYSIS";
export type NijaAnalysisMode = "AUTOMATIC" | "SUPERVISED" | "MANUAL";

// ==========================================
// 2. DOCUMENTOS (INPUT)
// ==========================================

export interface NijaDocumentInput {
  id: string;
  caseId?: string;
  filename: string;
  content: string;
  kind?: "ARQUIVO_PROCESSO" | "DOCUMENTO_COMPLEMENTAR" | string;
  label?: string;
  createdAt?: string;
}

// ==========================================
// 3. EXTRAÇÃO (EPROC/PURA)
// ==========================================

export type DetectedProcessSystem = "EPROC" | "UNKNOWN";

export type OabEntry = { 
  nome: string; 
  oabUf: string; 
  oabNumero: string; 
};

export interface AssuntoProcessual {
  codigo: string;
  descricao: string;
  principal: boolean;
}

export interface ProcuradorExtraido {
  nome: string;
  oab: string;
}

export interface ParteExtraida {
  nome: string;
  documento?: string;
  tipo?: "PF" | "PJ";
  procuradores?: ProcuradorExtraido[];
}

export interface EprocEventoExtraido {
  numeroEvento: number | null;
  data: string;
  hora: string | null;
  tipoEvento: string;
  descricaoLiteral: string;
  documentoVinculado: string | null;
  codigoTjto: string | null;
  labelEnriquecido: string | null;
  usuarioRegistro?: string | null;
  pecasAnexas?: Array<{
    codigo: string;
    paginas: number;
    label?: string;
  }>;
  pageStart?: number;
  pageEnd?: number | null;
  source?: "PDF_BOOKMARK" | "REGEX_TEXT";
  confidence?: "HIGH" | "MEDIUM" | "LOW";
}

export interface EprocPecaExtraida {
  tipo: "CONTESTACAO" | "REPLICA" | "RESPOSTA" | "DECISAO" | "SENTENCA" | "OUTROS";
  nomeEvento: string;
  documentoAssociado: string;
  textoIntegral: string;
  data: string;
  parteQueApresentou: string;
}

export interface EprocExtractionResult {
  capa: {
    numeroCnj: string;
    classeAcao: string;
    varaJuizo: string;
    comarca: string;
    situacaoProcessual: string;
    dataAutuacao: string;
    orgaoJulgador: string;
    juiz: string;
    assuntos: AssuntoProcessual[];
    tipoAcao: string;
    chaveProcesso?: string;
    justicaGratuita?: boolean;
    prioridadeAtendimento?: boolean;
    segredoJustica?: boolean;
    nivelSigilo?: string;
    processosApensos?: string[];
    antecipacaoTutela?: boolean;
    peticaoUrgente?: boolean;
    vistaMinisterioPublico?: boolean;
  };
  peticaoInicial: {
    autores: string[];
    reus: string[];
    partesNeutras?: string;
    pedidos: string[];
    causaDePedir: string;
    valorDaCausa: string;
    fundamentosLegaisCitados: string[];
    datasDeFatosNarrados: string[];
    autoresDetalhados: ParteExtraida[];
    reusDetalhados: ParteExtraida[];
  };
  advogado: {
    nome: string;
    oab: string;
    formatado: string;
    oabs: OabEntry[];
    emCausaPropria: boolean;
  };
  eventos: EprocEventoExtraido[];
  pecasPosteriores: EprocPecaExtraida[];
  meta: {
    dataExtracao: string;
    totalEventos: number;
    totalPecas: number;
    camposAusentes: string[];
    extractionQuality?: "ALTA" | "MEDIA" | "BAIXA";
    ordemSuspeita?: boolean;
    datePercentage?: number;
  };
}

export interface TimelineSummary {
  totalEventos: number;
  primeiroEvento: { data: string; tipo: string } | null;
  ultimoEvento: { data: string; tipo: string } | null;
  contagemPorTipo: Record<string, number>;
  decisoesChave: string[];
  resumoTexto: string;
  qualidade: "ALTA" | "MEDIA" | "BAIXA";
  percentualComData: number;
}


// ==========================================
// 4. DETECÇÃO E POLO
// ==========================================

export type PoloAtuacao = "AUTOR" | "REU" | "TERCEIRO" | "INDEFINIDO";
export type GrauRisco = "BAIXO" | "MEDIO" | "ALTO";

export type NijaPoloSource = 
  | "EPROC_CAMPOS" 
  | "EPROC_PARTES" 
  | "METADADOS_CLIENTE" 
  | "HEURISTICA_TEXTO" 
  | "INDEFINIDO";

export type NijaPoloDetectResult = {
  poloDetected: PoloAtuacao;
  poloSource: NijaPoloSource;
  confidence: number;
  evidence: string; // Resumo ou primeira evidência
  evidences: string[]; // Lista detalhada
  matchedKeywords?: string[];
};

// ==========================================
// 5. ANÁLISE (ANALYZER/V2/MAESTRO)
// ==========================================

export interface NijaVicio {
  codigo: string;
  label: string;
  natureza: "FORMAL" | "MATERIAL" | "MISTA";
  gravidade: GrauRisco;
  atoRelacionado?: string;
  trecho?: string;
  fundamentosLegais?: string[];
  observacoes?: string;
}

export interface NijaLinhaTempoItem {
  ordem: number;
  dataDetectada?: string;
  tipoAto: string;
  descricao: string;
  trecho?: string;
}

export interface NijaEstrategiaItem {
  label: string;
  descricao: string;
  recomendadaPara: PoloAtuacao[] | ("AMBOS" | "TODOS")[];
  possiveisPecas: string[];
}

export interface NijaAnalyzerResponse {
  mode: NijaAnalysisMode;
  ramoFinal?: any; // Tipado como NijaRamo no core, mantendo genérico aqui para evitar ciclo
  coreOverview: {
    version: string;
    defectsCount: number;
    strategiesCount: number;
    mappedVicios: number;
    unmappedVicios: number;
    ignoredVicios: number;
  };
  recommendation: {
    resumoTatico: string;
    mainStrategies: any[];
    secondaryStrategies: any[];
    findings: any[];
  };
  usedDefects: any[];
  warnings: string[];
}

export interface NijaFullAnalysisResult {
  meta: {
    ramo: string;
    ramoConfiavel: boolean;
    faseProcessual: string;
    poloAtuacao: PoloAtuacao;
    grauRiscoGlobal: GrauRisco;
    resumoTatico: string;
  };
  partes: {
    cliente?: { nome: string; papelProcessual: string };
    parteContraria?: { nome: string; papelProcessual: string };
    terceiros?: { nome: string; papelProcessual: string }[];
  };
  processo: {
    titulo?: string;
    numero?: string;
    vara?: string;
    comarca?: string;
  };
  linhaDoTempo: NijaLinhaTempoItem[];
  prescricao: {
    haPrescricao: boolean;
    tipo?: "GERAL" | "INTERCORRENTE" | "NENHUMA" | "DUVIDOSA";
    fundamentacao?: string;
    risco?: GrauRisco;
  };
  vicios: NijaVicio[];
  estrategias: {
    principais: NijaEstrategiaItem[];
    secundarias: { label: string; descricao: string }[];
  };
  sugestaoPeca: {
    tipo: string;
    tituloSugestao: string;
    focoPrincipal: string;
  };
  caseId?: string;
  _audit?: any;
}
