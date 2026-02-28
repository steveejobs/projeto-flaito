// src/nija/analysis/prescricaoCalculator.ts
// NIJA SUPREMO – Calculador de Prescrição V1
// Tabela de prazos prescricionais e calculadora automática

export type TipoTitulo = 
  | "CONTRATO_BANCARIO"
  | "CHEQUE_CAMBIAL"
  | "CHEQUE_LOCUPLETAMENTO"
  | "DUPLICATA"
  | "NOTA_PROMISSORIA"
  | "CDA_TRIBUTARIA"
  | "CDA_NAO_TRIBUTARIA"
  | "SENTENCA_CIVIL"
  | "SENTENCA_TRABALHISTA"
  | "DANOS_MORAIS"
  | "RESPONSABILIDADE_CIVIL"
  | "COBRANCA_GERAL"
  | "SEGURO"
  | "ALUGUEL"
  | "OUTRO";

export interface PrazoPrescricao {
  tipo: TipoTitulo;
  prazoAnos: number;
  fundamentoLegal: string;
  observacao?: string;
}

export const PRAZOS_PRESCRICIONAIS: PrazoPrescricao[] = [
  // Contratos
  { tipo: "CONTRATO_BANCARIO", prazoAnos: 5, fundamentoLegal: "Art. 206, §5º, I, CC", observacao: "Dívida líquida constante de instrumento" },
  { tipo: "ALUGUEL", prazoAnos: 3, fundamentoLegal: "Art. 206, §3º, I, CC", observacao: "Aluguéis de prédios" },
  { tipo: "SEGURO", prazoAnos: 1, fundamentoLegal: "Art. 206, §1º, II, CC", observacao: "Pretensão do segurado contra segurador" },
  
  // Títulos de crédito - Ação cambial
  { tipo: "CHEQUE_CAMBIAL", prazoAnos: 0.5, fundamentoLegal: "Art. 59 Lei 7.357/85", observacao: "6 meses da apresentação para ação cambial" },
  { tipo: "CHEQUE_LOCUPLETAMENTO", prazoAnos: 2, fundamentoLegal: "Art. 61 Lei 7.357/85", observacao: "2 anos após prescrição da ação cambial" },
  { tipo: "DUPLICATA", prazoAnos: 3, fundamentoLegal: "Art. 18 Lei 5.474/68", observacao: "Contra sacado e avalistas" },
  { tipo: "NOTA_PROMISSORIA", prazoAnos: 3, fundamentoLegal: "Art. 70 Dec. 57.663/66 (LUG)", observacao: "Contra emitente e avalistas" },
  
  // CDAs
  { tipo: "CDA_TRIBUTARIA", prazoAnos: 5, fundamentoLegal: "Art. 174 CTN", observacao: "Após constituição definitiva do crédito" },
  { tipo: "CDA_NAO_TRIBUTARIA", prazoAnos: 5, fundamentoLegal: "Art. 206, §5º, I, CC", observacao: "Multas administrativas, taxas" },
  
  // Sentenças
  { tipo: "SENTENCA_CIVIL", prazoAnos: 10, fundamentoLegal: "Art. 205 CC", observacao: "Prazo geral após trânsito em julgado" },
  { tipo: "SENTENCA_TRABALHISTA", prazoAnos: 2, fundamentoLegal: "Art. 7º, XXIX, CF", observacao: "2 anos após extinção do contrato de trabalho" },
  
  // Responsabilidade civil
  { tipo: "DANOS_MORAIS", prazoAnos: 3, fundamentoLegal: "Art. 206, §3º, V, CC", observacao: "Pretensão de reparação civil" },
  { tipo: "RESPONSABILIDADE_CIVIL", prazoAnos: 3, fundamentoLegal: "Art. 206, §3º, V, CC", observacao: "Pretensão de reparação civil" },
  
  // Outros
  { tipo: "COBRANCA_GERAL", prazoAnos: 5, fundamentoLegal: "Art. 206, §5º, I, CC", observacao: "Dívida líquida" },
  { tipo: "OUTRO", prazoAnos: 10, fundamentoLegal: "Art. 205 CC", observacao: "Prazo geral subsidiário" },
];

