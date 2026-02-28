// src/nija/analysis/contractExtractor.ts
// NIJA SUPREMO – Extrator de Dados Contratuais V1
// Extrai informações de contratos bancários e títulos

export interface DadosContratoExtraido {
  // Identificação
  numeroContrato?: string;
  tipoContrato?: string;
  
  // Datas
  dataOperacao?: Date;
  dataPrimeiroVencimento?: Date;
  dataMora?: Date;
  
  // Valores
  valorOriginal?: number;
  valorAtualizado?: number;
  valorPrincipal?: number;
  
  // Taxas
  taxaJurosMensal?: number;
  taxaJurosAnual?: number;
  taxaMulta?: number;
  taxaMora?: number;
  
  // Parcelas
  numeroParcelas?: number;
  valorParcela?: number;
  parcelasVencidas?: number;
  
  // Garantias
  notaPromissoriaVinculada?: boolean;
  valorNotaPromissoria?: number;
  temAvalista?: boolean;
  nomeAvalista?: string;
  
  // Tarifas
  temTAC?: boolean;
  valorTAC?: number;
  temIOF?: boolean;
  valorIOF?: number;
  
  // Foro
  foroEleicao?: string;
  
  // Confiança da extração
  confianca: "ALTA" | "MEDIA" | "BAIXA";
  camposExtraidos: string[];
  camposNaoEncontrados: string[];
}

/**
 * Extrai número de um texto monetário brasileiro.
 */
function parseValorBR(text: string): number | undefined {
  if (!text) return undefined;
  
  // Remove "R$" e espaços
  let clean = text.replace(/R\$\s*/gi, "").trim();
  
  // Padrão brasileiro: 1.234.567,89
  // Converte para formato numérico
  clean = clean.replace(/\./g, "").replace(",", ".");
  
  const num = parseFloat(clean);
  return isNaN(num) ? undefined : num;
}

/**
 * Extrai data de um texto brasileiro.
 */
function parseDataBR(text: string): Date | undefined {
  if (!text) return undefined;
  
  // Padrões comuns: DD/MM/AAAA, DD/MM/AA, DD.MM.AAAA
  const patterns = [
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\d{2})\/(\d{2})\/(\d{2})/,
    /(\d{2})\.(\d{2})\.(\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let year = parseInt(match[3]);
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }
      const date = new Date(year, parseInt(match[2]) - 1, parseInt(match[1]));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  return undefined;
}

/**
 * Extrai percentual de um texto.
 */
function parsePercentual(text: string): number | undefined {
  if (!text) return undefined;
  
  // Padrões: 2,5%, 2.5%, 2,5 %, etc.
  const match = text.match(/([\d,\.]+)\s*%/);
  if (match) {
    const num = parseFloat(match[1].replace(",", "."));
    return isNaN(num) ? undefined : num;
  }
  
  return undefined;
}

/**
 * Extrai dados contratuais de um texto.
 */
