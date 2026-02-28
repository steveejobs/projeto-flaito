// src/nija/analysis/defectDetectors.ts
// NIJA SUPREMO – Detectores Heurísticos de Vícios V1
// Detectores automáticos para vícios de título executivo e bancários

export interface DetectionResult {
  detected: boolean;
  confidence: "ALTA" | "MEDIA" | "BAIXA";
  evidence?: string;
  suggestedCode: string;
  context?: {
    tipoDocumento?: string;
    secaoDocumento?: string;
  };
}

// =========================
// 1. NOTA PROMISSÓRIA VINCULADA
// =========================

/**
 * Detecta menção de nota promissória vinculada a contrato.
 * Quando vinculada, a NP perde autonomia cambial (Súmula 258 STJ).
 */
export function detectNotaPromissoriaVinculada(text: string): DetectionResult {
  const patterns = [
    /nota\s+promiss[oó]ria.*(?:garant|vinculad|anexa|acess[oó]ri)/gi,
    /garantia.*nota\s+promiss[oó]ria/gi,
    /NP.*vinculada\s+ao\s+contrato/gi,
    /contrato.*nota\s+promiss[oó]ria.*garantia/gi,
    /nota\s+promiss[oó]ria\s+em\s+garantia/gi,
    /emitida\s+(?:como\s+)?garantia.*nota\s+promiss[oó]ria/gi,
    /nota\s+promiss[oó]ria.*pro\s+solvendo/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "NOTA_PROMISSORIA_VINCULADA",
        context: { tipoDocumento: "Contrato ou Nota Promissória" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "NOTA_PROMISSORIA_VINCULADA" };
}

// =========================
// 2. TAC INDEVIDA
// =========================

/**
 * Detecta cobrança de TAC/TEC em contratos.
 * TAC foi proibida após 30/04/2008 (Res. CMN 3.518/07).
 */
export function detectTacIndevida(text: string, contractDate?: Date): DetectionResult {
  const tacPatterns = [
    /TAC/i,
    /TEC/i,
    /tarifa\s+(?:de\s+)?abertura\s+(?:de\s+)?cr[ée]dito/i,
    /tarifa\s+(?:de\s+)?emiss[ãa]o\s+(?:de\s+)?carn[êe]/i,
    /tarifa\s+(?:de\s+)?cadastro/i,
  ];
  
  let hasTac = false;
  let matchedPattern = "";
  
  for (const pattern of tacPatterns) {
    const match = text.match(pattern);
    if (match) {
      hasTac = true;
      matchedPattern = match[0];
      break;
    }
  }
  
  if (!hasTac) {
    return { detected: false, confidence: "BAIXA", suggestedCode: "TAC_INDEVIDA" };
  }
  
  // Cutoff: 30/04/2008
  const cutoffDate = new Date("2008-04-30");
  const isPost2008 = contractDate ? contractDate >= cutoffDate : undefined;
  
  if (isPost2008 === true) {
    return {
      detected: true,
      confidence: "ALTA",
      evidence: `Menção a ${matchedPattern} em contrato posterior a 30/04/2008`,
      suggestedCode: "TAC_INDEVIDA",
      context: { tipoDocumento: "Contrato Bancário" }
    };
  }
  
  if (isPost2008 === false) {
    return { detected: false, confidence: "ALTA", suggestedCode: "TAC_INDEVIDA" };
  }
  
  // Sem data conhecida, detectar com confiança média
  return {
    detected: true,
    confidence: "MEDIA",
    evidence: `Menção a ${matchedPattern} - verificar data do contrato`,
    suggestedCode: "TAC_INDEVIDA",
    context: { tipoDocumento: "Contrato Bancário" }
  };
}

// =========================
// 3. JUROS CAPITALIZADOS
// =========================

/**
 * Detecta menção a capitalização de juros / anatocismo.
 */
export function detectJurosCapitalizados(text: string): DetectionResult {
  const patterns = [
    /capitaliza[çc][aã]o\s+(?:mensal|di[aá]ria|composta)/i,
    /juros\s+sobre\s+juros/i,
    /anatocismo/i,
    /juros\s+compostos/i,
    /capitaliza[çc][aã]o\s+de\s+juros/i,
    /juros\s+capitalizados/i,
    /cobran[çc]a\s+de\s+juros\s+compostos/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0],
        suggestedCode: "JUROS_CAPITALIZADOS",
        context: { tipoDocumento: "Contrato Bancário", secaoDocumento: "Cláusulas financeiras" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "JUROS_CAPITALIZADOS" };
}

// =========================
// 4. FORO DE ELEIÇÃO ABUSIVO
// =========================

/**
 * Detecta possível foro de eleição abusivo.
 * Compara foro eleito com domicílio do réu/consumidor.
 */
export function detectForoEleicaoAbusivo(
  foroEleicao: string,
  domicilioReu: string
): DetectionResult {
  if (!foroEleicao || !domicilioReu) {
    return { detected: false, confidence: "BAIXA", suggestedCode: "FORO_ELEICAO_ABUSIVO" };
  }
  
  const normalizeCity = (s: string) => 
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s]/g, "")
      .trim();
  
  const foroNorm = normalizeCity(foroEleicao);
  const domNorm = normalizeCity(domicilioReu);
  
  // Se são claramente diferentes e não há substring match
  if (foroNorm !== domNorm && !foroNorm.includes(domNorm) && !domNorm.includes(foroNorm)) {
    return {
      detected: true,
      confidence: "MEDIA",
      evidence: `Foro eleito: ${foroEleicao} ≠ Domicílio: ${domicilioReu}`,
      suggestedCode: "FORO_ELEICAO_ABUSIVO",
      context: { secaoDocumento: "Cláusula de foro" }
    };
  }
  
  return { detected: false, confidence: "ALTA", suggestedCode: "FORO_ELEICAO_ABUSIVO" };
}

