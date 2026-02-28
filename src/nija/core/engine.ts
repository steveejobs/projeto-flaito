// src/lib/nijaCore.ts
// NIJA SUPREMO – CORE ESTÁTICO V2
// Motor de especificação do NIJA para o LEXOS (sem chamadas de IA, sem custo).

// =========================
// Tipos básicos
// =========================

export type NijaRamo =
  | "CIVIL"
  | "PENAL"
  | "TRABALHISTA"
  | "TRIBUTARIO"
  | "PREVIDENCIARIO"
  | "FAMILIA"
  | "ADMINISTRATIVO"
  | "FAZENDARIO"
  | "JUIZADOS"
  | "EXECUCAO_FISCAL"
  | "CONSUMIDOR"
  | "OUTRO";

export type NijaDefectCategory =
  | "ESTRUTURAL"
  | "TEMPORAL"
  | "PROCESSUAL"
  | "PROBATORIO"
  | "MATERIAL"
  | "FORMAL"
  | "SISTEMICO"
  | "TITULO_EXECUTIVO"
  | "BANCARIO";

export type NijaSeverity = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
export type NijaImpact =
  | "SEM_IMPACTO_RELEVANTE"
  | "PONTO_DE_ATENCAO"
  | "POTENCIAL_REVERSAO_PARTE"
  | "POTENCIAL_REVERSAO_TOTAL";

// =========================
// Defeitos jurídicos (vícios)
// =========================

export interface NijaDefect {
  code: string;
  label: string;
  category: NijaDefectCategory;
  severity: NijaSeverity;
  impact: NijaImpact;
  description: string;
  typicalContexts: NijaRamo[];
  legalLogic: string;
  typicalConsequences: string[];
  recommendedActions: string[];
}

// =========================
// Estratégias jurídicas
// =========================

export interface NijaStrategyTemplate {
  code: string;
  label: string;
  applicableRamos: NijaRamo[];
  description: string;
  recommendedWhenDefects: string[];
  tacticalNotes: string[];
  potentialPieces: string[];
}

// =========================
export interface NijaCoreSpec {
  version: string;
  description: string;
  invariants: string[];
  defectCatalog: NijaDefect[];
  strategyCatalog: NijaStrategyTemplate[];
}

// =========================
// Eventos do processo (timeline)
// =========================

export interface ProcessEvent {
  date?: string;
  description: string;
  code?: string; // Código do dicionário TJTO (ex: INIC1, DESP1)
  enrichedLabel?: string; // Label enriquecido do dicionário
  eventNumber?: number; // Número do evento no processo
  /** Peças agrupadas do evento (para evitar duplicatas na timeline) */
  pecas?: Array<{ code: string; label?: string; pages: number }>;
}

// =========================
// Metadados detectados (prévia rápida)
// =========================

export interface QuickMetadata {
  cnjNumber?: string;
  processYear?: string; // Ano extraído do CNJ (ex: "2016")
  authorName?: string;
  defendantName?: string;
  /** Lista de réus detectados (quando houver multi-polo passivo). */
  defendants?: string[];
  vara?: string;
  comarca?: string;
  lawyerName?: string;
  oabNumber?: string;
  actionType?: string; // Tipo de ação (ex: "Execução de Título Extrajudicial")
  events: ProcessEvent[];
}

// =========================
// Catálogo expandido de vícios (V2)
// =========================