export function extrairDadosContrato(text: string): DadosContratoExtraido {
  const camposExtraidos: string[] = [];
  const camposNaoEncontrados: string[] = [];
  
  const resultado: DadosContratoExtraido = {
    confianca: "BAIXA",
    camposExtraidos,
    camposNaoEncontrados,
  };
  
  // ==================== NÚMERO DO CONTRATO ====================
  const numeroContratoPatterns = [
    /N[º°]?\s*(?:do\s+)?Contrato[:\s|]+(\d{5,15})/i,
    /Contrato\s+(?:n[º°]?\s*)?(\d{5,15})/i,
    /CCB\s+(?:n[º°]?\s*)?(\d{5,15})/i,
    // Bradesco specific: "Nº Contrato | 7879250"
    /N[º°]\s*Contrato\s*\|\s*(\d{5,15})/i,
    // Table format: "Contrato" header followed by number
    /Contrato[\s\n]+(\d{5,15})/i,
  ];
  
  for (const pattern of numeroContratoPatterns) {
    const match = text.match(pattern);
    if (match) {
      resultado.numeroContrato = match[1];
      camposExtraidos.push("numeroContrato");
      break;
    }
  }
  if (!resultado.numeroContrato) camposNaoEncontrados.push("numeroContrato");
  
  // ==================== DATA DA OPERAÇÃO ====================
  const dataOperacaoPatterns = [
    /Data\s+(?:da\s+)?Opera[çc][aã]o[:\s|]+(\d{2}\/\d{2}\/\d{2,4})/i,
    /Data\s+(?:da\s+)?Libera[çc][aã]o[:\s]+(\d{2}\/\d{2}\/\d{2,4})/i,
    /Liberado\s+em[:\s]+(\d{2}\/\d{2}\/\d{2,4})/i,
    // Bradesco specific: "Data da Operação | 13/01/14"
    /Data\s+da\s+Opera[çc][aã]o\s*\|\s*(\d{2}\/\d{2}\/\d{2,4})/i,
  ];
  
  for (const pattern of dataOperacaoPatterns) {
    const match = text.match(pattern);
    if (match) {
      resultado.dataOperacao = parseDataBR(match[1]);
      if (resultado.dataOperacao) {
        camposExtraidos.push("dataOperacao");
        break;
      }
    }
  }
  if (!resultado.dataOperacao) camposNaoEncontrados.push("dataOperacao");
  
  // ==================== DATA DA MORA ====================
  const dataMoraPatterns = [
    /Vencimento\/Mora[:\s|]+(\d{2}\/\d{2}\/\d{2,4})/i,
    /Data\s+(?:da\s+)?Mora[:\s]+(\d{2}\/\d{2}\/\d{2,4})/i,
    /Inadimplemento[:\s]+(\d{2}\/\d{2}\/\d{2,4})/i,
    // Bradesco specific: "Vencimento/Mora | 19/02/15"
    /Vencimento\s*\/\s*Mora\s*\|\s*(\d{2}\/\d{2}\/\d{2,4})/i,
  ];
  
  for (const pattern of dataMoraPatterns) {
    const match = text.match(pattern);
    if (match) {
      resultado.dataMora = parseDataBR(match[1]);
      if (resultado.dataMora) {
        camposExtraidos.push("dataMora");
        break;
      }
    }
  }
  if (!resultado.dataMora) camposNaoEncontrados.push("dataMora");
  
  // ==================== VALOR ORIGINAL ====================
  const valorOriginalPatterns = [
    /(?:Total|Valor)\s+(?:da\s+)?(?:d[íi]vida|confessad[ao])[:\s-]*R\$\s*([\d.,]+)/i,
    /Valor\s+(?:do\s+)?Cr[ée]dito[:\s]+R\$\s*([\d.,]+)/i,
    /Principal[:\s]+R\$\s*([\d.,]+)/i,
    // Bradesco specific: "Total da dívida confessada -R$: 100.096,17"
    /Total\s+da\s+d[ií]vida\s+confessada\s*[-–]\s*R\$[:\s]*([\d.,]+)/i,
    // Bradesco CCB: "Valor Total do crédito" 
    /Valor\s+Total\s+(?:do\s+)?Cr[ée]dito[:\s]*R\$\s*([\d.,]+)/i,
  ];
  
  for (const pattern of valorOriginalPatterns) {
    const match = text.match(pattern);
    if (match) {
      resultado.valorOriginal = parseValorBR(match[1]);
      if (resultado.valorOriginal) {
        camposExtraidos.push("valorOriginal");
        break;
      }
    }
  }
  if (!resultado.valorOriginal) camposNaoEncontrados.push("valorOriginal");
  
  // ==================== TAXA DE JUROS ====================
  const taxaJurosPatterns = [
    /Juros\s+remuneratórios[:\s]*([\d,]+)\s*%\s*(?:ao\s+)?m[êe]s/i,
    /Taxa\s+de\s+juros[:\s]*([\d,]+)\s*%\s*(?:a\.?m\.?|mensal)/i,
    /Juros[:\s]*([\d,]+)\s*%\s*(?:a\.?m\.?|mensal)/i,
    // Bradesco specific: "Juros remuneratórios: 1,30% ao mês"
    /Juros\s+remunerat[óo]rios[:\s]*([\d,]+)\s*%/i,
    // Bradesco CCB table format
    /Taxa\s+Juros\s+(?:Mensal|a\.m\.)[:\s]*([\d,]+)\s*%/i,
  ];
  
  for (const pattern of taxaJurosPatterns) {
    const match = text.match(pattern);
    if (match) {
      resultado.taxaJurosMensal = parsePercentual(match[1] + "%");
      if (resultado.taxaJurosMensal) {
        camposExtraidos.push("taxaJurosMensal");
        break;
      }
    }
  }
  if (!resultado.taxaJurosMensal) camposNaoEncontrados.push("taxaJurosMensal");
  
  // Taxa anual
  const taxaAnualMatch = text.match(/Taxa\s+(?:de\s+)?juros[:\s]*([\d,]+)\s*%\s*(?:a\.?a\.?|anual)/i);
  if (taxaAnualMatch) {
    resultado.taxaJurosAnual = parsePercentual(taxaAnualMatch[1] + "%");
    if (resultado.taxaJurosAnual) camposExtraidos.push("taxaJurosAnual");
  }
  
  // ==================== PARCELAS ====================
  const parcelasPatterns = [
    /(\d+)\s*(?:parcelas|presta[çc][õo]es)/i,
    /parcela(?:s|do)\s+em\s+(\d+)/i,
    // Bradesco specific: "36 parcelas mensais"
    /(\d+)\s+parcelas?\s+(?:mensais|consecutivas)/i,
    // Table format: "Quantidade de Prestações: 36"
    /(?:Quantidade|N[úu]mero)\s+(?:de\s+)?Presta[çc][õo]es[:\s]+(\d+)/i,
  ];
  
  for (const pattern of parcelasPatterns) {
    const match = text.match(pattern);
    if (match) {
      resultado.numeroParcelas = parseInt(match[1]);
      if (resultado.numeroParcelas) {
        camposExtraidos.push("numeroParcelas");
        break;
      }
    }
  }
  if (!resultado.numeroParcelas) camposNaoEncontrados.push("numeroParcelas");
  
  // Valor da parcela - expanded patterns
  const valorParcelaPatterns = [
    /(?:Valor\s+(?:da\s+)?Parcela|Presta[çc][aã]o)[:\s]+R\$\s*([\d.,]+)/i,
    // Bradesco: "Prestação mensal de R$ 1.550,70"
    /Presta[çc][aã]o\s+mensal\s+(?:de\s+)?R\$\s*([\d.,]+)/i,
    // Table format: "Valor da Prestação | 1.550,70"
    /Valor\s+(?:da\s+)?Presta[çc][aã]o\s*\|\s*R?\$?\s*([\d.,]+)/i,
  ];
  
  for (const pattern of valorParcelaPatterns) {
    const match = text.match(pattern);
    if (match) {
      resultado.valorParcela = parseValorBR(match[1]);
      if (resultado.valorParcela) {
        camposExtraidos.push("valorParcela");
        break;
      }
    }
  }
  
  // ==================== NOTA PROMISSÓRIA ====================
  if (
    text.match(/nota\s+promiss[oó]ria/i) ||
    text.match(/NP[:\s]/i) ||
    text.match(/PROM\d/i)
  ) {
    resultado.notaPromissoriaVinculada = true;
    camposExtraidos.push("notaPromissoriaVinculada");
    
    // Enhanced patterns for promissory note value
    const valorNPPatterns = [
      /(?:NP|Nota\s+Promiss[oó]ria)[:\s]*(?:de\s+)?R\$\s*([\d.,]+)/i,
      // Bradesco: "Valor da garantia - Nota Promissória R$ 55.875,04"
      /Valor\s+(?:da\s+)?garantia[^R]*R\$\s*([\d.,]+)/i,
      // "Nota Promissória no valor de R$ X"
      /Nota\s+Promiss[oó]ria\s+(?:no\s+)?valor\s+(?:de\s+)?R\$\s*([\d.,]+)/i,
      // Table: "PROM1 | R$ 55.875,04"
      /PROM\d\s*[|\-]\s*R?\$?\s*([\d.,]+)/i,
    ];
    
    for (const pattern of valorNPPatterns) {
      const match = text.match(pattern);
      if (match) {
        resultado.valorNotaPromissoria = parseValorBR(match[1]);
        if (resultado.valorNotaPromissoria) {
          camposExtraidos.push("valorNotaPromissoria");
          break;
        }
      }
    }
  }
  
  // ==================== ENTRADA / PAGAMENTO INICIAL ====================
  const entradaPatterns = [
    /Entrada[:\s]+R\$\s*([\d.,]+)/i,
    // Bradesco: "Valor - R$: 13.700,00" in section 2C1
    /(?:2C1|Pagamento\s+Inicial)[^R]*R\$[:\s]*([\d.,]+)/i,
    /Sinal[:\s]+R\$\s*([\d.,]+)/i,
  ];
  
  for (const pattern of entradaPatterns) {
    const match = text.match(pattern);
    if (match) {
      const entrada = parseValorBR(match[1]);
      if (entrada && entrada > 0) {
        // Store as valorPrincipal if not set (entrada affects principal calculation)
        if (!resultado.valorPrincipal) {
          resultado.valorPrincipal = entrada;
          camposExtraidos.push("valorPrincipal");
        }
        break;
      }
    }
  }
  
  // ==================== TAC ====================
  if (text.match(/TAC|Tarifa\s+(?:de\s+)?Abertura\s+(?:de\s+)?Cr[ée]dito/i)) {
    resultado.temTAC = true;
    camposExtraidos.push("temTAC");
    
    const valorTACMatch = text.match(/TAC[:\s]+R\$\s*([\d.,]+)/i);
    if (valorTACMatch) {
      resultado.valorTAC = parseValorBR(valorTACMatch[1]);
      if (resultado.valorTAC) camposExtraidos.push("valorTAC");
    }
  }
  
  // ==================== IOF ====================
  if (text.match(/IOF/i)) {
    resultado.temIOF = true;
    camposExtraidos.push("temIOF");
    
    const valorIOFMatch = text.match(/IOF[:\s]+R\$\s*([\d.,]+)/i);
    if (valorIOFMatch) {
      resultado.valorIOF = parseValorBR(valorIOFMatch[1]);
      if (resultado.valorIOF) camposExtraidos.push("valorIOF");
    }
  }
  
  // ==================== FORO ====================
  const foroMatch = text.match(/Foro[:\s]+(?:Comarca\s+de\s+)?([A-Za-zÀ-ú\s]+)(?:[-–]|$)/i);
  if (foroMatch) {
    resultado.foroEleicao = foroMatch[1].trim();
    camposExtraidos.push("foroEleicao");
  }
  
  // ==================== AVALISTA ====================
  if (text.match(/avalista|fiador|garantidor|interveniente/i)) {
    resultado.temAvalista = true;
    camposExtraidos.push("temAvalista");
    
    const avalistaMatch = text.match(/(?:Avalista|Fiador|Garantidor)[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/);
    if (avalistaMatch) {
      resultado.nomeAvalista = avalistaMatch[1].trim();
      camposExtraidos.push("nomeAvalista");
    }
  }
  
  // ==================== TIPO DE CONTRATO ====================
  if (text.match(/C[ée]dula\s+de\s+Cr[ée]dito\s+Banc[aá]rio|CCB/i)) {
    resultado.tipoContrato = "CCB";
  } else if (text.match(/Confiss[aã]o\s+de\s+D[ií]vida/i)) {
    resultado.tipoContrato = "CONFISSAO_DIVIDA";
  } else if (text.match(/Empr[ée]stimo\s+Pessoal/i)) {
    resultado.tipoContrato = "EMPRESTIMO_PESSOAL";
  } else if (text.match(/Financiamento/i)) {
    resultado.tipoContrato = "FINANCIAMENTO";
  } else if (text.match(/Cart[aã]o\s+de\s+Cr[ée]dito/i)) {
    resultado.tipoContrato = "CARTAO_CREDITO";
  } else if (text.match(/Cheque\s+Especial/i)) {
    resultado.tipoContrato = "CHEQUE_ESPECIAL";
  }
  
  if (resultado.tipoContrato) camposExtraidos.push("tipoContrato");
  
  // ==================== CALCULAR CONFIANÇA ====================
  const totalCampos = camposExtraidos.length + camposNaoEncontrados.length;
  const percentualExtraido = camposExtraidos.length / totalCampos;
  
  if (percentualExtraido >= 0.6) {
    resultado.confianca = "ALTA";
  } else if (percentualExtraido >= 0.3) {
    resultado.confianca = "MEDIA";
  } else {
    resultado.confianca = "BAIXA";
  }
  
  return resultado;
}

/**
 * Verifica se a data do contrato é posterior a 30/04/2008 (vedação TAC).
 */
export function isContratoPosTAC(dataContrato: Date): boolean {
  return dataContrato >= new Date("2008-04-30");
}

/**
 * Calcula excesso de execução comparando valores.
 */
export function calcularExcessoExecucao(params: {
  valorCobrado: number;
  valorOriginal: number;
  taxaJurosMensal: number;
  mesesDesdeVencimento: number;
  taxaMulta?: number;
  taxaMora?: number;
}): {
  valorCalculado: number;
  excesso: number;
  percentualExcesso: number;
  temExcesso: boolean;
} {
  const { valorOriginal, taxaJurosMensal, mesesDesdeVencimento, valorCobrado, taxaMulta = 2, taxaMora = 1 } = params;
  
  // Cálculo simplificado (sem capitalização)
  const juros = valorOriginal * (taxaJurosMensal / 100) * mesesDesdeVencimento;
  const multa = valorOriginal * (taxaMulta / 100);
  const mora = valorOriginal * (taxaMora / 100) * mesesDesdeVencimento;
  
  const valorCalculado = valorOriginal + juros + multa + mora;
  const excesso = valorCobrado - valorCalculado;
  const percentualExcesso = (excesso / valorCalculado) * 100;
  
  return {
    valorCalculado: Math.round(valorCalculado * 100) / 100,
    excesso: Math.round(excesso * 100) / 100,
    percentualExcesso: Math.round(percentualExcesso * 100) / 100,
    temExcesso: excesso > 0 && percentualExcesso > 5, // Tolerância de 5%
  };
}