export type StatusPrescricao = "NAO_PRESCRITO" | "PROXIMO_PRESCREVER" | "PRESCRITO" | "INTERCORRENTE";

export interface AnalisePrescricao {
  tipoTitulo: TipoTitulo;
  prazoAplicavel: number;
  fundamentoLegal: string;
  dataInicioContagem: Date;
  dataInterrupcao?: Date;
  dataLimite: Date;
  diasDecorridos: number;
  diasRestantes: number;
  status: StatusPrescricao;
  percentualDecorrido: number;
  alertas: string[];
}

/**
 * Calcula a prescrição de um título/pretensão.
 */
export function calcularPrescricao(params: {
  tipoTitulo: TipoTitulo;
  dataInicioContagem: Date;
  dataInterrupcao?: Date;
  dataAtual?: Date;
}): AnalisePrescricao {
  const { tipoTitulo, dataInicioContagem, dataInterrupcao, dataAtual = new Date() } = params;
  
  const prazoInfo = PRAZOS_PRESCRICIONAIS.find(p => p.tipo === tipoTitulo);
  if (!prazoInfo) {
    throw new Error(`Tipo de título não reconhecido: ${tipoTitulo}`);
  }
  
  const prazoMs = prazoInfo.prazoAnos * 365.25 * 24 * 60 * 60 * 1000;
  
  // Se houve interrupção, recomeça contagem a partir dela
  const dataBase = dataInterrupcao || dataInicioContagem;
  const dataLimite = new Date(dataBase.getTime() + prazoMs);
  
  const diasDecorridos = Math.floor((dataAtual.getTime() - dataBase.getTime()) / (24 * 60 * 60 * 1000));
  const diasRestantes = Math.floor((dataLimite.getTime() - dataAtual.getTime()) / (24 * 60 * 60 * 1000));
  const diasTotais = prazoInfo.prazoAnos * 365.25;
  const percentualDecorrido = Math.min(100, (diasDecorridos / diasTotais) * 100);
  
  let status: StatusPrescricao;
  const alertas: string[] = [];
  
  if (diasRestantes < 0) {
    status = "PRESCRITO";
    alertas.push(`⚠️ PRESCRIÇÃO CONSUMADA há ${Math.abs(diasRestantes)} dias`);
    alertas.push(`Fundamento: ${prazoInfo.fundamentoLegal}`);
  } else if (diasRestantes < 90) {
    status = "PROXIMO_PRESCREVER";
    alertas.push(`⚡ URGENTE: Prescreve em ${diasRestantes} dias`);
    alertas.push(`Data limite: ${dataLimite.toLocaleDateString("pt-BR")}`);
  } else if (diasRestantes < 180) {
    status = "PROXIMO_PRESCREVER";
    alertas.push(`🔶 ATENÇÃO: Prescreve em ${diasRestantes} dias (${Math.ceil(diasRestantes / 30)} meses)`);
  } else {
    status = "NAO_PRESCRITO";
    alertas.push(`✅ Prazo regular: ${Math.ceil(diasRestantes / 30)} meses restantes`);
  }
  
  if (dataInterrupcao) {
    alertas.push(`📌 Prazo interrompido em ${dataInterrupcao.toLocaleDateString("pt-BR")}`);
  }
  
  if (prazoInfo.observacao) {
    alertas.push(`ℹ️ ${prazoInfo.observacao}`);
  }
  
  return {
    tipoTitulo,
    prazoAplicavel: prazoInfo.prazoAnos,
    fundamentoLegal: prazoInfo.fundamentoLegal,
    dataInicioContagem,
    dataInterrupcao,
    dataLimite,
    diasDecorridos,
    diasRestantes,
    status,
    percentualDecorrido: Math.round(percentualDecorrido * 100) / 100,
    alertas,
  };
}