const DEFECTS: NijaDefect[] = [
  // ==================== ESTRUTURAIS ====================
  {
    code: "NULIDADE_ABS_CITACAO_INEXISTENTE",
    label: "Nulidade absoluta por ausência de citação válida",
    category: "ESTRUTURAL",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Quando não há citação válida do réu, ou a citação é viciada, comprometendo contraditório e ampla defesa.",
    typicalContexts: [
      "CIVIL",
      "PENAL",
      "TRABALHISTA",
      "TRIBUTARIO",
      "JUIZADOS",
      "EXECUCAO_FISCAL",
      "FAZENDARIO",
    ],
    legalLogic:
      "Sem citação válida, a relação processual não se forma. Nulidade absoluta reconhecível a qualquer tempo.",
    typicalConsequences: [
      "Anulação dos atos posteriores",
      "Reabertura de prazo de defesa",
    ],
    recommendedActions: [
      "Levantar comprovantes de não citação",
      "Suscitar nulidade em preliminar",
      "Avaliar querela nullitatis em casos extremos",
    ],
  },
  {
    code: "INCOMPETENCIA_ABSOLUTA",
    label: "Incompetência absoluta do juízo",
    category: "ESTRUTURAL",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Quando o juízo que proferiu a decisão não possui competência material, funcional ou em razão da pessoa para julgar a causa.",
    typicalContexts: [
      "CIVIL",
      "PENAL",
      "TRABALHISTA",
      "TRIBUTARIO",
      "ADMINISTRATIVO",
      "FAMILIA",
      "CONSUMIDOR",
    ],
    legalLogic:
      "A incompetência absoluta é matéria de ordem pública, pode ser alegada a qualquer tempo e grau de jurisdição, gerando nulidade de todos os atos decisórios.",
    typicalConsequences: [
      "Nulidade absoluta dos atos decisórios",
      "Remessa dos autos ao juízo competente",
      "Reprocessamento do feito",
    ],
    recommendedActions: [
      "Identificar a natureza da incompetência (material, funcional, pessoa)",
      "Arguir em preliminar de contestação ou recurso",
      "Preparar incidente de incompetência se necessário",
    ],
  },

  // ==================== TEMPORAIS ====================
  {
    code: "PRESCRICAO_MATERIAL",
    label: "Prescrição material",
    category: "TEMPORAL",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Decurso do prazo legal para exercício da pretensão sem interrupção válida.",
    typicalContexts: [
      "CIVIL",
      "TRABALHISTA",
      "TRIBUTARIO",
      "PREVIDENCIARIO",
      "CONSUMIDOR",
    ],
    legalLogic:
      "Extingue-se a pretensão com resolução de mérito quando esgotado o prazo prescricional, observadas causas interruptivas e suspensivas.",
    typicalConsequences: [
      "Extinção do processo com resolução de mérito",
      "Impossibilidade de cobrança judicial do crédito",
    ],
    recommendedActions: [
      "Reconstruir linha do tempo completa dos fatos e ajuizamento",
      "Mapear causas suspensivas e interruptivas",
      "Requerer reconhecimento da prescrição em preliminar ou petição autônoma",
    ],
  },
  {
    code: "PRESCRICAO_INTERCORRENTE",
    label: "Prescrição intercorrente",
    category: "TEMPORAL",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description:
      "Paralisação injustificada do processo ou da execução pelo prazo prescricional aplicável.",
    typicalContexts: ["EXECUCAO_FISCAL", "TRIBUTARIO", "CIVIL"],
    legalLogic:
      "Inércia do exequente por período superior ao prazo legal, após a paralisação do processo, pode ensejar prescrição intercorrente.",
    typicalConsequences: [
      "Extinção parcial ou total da execução",
      "Redução significativa do crédito exequendo",
    ],
    recommendedActions: [
      "Identificar marcos de paralisação e retomada",
      "Comparar com prazos legais específicos do ramo",
      "Requerer reconhecimento da prescrição intercorrente",
    ],
  },
  {
    code: "DECADENCIA",
    label: "Decadência do direito potestativo",
    category: "TEMPORAL",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Perda do direito potestativo pelo decurso do prazo decadencial, sem possibilidade de interrupção ou suspensão.",
    typicalContexts: [
      "CIVIL",
      "CONSUMIDOR",
      "FAMILIA",
      "TRIBUTARIO",
      "ADMINISTRATIVO",
    ],
    legalLogic:
      "Diferentemente da prescrição, a decadência atinge o próprio direito (não apenas a pretensão) e não admite interrupção ou suspensão, salvo exceções legais.",
    typicalConsequences: [
      "Extinção do direito de ação",
      "Impossibilidade de exercício do direito potestativo",
    ],
    recommendedActions: [
      "Verificar prazo decadencial aplicável ao caso",
      "Identificar termo inicial do prazo",
      "Requerer reconhecimento da decadência como matéria de mérito",
    ],
  },

  // ==================== PROCESSUAIS ====================
  {
    code: "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
    label: "Sentença extra/ultra/citra petita",
    category: "PROCESSUAL",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description:
      "Quando o juiz julga fora, além ou aquém dos limites do pedido formulado pelas partes.",
    typicalContexts: ["CIVIL", "FAMILIA", "TRABALHISTA", "CONSUMIDOR"],
    legalLogic:
      "Viola o princípio da congruência (correlação entre pedido e sentença) e o princípio dispositivo.",
    typicalConsequences: [
      "Anulação parcial ou total da sentença",
      "Retorno dos autos à instância de origem",
    ],
    recommendedActions: [
      "Comparar petição inicial/contestação com o dispositivo da sentença",
      "Destacar pontos de extrapolação ou omissão",
      "Apontar nulidade em apelação ou recurso adequado",
    ],
  },
  {
    code: "CERCEAMENTO_DEFESA",
    label: "Cerceamento de defesa",
    category: "PROCESSUAL",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Impedimento de produzir prova essencial ou de se manifestar em momento processual relevante.",
    typicalContexts: ["CIVIL", "TRABALHISTA", "FAMILIA", "ADMINISTRATIVO"],
    legalLogic:
      "Violação ao contraditório e ampla defesa enseja nulidade, desde que demonstrado prejuízo.",
    typicalConsequences: [
      "Anulação da sentença ou do ato viciado",
      "Reabertura da instrução ou nova decisão",
    ],
    recommendedActions: [
      "Demonstrar relevância da prova negada ou manifestação impedida",
      "Apontar prejuízo concreto na condução do processo",
      "Requerer nulidade em recurso ou petição específica",
    ],
  },
  {
    code: "ILEGITIMIDADE_PASSIVA",
    label: "Ilegitimidade passiva",
    category: "PROCESSUAL",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Quando o réu demandado não é o titular da obrigação ou não integra a relação jurídica material discutida.",
    typicalContexts: [
      "CIVIL",
      "CONSUMIDOR",
      "TRABALHISTA",
      "TRIBUTARIO",
      "EXECUCAO_FISCAL",
    ],
    legalLogic:
      "A legitimidade passiva é condição da ação. Sua ausência impede o exame do mérito e deve resultar em extinção sem resolução de mérito.",
    typicalConsequences: [
      "Extinção do processo sem resolução de mérito",
      "Exclusão da parte ilegítima",
    ],
    recommendedActions: [
      "Demonstrar que o réu não integra a relação jurídica",
      "Arguir em preliminar de contestação",
      "Indicar, se possível, o legitimado correto",
    ],
  },
  {
    code: "ILEGITIMIDADE_ATIVA",
    label: "Ilegitimidade ativa",
    category: "PROCESSUAL",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Quando o autor não é o titular do direito que busca tutelar ou não possui interesse jurídico na demanda.",
    typicalContexts: ["CIVIL", "CONSUMIDOR", "FAMILIA", "TRABALHISTA"],
    legalLogic:
      "A legitimidade ativa é condição da ação. Parte que não é titular do direito material não pode demandar em nome próprio.",
    typicalConsequences: [
      "Extinção do processo sem resolução de mérito",
      "Impossibilidade de prosseguimento da ação",
    ],
    recommendedActions: [
      "Verificar titularidade do direito material",
      "Arguir em preliminar de contestação ou resposta",
      "Documentar a ausência de relação jurídica",
    ],
  },
  {
    code: "COISA_JULGADA",
    label: "Ofensa à coisa julgada",
    category: "PROCESSUAL",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Quando há nova demanda com as mesmas partes, causa de pedir e pedido de ação já transitada em julgado.",
    typicalContexts: [
      "CIVIL",
      "TRABALHISTA",
      "FAMILIA",
      "TRIBUTARIO",
      "PREVIDENCIARIO",
    ],
    legalLogic:
      "A coisa julgada é garantia constitucional (art. 5º, XXXVI, CF). Não se pode rediscutir o que foi decidido em sentença transitada em julgado.",
    typicalConsequences: [
      "Extinção do processo sem resolução de mérito",
      "Proibição de reexame da matéria",
    ],
    recommendedActions: [
      "Identificar processo anterior transitado em julgado",
      "Demonstrar identidade de partes, causa de pedir e pedido",
      "Arguir em preliminar ou exceção de coisa julgada",
    ],
  },
  {
    code: "LITISPENDENCIA",
    label: "Litispendência",
    category: "PROCESSUAL",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Quando há duas ações idênticas em trâmite simultâneo com as mesmas partes, causa de pedir e pedido.",
    typicalContexts: ["CIVIL", "TRABALHISTA", "FAMILIA", "CONSUMIDOR"],
    legalLogic:
      "Não se admite a tramitação simultânea de ações idênticas. A segunda ação deve ser extinta.",
    typicalConsequences: [
      "Extinção da segunda ação sem resolução de mérito",
      "Prevenção do juízo da primeira ação",
    ],
    recommendedActions: [
      "Identificar ação anterior em trâmite",
      "Demonstrar identidade de partes, causa de pedir e pedido",
      "Requerer extinção por litispendência",
    ],
  },
  {
    code: "FALTA_INTERESSE_AGIR",
    label: "Falta de interesse de agir",
    category: "PROCESSUAL",
    severity: "MEDIA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Ausência de necessidade ou utilidade da tutela jurisdicional pleiteada.",
    typicalContexts: [
      "CIVIL",
      "CONSUMIDOR",
      "TRABALHISTA",
      "ADMINISTRATIVO",
    ],
    legalLogic:
      "O interesse de agir se compõe de necessidade (não há outro meio de obter o bem da vida) e adequação (via processual correta).",
    typicalConsequences: [
      "Extinção do processo sem resolução de mérito",
      "Carência de ação",
    ],
    recommendedActions: [
      "Demonstrar que o autor não precisa da tutela jurisdicional",
      "Ou demonstrar inadequação da via eleita",
      "Arguir em preliminar de contestação",
    ],
  },

  // ==================== FORMAIS ====================
  {
    code: "INEPCIA_INICIAL",
    label: "Inépcia da petição inicial",
    category: "FORMAL",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Petição inicial que não preenche requisitos essenciais: falta de pedido, causa de pedir, pedido incompatível, etc.",
    typicalContexts: ["CIVIL", "TRABALHISTA", "FAMILIA", "CONSUMIDOR"],
    legalLogic:
      "A petição inicial inepta não permite a formação válida do processo, devendo ser indeferida ou emendada.",
    typicalConsequences: [
      "Indeferimento da petição inicial",
      "Extinção do processo sem resolução de mérito",
      "Oportunidade de emenda (se intimado)",
    ],
    recommendedActions: [
      "Identificar qual requisito essencial está ausente",
      "Verificar se houve oportunidade de emenda não aproveitada",
      "Arguir inépcia em preliminar de contestação",
    ],
  },
  {
    code: "AUSENCIA_FUNDAMENTACAO",
    label: "Ausência de fundamentação da decisão",
    category: "FORMAL",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Decisão judicial que não apresenta os motivos de fato e de direito que a justificam (art. 93, IX, CF).",
    typicalContexts: [
      "CIVIL",
      "PENAL",
      "TRABALHISTA",
      "TRIBUTARIO",
      "FAMILIA",
      "ADMINISTRATIVO",
    ],
    legalLogic:
      "Toda decisão judicial deve ser fundamentada, sob pena de nulidade (art. 93, IX, CF e art. 489, §1º, CPC).",
    typicalConsequences: [
      "Nulidade absoluta da decisão",
      "Necessidade de nova decisão fundamentada",
    ],
    recommendedActions: [
      "Identificar pontos não fundamentados",
      "Verificar se houve mera referência genérica a precedentes",
      "Opor embargos de declaração ou apelar alegando nulidade",
    ],
  },

  // ==================== PROBATÓRIOS ====================
  {
    code: "CDA_IRREGULAR",
    label: "CDA irregular",
    category: "PROBATORIO",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description:
      "Certidão de Dívida Ativa sem requisitos legais de liquidez, certeza e exigibilidade.",
    typicalContexts: ["EXECUCAO_FISCAL", "TRIBUTARIO", "FAZENDARIO"],
    legalLogic:
      "A CDA é o título executivo que embasa a execução fiscal; vícios graves podem torná-la inexigível.",
    typicalConsequences: [
      "Extinção da execução fiscal",
      "Necessidade de novo lançamento ou revisão do crédito",
    ],
    recommendedActions: [
      "Conferir requisitos formais (origem, valor, fundamentos) com a legislação",
      "Comparar CDA com o lançamento e autos de infração",
      "Propor exceção de pré-executividade ou embargos à execução",
    ],
  },
  {
    code: "PROVA_ILICITA",
    label: "Prova ilícita",
    category: "PROBATORIO",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description:
      "Prova obtida por meio ilícito ou com violação a direito fundamental, bem como as dela derivadas.",
    typicalContexts: ["PENAL", "CIVIL", "TRABALHISTA"],
    legalLogic:
      "Provas ilícitas devem ser desentranhadas; podem contaminar provas derivadas (teoria dos frutos da árvore envenenada).",
    typicalConsequences: [
      "Desentranhamento da prova",
      "Revisão da decisão que se baseava na prova ilícita",
    ],
    recommendedActions: [
      "Identificar claramente o vício de obtenção da prova",
      "Requerer desentranhamento e desconsideração",
      "Pedir revisão dos atos decisórios contaminados",
    ],
  },

  // ==================== MATERIAIS ====================
  {
    code: "EXCESSO_EXECUCAO",
    label: "Excesso de execução",
    category: "MATERIAL",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description:
      "Cobrança de valor superior ao devido no título executivo, com erros de cálculo ou inclusão de verbas indevidas.",
    typicalContexts: ["EXECUCAO_FISCAL", "CIVIL", "TRABALHISTA", "TRIBUTARIO"],
    legalLogic:
      "O executado pode impugnar a execução quando o credor cobra além do que lhe é devido (art. 917, CPC).",
    typicalConsequences: [
      "Redução do valor da execução",
      "Liberação de penhora excessiva",
      "Condenação em honorários sucumbenciais proporcionais",
    ],
    recommendedActions: [
      "Elaborar memória de cálculo demonstrando o excesso",
      "Identificar verbas cobradas indevidamente",
      "Opor embargos à execução ou impugnação ao cumprimento de sentença",
    ],
  },
  {
    code: "ERRO_CALCULO",
    label: "Erro material ou de cálculo",
    category: "MATERIAL",
    severity: "MEDIA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description:
      "Erro aritmético ou de digitação em decisão judicial ou cálculo apresentado pelas partes.",
    typicalContexts: ["CIVIL", "TRABALHISTA", "TRIBUTARIO", "EXECUCAO_FISCAL"],
    legalLogic:
      "Erros materiais podem ser corrigidos a qualquer tempo, inclusive de ofício (art. 494, CPC).",
    typicalConsequences: [
      "Correção do erro material",
      "Ajuste de valores devidos",
    ],
    recommendedActions: [
      "Identificar e demonstrar o erro aritmético",
      "Apresentar cálculo correto",
      "Peticionar requerendo correção",
    ],
  },
  {
    code: "MULTA_CONFISCATORIA",
    label: "Multa com caráter confiscatório",
    category: "MATERIAL",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description:
      "Multa tributária ou contratual em percentual excessivo que configura confisco vedado pela Constituição.",
    typicalContexts: ["TRIBUTARIO", "EXECUCAO_FISCAL", "CIVIL", "CONSUMIDOR"],
    legalLogic:
      "O STF entende que multas superiores a 100% do valor do tributo têm caráter confiscatório e violam o art. 150, IV, CF.",
    typicalConsequences: [
      "Redução da multa a patamares razoáveis",
      "Diminuição significativa do valor executado",
    ],
    recommendedActions: [
      "Verificar percentual da multa aplicada",
      "Comparar com jurisprudência do STF sobre limite",
      "Requerer redução da multa em embargos ou defesa",
    ],
  },

  // ==================== TITULO_EXECUTIVO ====================
  {
    code: "TITULO_SEM_TESTEMUNHA",
    label: "Título executivo sem assinatura de testemunhas",
    category: "TITULO_EXECUTIVO",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description: "Instrumento particular sem as 2 testemunhas exigidas pelo art. 784, III, CPC.",
    typicalContexts: ["CIVIL", "CONSUMIDOR", "EXECUCAO_FISCAL"],
    legalLogic: "Documentos particulares exigem 2 testemunhas para servir como título executivo.",
    typicalConsequences: ["Extinção da execução", "Necessidade de ação de cobrança pelo rito comum"],
    recommendedActions: ["Verificar assinaturas no documento original", "Arguir em exceção de pré-executividade"]
  },
  {
    code: "NOTA_PROMISSORIA_VINCULADA",
    label: "Nota promissória vinculada a contrato (perda de autonomia)",
    category: "TITULO_EXECUTIVO",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description: "NP emitida como garantia de contrato, perdendo natureza cambial autônoma.",
    typicalContexts: ["CIVIL", "CONSUMIDOR"],
    legalLogic: "Quando vinculada a contrato (pro solvendo), permite discutir causa subjacente. Súmula 258 STJ.",
    typicalConsequences: ["Possibilidade de discutir o contrato subjacente", "Alegação de vícios contratuais"],
    recommendedActions: ["Demonstrar vinculação causal", "Verificar menção a contrato na NP"]
  },
  {
    code: "TITULO_PRESCRITO_CAMBIAL",
    label: "Título cambial prescrito",
    category: "TITULO_EXECUTIVO",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_TOTAL",
    description: "Cheque, duplicata ou NP com prazo prescricional cambial esgotado.",
    typicalContexts: ["CIVIL", "CONSUMIDOR"],
    legalLogic: "Cheque: 6 meses; Duplicata/NP: 3 anos. Após, cabe apenas ação de locupletamento.",
    typicalConsequences: ["Perda da executividade cambial", "Conversão para ação monitória"],
    recommendedActions: ["Calcular prazo desde vencimento", "Arguir prescrição cambial"]
  },

  // ==================== BANCARIO ====================
  {
    code: "JUROS_CAPITALIZADOS",
    label: "Capitalização irregular de juros (anatocismo)",
    category: "BANCARIO",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description: "Cobrança de juros sobre juros sem previsão legal ou contratual expressa.",
    typicalContexts: ["CIVIL", "CONSUMIDOR"],
    legalLogic: "Capitalização mensal só permitida para IFs com CCB e previsão expressa. Súmula 539 STJ.",
    typicalConsequences: ["Recálculo da dívida", "Redução significativa do valor"],
    recommendedActions: ["Verificar tipo de contrato", "Solicitar perícia contábil"]
  },
  {
    code: "TAC_INDEVIDA",
    label: "Cobrança indevida de TAC/TEC",
    category: "BANCARIO",
    severity: "MEDIA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description: "Cobrança de Tarifa de Abertura de Crédito em contratos após 30/04/2008.",
    typicalContexts: ["CIVIL", "CONSUMIDOR"],
    legalLogic: "TAC proibida pela Res. CMN 3.518/07 para contratos após 30/04/2008.",
    typicalConsequences: ["Restituição do valor cobrado", "Devolução em dobro se má-fé"],
    recommendedActions: ["Verificar data do contrato", "Identificar cobrança de TAC/TEC"]
  },
  {
    code: "FORO_ELEICAO_ABUSIVO",
    label: "Foro de eleição contratual abusivo",
    category: "BANCARIO",
    severity: "MEDIA",
    impact: "PONTO_DE_ATENCAO",
    description: "Cláusula de foro que dificulta acesso à justiça pelo consumidor.",
    typicalContexts: ["CONSUMIDOR", "CIVIL"],
    legalLogic: "Foro que afasta consumidor de seu domicílio é nulo. Súmula 33 STJ.",
    typicalConsequences: ["Declinação de competência", "Remessa ao foro do domicílio"],
    recommendedActions: ["Comparar foro eleito com domicílio", "Suscitar incompetência relativa"]
  },
  {
    code: "PENHORA_EXCESSIVA",
    label: "Penhora em valor superior ao débito",
    category: "PROCESSUAL",
    severity: "ALTA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description: "Constrição de bens em valor muito superior ao necessário.",
    typicalContexts: ["EXECUCAO_FISCAL", "CIVIL", "TRABALHISTA"],
    legalLogic: "Penhora deve observar menor onerosidade (art. 805 CPC). Excesso deve ser liberado.",
    typicalConsequences: ["Liberação parcial da penhora", "Substituição por bem de menor valor"],
    recommendedActions: ["Comparar valor penhorado com débito", "Requerer redução da penhora"]
  },
  {
    code: "IMPENHORABILIDADE",
    label: "Penhora de bem impenhorável",
    category: "PROCESSUAL",
    severity: "CRITICA",
    impact: "POTENCIAL_REVERSAO_PARTE",
    description: "Constrição de bem protegido por impenhorabilidade legal (art. 833 CPC).",
    typicalContexts: ["EXECUCAO_FISCAL", "CIVIL", "TRABALHISTA"],
    legalLogic: "Bens de família, salários e instrumentos de trabalho são impenhoráveis.",
    typicalConsequences: ["Desconstituição da penhora", "Liberação do bem"],
    recommendedActions: ["Identificar natureza do bem", "Demonstrar enquadramento na impenhorabilidade"]
  },
];