// =========================
// 5. PENHORA EXCESSIVA
// =========================

/**
 * Detecta penhora em valor muito superior ao débito.
 * Viola o princípio da menor onerosidade (art. 805 CPC).
 */
export function detectPenhoraExcessiva(
  valorPenhorado: number,
  valorDebito: number
): DetectionResult {
  if (!valorPenhorado || !valorDebito || valorDebito <= 0) {
    return { detected: false, confidence: "BAIXA", suggestedCode: "PENHORA_EXCESSIVA" };
  }
  
  const ratio = valorPenhorado / valorDebito;
  
  // Mais de 50% de excesso = claramente excessivo
  if (ratio > 1.5) {
    const excessoPercent = ((ratio - 1) * 100).toFixed(0);
    return {
      detected: true,
      confidence: "ALTA",
      evidence: `Penhorado: R$ ${valorPenhorado.toFixed(2)}, Débito: R$ ${valorDebito.toFixed(2)} (${excessoPercent}% excesso)`,
      suggestedCode: "PENHORA_EXCESSIVA",
      context: { tipoDocumento: "Auto de Penhora", secaoDocumento: "Valores" }
    };
  }
  
  // Entre 20% e 50% de excesso = atenção
  if (ratio > 1.2) {
    const excessoPercent = ((ratio - 1) * 100).toFixed(0);
    return {
      detected: true,
      confidence: "MEDIA",
      evidence: `Possível excesso: ${excessoPercent}% acima do débito`,
      suggestedCode: "PENHORA_EXCESSIVA"
    };
  }
  
  return { detected: false, confidence: "ALTA", suggestedCode: "PENHORA_EXCESSIVA" };
}

// =========================
// 6. PRESCRIÇÃO CAMBIAL
// =========================

export type TipoTituloCambial = "CHEQUE" | "DUPLICATA" | "NOTA_PROMISSORIA" | "OUTRO";

/**
 * Detecta prescrição de título cambial.
 * Cheque: 6 meses (ação cambial)
 * Duplicata: 3 anos
 * Nota Promissória: 3 anos
 */