/**
 * Detecta tipo de título baseado em texto.
 */
export function inferirTipoTitulo(text: string): TipoTitulo {
  const textLower = text.toLowerCase();
  
  // Títulos de crédito específicos
  if (textLower.includes("cheque") || textLower.includes("chq")) {
    return "CHEQUE_CAMBIAL";
  }
  if (textLower.includes("duplicata") || textLower.includes("dup")) {
    return "DUPLICATA";
  }
  if (textLower.includes("nota promissória") || textLower.includes("n.p.") || textLower.includes("np ")) {
    return "NOTA_PROMISSORIA";
  }
  
  // CDAs
  if (textLower.includes("execução fiscal") || textLower.includes("cda")) {
    if (textLower.includes("icms") || textLower.includes("iptu") || textLower.includes("tribut")) {
      return "CDA_TRIBUTARIA";
    }
    return "CDA_NAO_TRIBUTARIA";
  }
  
  // Contratos bancários
  if (
    textLower.includes("contrato bancário") ||
    textLower.includes("cédula de crédito") ||
    textLower.includes("ccb") ||
    textLower.includes("empréstimo") ||
    textLower.includes("financiamento")
  ) {
    return "CONTRATO_BANCARIO";
  }
  
  // Sentenças
  if (textLower.includes("cumprimento de sentença") || textLower.includes("sentença")) {
    if (textLower.includes("trabalh")) {
      return "SENTENCA_TRABALHISTA";
    }
    return "SENTENCA_CIVIL";
  }
  
  // Danos
  if (textLower.includes("dano moral") || textLower.includes("danos morais")) {
    return "DANOS_MORAIS";
  }
  if (textLower.includes("indeniza") || textLower.includes("responsabilidade civil")) {
    return "RESPONSABILIDADE_CIVIL";
  }
  
  // Aluguel
  if (textLower.includes("aluguel") || textLower.includes("locação") || textLower.includes("locatício")) {
    return "ALUGUEL";
  }
  
  // Seguro
  if (textLower.includes("seguro") || textLower.includes("sinistro")) {
    return "SEGURO";
  }
  
  // Cobrança genérica
  if (textLower.includes("cobrança") || textLower.includes("dívida")) {
    return "COBRANCA_GERAL";
  }
  
  return "OUTRO";
}

/**
 * Calcula prescrição intercorrente.
 * Ocorre quando o processo fica paralisado por mais de 1 ano + prazo prescricional.
 */
export function calcularPrescricaoIntercorrente(params: {
  tipoTitulo: TipoTitulo;
  dataArquivamento: Date;
  dataAtual?: Date;
}): AnalisePrescricao & { suspensao1Ano: Date; fimSuspensao: Date } {
  const { tipoTitulo, dataArquivamento, dataAtual = new Date() } = params;
  
  // Art. 40 LEF: 1 ano de suspensão + prazo prescricional
  const suspensao1Ano = new Date(dataArquivamento.getTime() + 365 * 24 * 60 * 60 * 1000);
  
  const analise = calcularPrescricao({
    tipoTitulo,
    dataInicioContagem: suspensao1Ano,
    dataAtual,
  });
  
  if (analise.status === "PRESCRITO") {
    analise.alertas.unshift("⚠️ PRESCRIÇÃO INTERCORRENTE CONSUMADA");
    analise.alertas.push(`Arquivado em: ${dataArquivamento.toLocaleDateString("pt-BR")}`);
    analise.alertas.push(`1 ano de suspensão encerrou em: ${suspensao1Ano.toLocaleDateString("pt-BR")}`);
  }
  
  return {
    ...analise,
    status: analise.status === "PRESCRITO" ? "INTERCORRENTE" : analise.status,
    suspensao1Ano,
    fimSuspensao: suspensao1Ano,
  };
}