// =========================
// Estratégias expandidas (V2)
// =========================

const STRATEGIES: NijaStrategyTemplate[] = [
  {
    code: "ESTRATEGIA_NULIDADE_CITACAO",
    label: "Atacar nulidade absoluta de citação",
    applicableRamos: [
      "CIVIL",
      "PENAL",
      "TRABALHISTA",
      "TRIBUTARIO",
      "EXECUCAO_FISCAL",
    ],
    description:
      "Estratégia voltada a reconhecer nulidade absoluta por ausência ou vício grave de citação, anulando atos subsequentes.",
    recommendedWhenDefects: ["NULIDADE_ABS_CITACAO_INEXISTENTE"],
    tacticalNotes: [
      "Checar se houve ciência informal suficiente para afastar a nulidade em casos específicos.",
      "Avaliar melhor via processual (recurso, ação autônoma, querela nullitatis).",
    ],
    potentialPieces: [
      "Preliminar de nulidade em contestação ou recurso",
      "Petição autônoma arguindo nulidade",
      "Querela nullitatis (hipóteses extremas)",
    ],
  },
  {
    code: "ESTRATEGIA_PRESCRICAO_MATERIAL",
    label: "Explorar prescrição material",
    applicableRamos: ["CIVIL", "TRABALHISTA", "TRIBUTARIO", "PREVIDENCIARIO"],
    description:
      "Utilização da prescrição para extinguir a pretensão, com resolução do mérito, quando esgotado o prazo legal.",
    recommendedWhenDefects: ["PRESCRICAO_MATERIAL"],
    tacticalNotes: [
      "Validar causas suspensivas e interruptivas antes de sustentar a prescrição.",
      "Reconstruir cronologia em quadro objetivo para demonstrar o prazo esgotado.",
    ],
    potentialPieces: [
      "Contestação com preliminar de prescrição",
      "Petição de extinção de execução por prescrição",
      "Memorial destacando a linha do tempo",
    ],
  },
  {
    code: "ESTRATEGIA_PRESCRICAO_INTERCORRENTE",
    label: "Explorar prescrição intercorrente",
    applicableRamos: ["EXECUCAO_FISCAL", "TRIBUTARIO", "CIVIL"],
    description:
      "Arguição de prescrição intercorrente por paralisação prolongada do processo sem impulso do exequente.",
    recommendedWhenDefects: ["PRESCRICAO_INTERCORRENTE"],
    tacticalNotes: [
      "Identificar período exato de paralisação nos autos.",
      "Verificar se houve intimação pessoal do exequente antes do arquivamento.",
      "Conferir se o prazo de 1 ano de suspensão + prazo prescricional foi excedido.",
    ],
    potentialPieces: [
      "Exceção de pré-executividade",
      "Petição simples requerendo extinção",
      "Embargos à execução com arguição de prescrição",
    ],
  },
  {
    code: "ESTRATEGIA_DECADENCIA",
    label: "Explorar decadência do direito",
    applicableRamos: ["CIVIL", "CONSUMIDOR", "FAMILIA", "TRIBUTARIO"],
    description:
      "Arguição de decadência para extinção do direito potestativo por decurso do prazo decadencial.",
    recommendedWhenDefects: ["DECADENCIA"],
    tacticalNotes: [
      "A decadência não admite interrupção ou suspensão (regra geral).",
      "Identificar o termo inicial do prazo com precisão.",
      "Verificar se o prazo é legal ou convencional.",
    ],
    potentialPieces: [
      "Contestação com arguição de decadência como mérito",
      "Petição incidental de reconhecimento de decadência",
    ],
  },
  {
    code: "ESTRATEGIA_EXCECAO_PRE_EXECUTIVIDADE",
    label: "Exceção de pré-executividade",
    applicableRamos: ["EXECUCAO_FISCAL", "TRIBUTARIO", "FAZENDARIO"],
    description:
      "Atacar vícios de CDA ou requisitos do título executivo sem necessidade de garantia do juízo.",
    recommendedWhenDefects: ["CDA_IRREGULAR", "PRESCRICAO_INTERCORRENTE", "EXCESSO_EXECUCAO"],
    tacticalNotes: [
      "Usar apenas para matérias de ordem pública ou aferíveis de plano.",
      "Combinar com prescrição, decadência e nulidades formais do título.",
    ],
    potentialPieces: [
      "Exceção de pré-executividade",
      "Embargos à execução como via complementar",
    ],
  },
  {
    code: "ESTRATEGIA_CERCEAMENTO_DEFESA",
    label: "Atacar cerceamento de defesa",
    applicableRamos: ["CIVIL", "TRABALHISTA", "FAMILIA", "ADMINISTRATIVO"],
    description:
      "Estratégia direcionada à anulação de atos ou sentenças que tenham impedido a produção de prova essencial.",
    recommendedWhenDefects: ["CERCEAMENTO_DEFESA"],
    tacticalNotes: [
      "Demonstrar claramente por que a prova era necessária.",
      "Evidenciar o prejuízo concreto sofrido pela parte.",
    ],
    potentialPieces: [
      "Apelação com preliminar de nulidade",
      "Agravo de instrumento contra decisão que indefere prova",
      "Embargos de declaração quando houver omissão",
    ],
  },
  {
    code: "ESTRATEGIA_ILEGITIMIDADE",
    label: "Arguir ilegitimidade de parte",
    applicableRamos: [
      "CIVIL",
      "CONSUMIDOR",
      "TRABALHISTA",
      "TRIBUTARIO",
      "EXECUCAO_FISCAL",
    ],
    description:
      "Estratégia para demonstrar que autor ou réu não são partes legítimas para figurar na demanda.",
    recommendedWhenDefects: ["ILEGITIMIDADE_PASSIVA", "ILEGITIMIDADE_ATIVA"],
    tacticalNotes: [
      "A ilegitimidade é condição da ação, conhecível de ofício.",
      "Demonstrar a ausência de relação jurídica material.",
      "Se possível, indicar o legitimado correto.",
    ],
    potentialPieces: [
      "Preliminar de ilegitimidade em contestação",
      "Agravo de instrumento se indeferida a preliminar",
      "Apelação reiterando a ilegitimidade",
    ],
  },
  {
    code: "ESTRATEGIA_COISA_JULGADA_LITISPENDENCIA",
    label: "Arguir coisa julgada ou litispendência",
    applicableRamos: ["CIVIL", "TRABALHISTA", "FAMILIA", "TRIBUTARIO"],
    description:
      "Estratégia para impedir processamento de ação idêntica a outra já julgada ou em trâmite.",
    recommendedWhenDefects: ["COISA_JULGADA", "LITISPENDENCIA"],
    tacticalNotes: [
      "Verificar identidade de partes, causa de pedir e pedido.",
      "Juntar certidão do processo anterior ou cópia da sentença transitada.",
      "A matéria é de ordem pública, conhecível em qualquer grau.",
    ],
    potentialPieces: [
      "Preliminar de coisa julgada ou litispendência em contestação",
      "Exceção processual",
      "Recurso arguindo a matéria",
    ],
  },
  {
    code: "ESTRATEGIA_INCOMPETENCIA",
    label: "Arguir incompetência absoluta",
    applicableRamos: [
      "CIVIL",
      "PENAL",
      "TRABALHISTA",
      "TRIBUTARIO",
      "ADMINISTRATIVO",
    ],
    description:
      "Estratégia para anular atos praticados por juízo absolutamente incompetente.",
    recommendedWhenDefects: ["INCOMPETENCIA_ABSOLUTA"],
    tacticalNotes: [
      "Identificar se a incompetência é material, funcional ou em razão da pessoa.",
      "A matéria é de ordem pública, não preclui.",
      "Os atos decisórios serão nulos, mas os instrutórios poderão ser aproveitados.",
    ],
    potentialPieces: [
      "Preliminar de incompetência em contestação",
      "Conflito de competência",
      "Recurso arguindo nulidade por incompetência",
    ],
  },
  {
    code: "ESTRATEGIA_VICIOS_FORMAIS",
    label: "Atacar vícios formais da inicial ou decisão",
    applicableRamos: ["CIVIL", "TRABALHISTA", "FAMILIA", "CONSUMIDOR"],
    description:
      "Estratégia para explorar inépcia da inicial, ausência de fundamentação ou outros vícios formais.",
    recommendedWhenDefects: ["INEPCIA_INICIAL", "AUSENCIA_FUNDAMENTACAO"],
    tacticalNotes: [
      "Verificar se houve oportunidade de emenda não aproveitada.",
      "A ausência de fundamentação é nulidade absoluta (art. 93, IX, CF).",
      "Embargos de declaração podem ser úteis para prequestionar.",
    ],
    potentialPieces: [
      "Preliminar de inépcia em contestação",
      "Embargos de declaração por omissão de fundamentação",
      "Apelação arguindo nulidade da sentença",
    ],
  },
  {
    code: "ESTRATEGIA_EXCESSO_EXECUCAO",
    label: "Impugnar excesso de execução",
    applicableRamos: ["EXECUCAO_FISCAL", "CIVIL", "TRABALHISTA", "TRIBUTARIO"],
    description:
      "Estratégia para reduzir o valor cobrado quando há cobrança além do devido.",
    recommendedWhenDefects: ["EXCESSO_EXECUCAO", "ERRO_CALCULO", "MULTA_CONFISCATORIA"],
    tacticalNotes: [
      "Elaborar memória de cálculo detalhada.",
      "Identificar verbas cobradas indevidamente ou com erro.",
      "Verificar aplicação de juros e correção monetária.",
    ],
    potentialPieces: [
      "Embargos à execução com impugnação de valores",
      "Impugnação ao cumprimento de sentença",
      "Exceção de pré-executividade (se aferível de plano)",
    ],
  },
  {
    code: "ESTRATEGIA_PROVA_ILICITA",
    label: "Requerer exclusão de prova ilícita",
    applicableRamos: ["PENAL", "CIVIL", "TRABALHISTA"],
    description:
      "Estratégia para desentranhamento de provas obtidas por meios ilícitos e suas derivadas.",
    recommendedWhenDefects: ["PROVA_ILICITA"],
    tacticalNotes: [
      "Identificar a ilegalidade na obtenção da prova.",
      "Verificar contaminação de provas derivadas (frutos da árvore envenenada).",
      "Requerer revisão de decisões baseadas na prova ilícita.",
    ],
    potentialPieces: [
      "Petição de desentranhamento de prova",
      "Recurso arguindo nulidade por uso de prova ilícita",
      "Habeas corpus (em matéria penal)",
    ],
  },
  {
    code: "ESTRATEGIA_SENTENCA_INCONGRUENTE",
    label: "Atacar sentença extra/ultra/citra petita",
    applicableRamos: ["CIVIL", "TRABALHISTA", "FAMILIA", "CONSUMIDOR"],
    description:
      "Estratégia para anular ou reformar sentença que julgou fora, além ou aquém do pedido.",
    recommendedWhenDefects: ["NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA"],
    tacticalNotes: [
      "Comparar dispositivo da sentença com os pedidos da inicial.",
      "Verificar se houve pedido implícito ou interpretação extensiva válida.",
      "Embargos de declaração podem resolver omissão (citra petita).",
    ],
    potentialPieces: [
      "Embargos de declaração para suprir omissão",
      "Apelação arguindo nulidade por julgamento extra/ultra petita",
      "Recurso especial por violação ao princípio da congruência",
    ],
  },
  // ==================== NOVAS ESTRATÉGIAS BANCÁRIAS/EXECUÇÃO ====================
  {
    code: "ESTRATEGIA_NULIDADE_TITULO",
    label: "Arguir nulidade do título executivo",
    applicableRamos: ["CIVIL", "CONSUMIDOR", "EXECUCAO_FISCAL"],
    description:
      "Estratégia para atacar a formação e validade do título executivo extrajudicial, arguindo requisitos legais ausentes.",
    recommendedWhenDefects: [
      "TITULO_SEM_TESTEMUNHA",
      "NOTA_PROMISSORIA_VINCULADA",
      "TITULO_PRESCRITO_CAMBIAL",
    ],
    tacticalNotes: [
      "Verificar presença de duas testemunhas no instrumento particular.",
      "Analisar se nota promissória está vinculada a contrato (perda de autonomia).",
      "Identificar tipo do título para aplicar prazo cambial correto.",
      "Avaliar uso de exceção de pré-executividade para matérias de ordem pública.",
    ],
    potentialPieces: [
      "Exceção de pré-executividade",
      "Embargos à execução com arguição de nulidade do título",
      "Impugnação ao cumprimento de sentença",
    ],
  },
  {
    code: "ESTRATEGIA_REVISAO_CONTRATUAL",
    label: "Propor revisão de cláusulas contratuais abusivas",
    applicableRamos: ["CIVIL", "CONSUMIDOR"],
    description:
      "Estratégia para revisar ou anular cláusulas abusivas em contratos de adesão, especialmente bancários.",
    recommendedWhenDefects: [
      "JUROS_CAPITALIZADOS",
      "TAC_INDEVIDA",
      "FORO_ELEICAO_ABUSIVO",
      "TAXA_JUROS_ABUSIVA",
      "VENCIMENTO_ANTECIPADO_ABUSIVO",
    ],
    tacticalNotes: [
      "Aplicar CDC para contratos de adesão bancários.",
      "Verificar se contrato é anterior/posterior à TAC (2008).",
      "Comparar taxa de juros com média de mercado do BACEN.",
      "Avaliar se há previsão legal expressa para capitalização.",
      "Questionar onerosidade excessiva de cláusulas penais.",
    ],
    potentialPieces: [
      "Ação revisional de contrato",
      "Contestação com pedido reconvencional de revisão",
      "Embargos à execução com tese revisional",
      "Ação declaratória de nulidade de cláusula",
    ],
  },
  {
    code: "ESTRATEGIA_IMPENHORABILIDADE",
    label: "Arguir impenhorabilidade do bem",
    applicableRamos: ["CIVIL", "EXECUCAO_FISCAL", "TRABALHISTA"],
    description:
      "Estratégia para proteger bens do devedor que são legalmente impenhoráveis.",
    recommendedWhenDefects: ["IMPENHORABILIDADE", "PENHORA_EXCESSIVA"],
    tacticalNotes: [
      "Verificar enquadramento no art. 833 do CPC (rol de impenhoráveis).",
      "Analisar se bem de família (Lei 8.009/90).",
      "Identificar se salário/proventos de aposentadoria.",
      "Avaliar proporcionalidade da penhora vs. débito.",
    ],
    potentialPieces: [
      "Impugnação à penhora",
      "Embargos de terceiro",
      "Embargos à execução com arguição de impenhorabilidade",
      "Petição simples nos autos requerendo liberação",
    ],
  },
  {
    code: "ESTRATEGIA_PRESCRICAO_CAMBIAL",
    label: "Arguir prescrição cambial do título",
    applicableRamos: ["CIVIL", "CONSUMIDOR"],
    description:
      "Estratégia específica para títulos de crédito com prazos prescricionais curtos (cheque, nota promissória, duplicata).",
    recommendedWhenDefects: ["TITULO_PRESCRITO_CAMBIAL", "PRESCRICAO_MATERIAL"],
    tacticalNotes: [
      "Cheque: 6 meses da apresentação + 6 meses da recusa (ação cambial).",
      "Nota promissória: 3 anos do vencimento para ação cambial.",
      "Duplicata: 3 anos do vencimento.",
      "Verificar se há novação ou interrupção do prazo.",
      "Após prescrição cambial, resta apenas ação monitória (5 anos).",
    ],
    potentialPieces: [
      "Exceção de pré-executividade arguindo prescrição",
      "Embargos à execução com tese prescricional",
      "Contestação com arguição de prescrição (ação monitória)",
    ],
  },
  {
    code: "ESTRATEGIA_EXCESSO_ENCARGOS",
    label: "Impugnar excesso de encargos financeiros",
    applicableRamos: ["CIVIL", "CONSUMIDOR", "EXECUCAO_FISCAL"],
    description:
      "Estratégia focada em reduzir valores cobrados por aplicação indevida de juros, multas e encargos.",
    recommendedWhenDefects: [
      "JUROS_CAPITALIZADOS",
      "TAC_INDEVIDA",
      "TAXA_JUROS_ABUSIVA",
      "EXCESSO_EXECUCAO",
      "ERRO_CALCULO",
    ],
    tacticalNotes: [
      "Elaborar planilha de cálculo expurgando encargos ilegais.",
      "Demonstrar diferença entre valor cobrado e valor devido.",
      "Aplicar juros simples quando não há pactuação expressa de compostos.",
      "Verificar limite de multa contratual (2% para consumidor).",
    ],
    potentialPieces: [
      "Impugnação aos cálculos do exequente",
      "Embargos à execução com planilha própria",
      "Ação de repetição de indébito",
      "Pedido de perícia contábil",
    ],
  },
];

// =========================
// ESPECIFICAÇÃO COMPLETA V2
// =========================

export const NIJA_CORE_SPEC: NijaCoreSpec = {
  version: "2.0.0",
  description:
    "Núcleo estático do NIJA SUPREMO V2 – catálogo expandido de vícios processuais e estratégias para análise jurídica avançada, integrado ao LEXOS.",
  invariants: [
    "Nunca inventar fatos não presentes nos documentos analisados.",
    "Nunca presumir a existência de peças não juntadas aos autos.",
    "Sempre apontar trechos ilegíveis, ausentes ou truncados antes de concluir.",
    "Jamais criar jurisprudência, números de processos ou decisões fictícias.",
    "Respeitar rigorosamente a linha do tempo processual.",
    "Classificar cada vício dentro de categorias objetivas e consistentes.",
    "Apresentar estratégias sem sugerir condutas antiéticas ou temerárias.",
    "Manter objetividade, técnica e aderência ao direito brasileiro.",
  ],
  defectCatalog: DEFECTS,
  strategyCatalog: STRATEGIES,
};