export function detectPrescricaoCambial(
  tipoTitulo: TipoTituloCambial,
  dataVencimento: Date,
  dataAjuizamento: Date
): DetectionResult {
  const prazosMeses: Record<TipoTituloCambial, number> = {
    CHEQUE: 6,           // Art. 59 Lei 7.357/85
    DUPLICATA: 36,       // Art. 18 Lei 5.474/68
    NOTA_PROMISSORIA: 36, // Art. 70 Dec. 57.663/66 (LUG)
    OUTRO: 60,           // Prazo geral 5 anos
  };
  
  const prazoMeses = prazosMeses[tipoTitulo];
  
  const diffMs = dataAjuizamento.getTime() - dataVencimento.getTime();
  const diffMeses = diffMs / (1000 * 60 * 60 * 24 * 30);
  
  if (diffMeses > prazoMeses) {
    return {
      detected: true,
      confidence: "ALTA",
      evidence: `${tipoTitulo}: ${Math.floor(diffMeses)} meses desde vencimento (prazo cambial: ${prazoMeses} meses)`,
      suggestedCode: "TITULO_PRESCRITO_CAMBIAL",
      context: { tipoDocumento: "Título de Crédito" }
    };
  }
  
  // Próximo de prescrever (últimos 60 dias)
  if (prazoMeses - diffMeses < 2) {
    return {
      detected: false,
      confidence: "MEDIA",
      evidence: `ATENÇÃO: Próximo da prescrição cambial em ${Math.floor((prazoMeses - diffMeses) * 30)} dias`,
      suggestedCode: "TITULO_PRESCRITO_CAMBIAL"
    };
  }
  
  return { detected: false, confidence: "ALTA", suggestedCode: "TITULO_PRESCRITO_CAMBIAL" };
}

// =========================
// 7. TÍTULO SEM TESTEMUNHAS
// =========================

/**
 * Detecta possível ausência de testemunhas em instrumento particular.
 * Art. 784, III, CPC exige 2 testemunhas para executividade.
 */
export function detectTituloSemTestemunha(
  documentType: string,
  ocrText: string
): DetectionResult {
  // Só aplicável a instrumentos particulares
  const isInstrumentoParticular = 
    documentType.toLowerCase().includes("instrumento particular") ||
    documentType.toLowerCase().includes("contrato") ||
    documentType.toLowerCase().includes("confissão de dívida");
  
  if (!isInstrumentoParticular) {
    return { detected: false, confidence: "BAIXA", suggestedCode: "TITULO_SEM_TESTEMUNHA" };
  }
  
  const testemunhaPatterns = [
    /testemunha/gi,
    /test\./gi,
    /1[ªa]\s*testemunha/gi,
    /2[ªa]\s*testemunha/gi,
  ];
  
  let testemunhaCount = 0;
  for (const pattern of testemunhaPatterns) {
    const matches = ocrText.match(pattern);
    if (matches) {
      testemunhaCount += matches.length;
    }
  }
  
  // Menos de 2 menções = suspeita de ausência
  if (testemunhaCount < 2) {
    return {
      detected: true,
      confidence: "MEDIA", // OCR pode falhar
      evidence: `Apenas ${testemunhaCount} referência(s) a testemunha(s) encontrada(s)`,
      suggestedCode: "TITULO_SEM_TESTEMUNHA",
      context: { tipoDocumento: documentType, secaoDocumento: "Assinaturas" }
    };
  }
  
  return { detected: false, confidence: "ALTA", suggestedCode: "TITULO_SEM_TESTEMUNHA" };
}

// =========================
// 8. TAXA DE JUROS ABUSIVA
// =========================

/**
 * Detecta taxa de juros potencialmente abusiva.
 * Compara com média de mercado BACEN.
 */
export function detectTaxaJurosAbusiva(
  taxaMensalContrato: number,
  taxaMediaMercado: number = 3.5 // Default: média aprox. de crédito pessoal
): DetectionResult {
  if (!taxaMensalContrato || taxaMensalContrato <= 0) {
    return { detected: false, confidence: "BAIXA", suggestedCode: "TAXA_JUROS_ABUSIVA" };
  }
  
  // Se taxa é mais que 50% acima da média = abusiva
  const ratio = taxaMensalContrato / taxaMediaMercado;
  
  if (ratio > 1.5) {
    return {
      detected: true,
      confidence: "ALTA",
      evidence: `Taxa contratual: ${taxaMensalContrato.toFixed(2)}% a.m. vs Média: ${taxaMediaMercado.toFixed(2)}% a.m. (${((ratio - 1) * 100).toFixed(0)}% acima)`,
      suggestedCode: "TAXA_JUROS_ABUSIVA",
      context: { tipoDocumento: "Contrato Bancário", secaoDocumento: "Taxas e encargos" }
    };
  }
  
  // Entre 30% e 50% acima = atenção
  if (ratio > 1.3) {
    return {
      detected: true,
      confidence: "MEDIA",
      evidence: `Taxa contratual ${((ratio - 1) * 100).toFixed(0)}% acima da média de mercado`,
      suggestedCode: "TAXA_JUROS_ABUSIVA"
    };
  }
  
  return { detected: false, confidence: "ALTA", suggestedCode: "TAXA_JUROS_ABUSIVA" };
}

// =========================
// 9. VENCIMENTO ANTECIPADO ABUSIVO
// =========================

/**
 * Detecta cláusulas de vencimento antecipado abusivas.
 */
export function detectVencimentoAntecipadoAbusivo(text: string): DetectionResult {
  const patterns = [
    /vencimento\s+antecipado.*mora\s+(?:de\s+)?(?:1|uma)\s+parcela/i,
    /atraso\s+de\s+(?:1|uma)\s+parcela.*vencimento\s+antecipado/i,
    /inadimplemento\s+de\s+qualquer\s+parcela.*total\s+da\s+d[íi]vida/i,
    /vencimento\s+antecipado.*protesto/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "MEDIA",
        evidence: match[0].substring(0, 100),
        suggestedCode: "VENCIMENTO_ANTECIPADO_ABUSIVO",
        context: { tipoDocumento: "Contrato", secaoDocumento: "Cláusulas de inadimplemento" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "VENCIMENTO_ANTECIPADO_ABUSIVO" };
}

// =========================
// 10. IMPENHORABILIDADE
// =========================

/**
 * Detecta menção a bens impenhoráveis.
 */
export function detectImpenhorabilidade(text: string): DetectionResult {
  const patterns = [
    /bem\s+de\s+fam[íi]lia/i,
    /impenhorabilidade/i,
    /impenhor[aá]vel/i,
    /sal[aá]rio.*penhora/i,
    /penhora.*sal[aá]rio/i,
    /instrumento\s+de\s+trabalho/i,
    /art\.\s*833.*CPC/i,
    /lei\s+8\.009/i,
    /única\s+moradia/i,
    /res[ıi]d[êe]ncia.*familiar/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0],
        suggestedCode: "IMPENHORABILIDADE",
        context: { secaoDocumento: "Penhora" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "IMPENHORABILIDADE" };
}

// =========================
// 11. NULIDADE DE CITAÇÃO
// =========================

/**
 * Detecta nulidade de citação.
 * Citação por edital sem esgotamento de diligências, citação por hora certa irregular, etc.
 */
export function detectNulidadeCitacao(text: string): DetectionResult {
  const patterns = [
    // Citação por edital irregular
    /cita[çc][aã]o\s+(?:por\s+)?edital.*(?:sem|n[aã]o).*(?:esgot|dilig[eê]ncia)/gi,
    /edital.*(?:sem|n[aã]o).*(?:localiza|encontr)/gi,
    // Citação por hora certa irregular  
    /hora\s+certa.*(?:irregular|nul|v[ií]cio)/gi,
    /cita[çc][aã]o.*hora\s+certa.*(?:sem|n[aã]o).*(?:requisito|formalidade)/gi,
    // AR negativo / não encontrado
    /AR\s+(?:devolvido|negativo)/gi,
    /aviso\s+de\s+recebimento.*(?:devolvido|n[aã]o\s+entregue)/gi,
    /n[aã]o\s+encontrado\s+no\s+endere[çc]o/gi,
    /(?:mudou-se|desconhecido|ausente)/gi,
    // Citação ficta
    /cita[çc][aã]o\s+ficta/gi,
    /cita[çc][aã]o\s+presumida/gi,
    // Nulidade expressa
    /nulidade.*cita[çc][aã]o/gi,
    /cita[çc][aã]o.*nul[ao]/gi,
    /aus[eê]ncia.*cita[çc][aã]o\s+v[aá]lida/gi,
    // Mandado não cumprido
    /mandado.*n[aã]o\s+cumprido/gi,
    /certid[aã]o.*negativa.*cita[çc][aã]o/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "NULIDADE_ABS_CITACAO_INEXISTENTE",
        context: { tipoDocumento: "Processo Judicial", secaoDocumento: "Citação" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "NULIDADE_ABS_CITACAO_INEXISTENTE" };
}

// =========================
// 12. CERCEAMENTO DE DEFESA
// =========================

/**
 * Detecta cerceamento de defesa.
 * Indeferimento de prova essencial, julgamento antecipado irregular, etc.
 */
export function detectCerceamentoDefesa(text: string): DetectionResult {
  const patterns = [
    // Indeferimento de prova
    /indefer(?:id[ao]|imento).*(?:prova|per[ií]cia|testemunha)/gi,
    /(?:prova|per[ií]cia|testemunha).*indefer/gi,
    /negad[ao].*produ[çc][aã]o\s+de\s+prova/gi,
    // Julgamento antecipado + perícia requerida
    /julgamento\s+antecipado.*(?:requerid[ao]|necess[aá]ri[ao]).*per[ií]cia/gi,
    /per[ií]cia.*requerid[ao].*julgamento\s+antecipado/gi,
    // Preclusão irregular
    /preclu(?:s[aã]o|sa).*(?:irregular|indevid[ao])/gi,
    /preclus[aã]o.*(?:n[aã]o\s+intimad|sem\s+oportunidade)/gi,
    // Não intimação
    /n[aã]o\s+(?:foi\s+)?intimad[ao].*(?:audi[eê]ncia|manifesta[çc][aã]o|prazo)/gi,
    /aus[eê]ncia\s+de\s+intima[çc][aã]o/gi,
    // Cerceamento expresso
    /cerceamento.*defesa/gi,
    /cerceado.*direito.*defesa/gi,
    // Revelia sem citação válida
    /revelia.*(?:sem|aus[eê]ncia).*cita[çc][aã]o/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "CERCEAMENTO_DEFESA",
        context: { tipoDocumento: "Processo Judicial", secaoDocumento: "Instrução" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "CERCEAMENTO_DEFESA" };
}

// =========================
// 13. INÉPCIA DA PETIÇÃO INICIAL
// =========================

/**
 * Detecta inépcia da petição inicial.
 * Pedido genérico, causa de pedir ausente, pedidos excludentes, etc.
 */
export function detectInepciaPeticaoInicial(text: string): DetectionResult {
  const patterns = [
    // Pedido genérico/indeterminado
    /pedido\s+gen[eé]rico/gi,
    /pedido\s+indeterminado/gi,
    /aus[eê]ncia\s+de\s+pedido\s+(?:certo|determinado)/gi,
    // Pedidos incompatíveis
    /pedidos?\s+(?:incompat[ií]ve(?:l|is)|excludentes|contradit[oó]rios)/gi,
    // Falta de causa de pedir
    /(?:falta|aus[eê]ncia).*causa\s+de\s+pedir/gi,
    /causa\s+de\s+pedir.*(?:inexistente|ausente)/gi,
    // Ausência de documento essencial
    /(?:falta|aus[eê]ncia).*documento\s+(?:essencial|indispens[aá]vel)/gi,
    /documento\s+essencial.*(?:n[aã]o\s+juntado|ausente)/gi,
    // Inépcia expressa
    /in[eé]pcia.*(?:inicial|peti[çc][aã]o)/gi,
    /peti[çc][aã]o.*inepta/gi,
    // Indeferimento da inicial
    /indeferimento.*peti[çc][aã]o\s+inicial/gi,
    /peti[çc][aã]o\s+inicial.*indeferid[ao]/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "INEPCIA_INICIAL",
        context: { tipoDocumento: "Petição Inicial", secaoDocumento: "Requisitos" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "INEPCIA_INICIAL" };
}

// =========================
// 14. AUSÊNCIA DE FUNDAMENTAÇÃO
// =========================

/**
 * Detecta decisão sem fundamentação adequada.
 * Decisões genéricas, sem enfrentamento de argumentos, etc.
 */
export function detectAusenciaFundamentacao(text: string): DetectionResult {
  const patterns = [
    // Fundamentação per relationem abusiva
    /por\s+seus\s+pr[oó]prios\s+fundamentos/gi,
    /pelos?\s+motivos?\s+(?:j[aá]\s+)?expostos?/gi,
    /adoto\s+(?:como\s+)?raz[oõ]es\s+de\s+decidir/gi,
    // Fundamentação genérica
    /conforme\s+jurisprud[eê]ncia.*(?:pac[ií]fica|dominante)/gi,
    /segundo\s+(?:entendimento|orienta[çc][aã]o)\s+(?:deste|do)\s+(?:tribunal|juízo)/gi,
    // Sem citar qual precedente
    /precedentes?\s+(?:desta|do)\s+(?:corte|tribunal)/gi,
    // Omissão de análise
    /(?:deixou|deixa)\s+de\s+(?:analisar|apreciar|enfrentar)/gi,
    /omiss[aã]o\s+quanto/gi,
    /n[aã]o\s+(?:analisou|apreciou|enfrentou)/gi,
    // Nulidade por falta de fundamentação
    /nulidade.*(?:falta|aus[eê]ncia).*fundamenta[çc][aã]o/gi,
    /aus[eê]ncia\s+de\s+fundamenta[çc][aã]o/gi,
    /decis[aã]o.*(?:sem|carente\s+de)\s+fundamenta[çc][aã]o/gi,
    // Art. 489 CPC
    /art(?:igo)?\.?\s*489.*CPC/gi,
    /§\s*1[ºo].*art(?:igo)?\.?\s*489/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "MEDIA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "AUSENCIA_FUNDAMENTACAO",
        context: { tipoDocumento: "Decisão Judicial", secaoDocumento: "Fundamentação" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "AUSENCIA_FUNDAMENTACAO" };
}

// =========================
// 15. CDA IRREGULAR
// =========================

/**
 * Detecta CDA com vícios formais.
 * Ausência de fundamentação legal, erro no sujeito passivo, etc.
 */
export function detectCDAIrregular(text: string): DetectionResult {
  const patterns = [
    // Vícios formais
    /CDA.*(?:irregular|nul[ao]|v[ií]cio)/gi,
    /certid[aã]o\s+de\s+d[ií]vida\s+ativa.*(?:irregular|nul|v[ií]cio)/gi,
    // Ausência de fundamentação legal
    /(?:aus[eê]ncia|falta).*fundamenta[çc][aã]o\s+legal.*(?:CDA|tribut)/gi,
    /CDA.*(?:sem|n[aã]o\s+cont[eé]m).*fundamento\s+legal/gi,
    // Sem demonstrativo de cálculo
    /(?:aus[eê]ncia|falta).*demonstrativo.*c[aá]lculo/gi,
    /(?:sem|n[aã]o\s+h[aá]).*(?:mem[oó]ria|demonstrativo).*c[aá]lculo/gi,
    // Erro no sujeito passivo
    /erro.*(?:identifica[çc][aã]o|indica[çc][aã]o).*sujeito\s+passivo/gi,
    /sujeito\s+passivo.*(?:ileg[ií]timo|incorre[tc]o)/gi,
    // Lançamento nulo
    /lan[çc]amento.*nul[ao]/gi,
    /auto\s+de\s+infra[çc][aã]o.*nul[ao]/gi,
    /nulidade.*lan[çc]amento/gi,
    // CDA substitutiva irregular
    /CDA\s+substitut(?:a|iva).*(?:irregular|ap[oó]s|cita[çc][aã]o)/gi,
    /substitui[çc][aã]o.*CDA.*(?:irregular|vedada)/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "CDA_IRREGULAR",
        context: { tipoDocumento: "Execução Fiscal", secaoDocumento: "Título Executivo" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "CDA_IRREGULAR" };
}

// =========================
// 16. MULTA CONFISCATÓRIA
// =========================

/**
 * Detecta multa com caráter confiscatório.
 * Multas superiores a 100% do principal, etc.
 */
export function detectMultaConfiscatoria(text: string): DetectionResult {
  // Padrões de percentuais elevados
  const percentPatterns = [
    /multa\s+(?:de\s+)?(\d{3,})%/gi,      // 100%+
    /multa\s+(?:de\s+)?1[5-9]\d%/gi,       // 150-199%
    /multa\s+(?:de\s+)?[2-9]\d{2}%/gi,     // 200%+
    /(\d{3,})[%\s]*(?:de\s+)?multa/gi,     // 100%+ de multa
  ];
  
  for (const pattern of percentPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "ALTA",
        evidence: `Multa ${match[0]} - possível caráter confiscatório (STF: limite de 100%)`,
        suggestedCode: "MULTA_CONFISCATORIA",
        context: { tipoDocumento: "Execução Fiscal", secaoDocumento: "Penalidade" }
      };
    }
  }
  
  // Padrões textuais
  const textPatterns = [
    /multa.*(?:confiscat[oó]ri[ao]|excessiv[ao])/gi,
    /car[aá]ter\s+confiscat[oó]rio/gi,
    /multa.*(?:superior|excede).*(?:principal|tributo)/gi,
    /multa\s+punitiva.*(?:excessiv|abusiv)/gi,
  ];
  
  for (const pattern of textPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "MEDIA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "MULTA_CONFISCATORIA",
        context: { tipoDocumento: "Execução Fiscal", secaoDocumento: "Penalidade" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "MULTA_CONFISCATORIA" };
}

// =========================
// 17. ERRO DE CÁLCULO
// =========================

/**
 * Detecta erro de cálculo.
 * Erro aritmético, divergência de valores, etc.
 */
export function detectErroCalculo(text: string): DetectionResult {
  const patterns = [
    // Erro aritmético/material
    /erro\s+(?:aritm[eé]tico|material|de\s+c[aá]lculo)/gi,
    /c[aá]lculo.*(?:incorreto|errado|equivocado)/gi,
    // Divergência de valores
    /diverg[eê]ncia.*valor(?:es)?/gi,
    /valor(?:es)?.*divergente?s?/gi,
    /diferen[çc]a\s+(?:de\s+)?R?\$\s*[\d.,]+/gi,
    // Excesso de execução
    /excesso\s+de\s+execu[çc][aã]o/gi,
    /execu[çc][aã]o.*excess(?:o|iva)/gi,
    // Recálculo necessário
    /rec[aá]lculo\s+necess[aá]rio/gi,
    /necess(?:idade|[aá]rio).*rec[aá]lculo/gi,
    // Impugnação aos cálculos
    /impugna[çc][aã]o.*c[aá]lculo/gi,
    /c[aá]lculo.*impugnad/gi,
    // Planilha incorreta
    /planilha.*(?:incorret|err|equivocad)/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "MEDIA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "ERRO_CALCULO",
        context: { tipoDocumento: "Cálculo/Planilha", secaoDocumento: "Valores" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "ERRO_CALCULO" };
}

// =========================
// 18. LITISPENDÊNCIA / COISA JULGADA
// =========================

/**
 * Detecta litispendência ou coisa julgada.
 * Ação idêntica em trâmite ou já transitada em julgado.
 */
export function detectLitispendenciaCoisa(text: string): DetectionResult {
  const patterns = [
    // Litispendência
    /litispend[eê]ncia/gi,
    /a[çc][aã]o\s+id[eê]ntica.*tr[aâ]mite/gi,
    /demanda\s+id[eê]ntica/gi,
    /processo\s+(?:anterior|paralelo).*mesmo/gi,
    // Coisa julgada
    /coisa\s+julgada/gi,
    /res\s+judicata/gi,
    /transitad[ao]\s+em\s+julgado.*(?:mesm[ao]|id[eê]ntic)/gi,
    /j[aá]\s+(?:decidid|julgad)[ao].*transit/gi,
    // Tríplice identidade
    /tr[ií]plice\s+identidade/gi,
    /mesmas?\s+partes.*causa.*pedido/gi,
    /identidade\s+de\s+(?:partes|causa|pedido)/gi,
    // Ofensa expressa
    /ofensa.*coisa\s+julgada/gi,
    /viola[çc][aã]o.*coisa\s+julgada/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const isCoisa = match[0].toLowerCase().includes("coisa") || 
                       match[0].toLowerCase().includes("transit") ||
                       match[0].toLowerCase().includes("res judicata");
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0].substring(0, 150),
        suggestedCode: isCoisa ? "COISA_JULGADA" : "LITISPENDENCIA",
        context: { tipoDocumento: "Processo Judicial", secaoDocumento: "Preliminares" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "LITISPENDENCIA" };
}

// =========================
// 19. INCOMPETÊNCIA DO JUÍZO
// =========================

/**
 * Detecta incompetência do juízo.
 * Competência da Justiça Federal vs Estadual, Trabalhista, etc.
 */
export function detectIncompetencia(text: string): DetectionResult {
  const patterns = [
    // Incompetência absoluta
    /incompet[eê]ncia\s+absoluta/gi,
    /absolutamente\s+incompetente/gi,
    // Competência Federal vs Estadual
    /compet[eê]ncia.*justi[çc]a\s+federal/gi,
    /justi[çc]a\s+federal.*competente/gi,
    /incompet[eê]ncia.*justi[çc]a\s+estadual/gi,
    // Competência Trabalhista
    /compet[eê]ncia.*justi[çc]a\s+(?:do\s+)?trabalho/gi,
    /mat[eé]ria.*trabalhista.*compet[eê]ncia/gi,
    // Foro do domicílio
    /foro\s+(?:do\s+)?domic[ií]lio.*r[eé]u/gi,
    /compet[eê]ncia.*territorial/gi,
    // Vara especializada
    /vara\s+(?:especializada|privativa)/gi,
    /compet[eê]ncia.*vara.*(?:faz|fam[ií]l|crim)/gi,
    // Declínio de competência
    /decl[ií]nio.*compet[eê]ncia/gi,
    /remess[ao].*ju[ií]zo\s+competente/gi,
    // Conflito de competência
    /conflito.*compet[eê]ncia/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "INCOMPETENCIA_ABSOLUTA",
        context: { tipoDocumento: "Processo Judicial", secaoDocumento: "Competência" }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "INCOMPETENCIA_ABSOLUTA" };
}

// =========================
// 20. SENTENÇA EXTRA/ULTRA/CITRA PETITA
// =========================

/**
 * Detecta vícios de congruência na sentença.
 * Julgamento fora, além ou aquém do pedido.
 */
export function detectSentencaExtraUltraCitra(text: string): DetectionResult {
  const patterns = [
    // Extra petita
    /extra\s+petita/gi,
    /(?:julgou|concedeu|deferiu).*(?:n[aã]o|sem)\s+(?:foi\s+)?pedido/gi,
    /al[eé]m\s+do\s+(?:que\s+foi\s+)?pedido/gi,
    /matéria.*n[aã]o\s+(?:foi\s+)?suscitada/gi,
    // Ultra petita
    /ultra\s+petita/gi,
    /(?:concedeu|deferiu).*(?:mais|superior).*pedido/gi,
    /excedeu.*limites.*pedido/gi,
    /valor.*(?:superior|maior).*pleiteado/gi,
    // Citra petita (omissão)
    /citra\s+petita/gi,
    /pedido\s+n[aã]o\s+(?:foi\s+)?(?:analisado|apreciado|julgado)/gi,
    /omiss[aã]o.*(?:quanto\s+ao|sobre\s+o)\s+pedido/gi,
    /deixou\s+de\s+(?:analisar|apreciar|julgar).*pedido/gi,
    // Violação da congruência
    /viola[çc][aã]o.*(?:congru[eê]ncia|correla[çc][aã]o)/gi,
    /princ[ií]pio.*congru[eê]ncia/gi,
    // Sentença nula por vício
    /senten[çc]a.*(?:nul|v[ií]cio).*(?:extra|ultra|citra)/gi,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const matchLower = match[0].toLowerCase();
      let vicio = "EXTRA_PETITA";
      if (matchLower.includes("ultra") || matchLower.includes("superior") || matchLower.includes("maior")) {
        vicio = "ULTRA_PETITA";
      } else if (matchLower.includes("citra") || matchLower.includes("omiss") || matchLower.includes("deixou")) {
        vicio = "CITRA_PETITA";
      }
      
      return {
        detected: true,
        confidence: "ALTA",
        evidence: match[0].substring(0, 150),
        suggestedCode: "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA",
        context: { 
          tipoDocumento: "Sentença", 
          secaoDocumento: `Congruência - ${vicio}` 
        }
      };
    }
  }
  
  return { detected: false, confidence: "BAIXA", suggestedCode: "NULIDADE_SENTENCA_EXTRA_ULTRA_CITRA_PETITA" };
}
