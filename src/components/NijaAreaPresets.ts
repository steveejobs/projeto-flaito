// NIJA - Presets por Área do Direito
// Ajustes automáticos: natureza pretensão/direito, marcos iniciais, alertas típicos

export interface AreaPreset {
  value: string;
  label: string;
  naturezaPrescricao: { value: string; label: string }[];
  naturezaDecadencia: { value: string; label: string }[];
  marcosIniciais: { label: string; descricao: string }[];
  alertas: string[];
  checklistTags: string[];
}

export const AREA_PRESETS: AreaPreset[] = [
  {
    value: 'civel',
    label: 'Cível Geral',
    naturezaPrescricao: [
      { value: 'indenizacao_danos_morais', label: 'Indenização por Danos Morais (3 anos)' },
      { value: 'indenizacao_danos_materiais', label: 'Indenização por Danos Materiais (3 anos)' },
      { value: 'responsabilidade_civil', label: 'Responsabilidade Civil Extracontratual (3 anos)' },
      { value: 'cobranca_divida', label: 'Cobrança de Dívida Líquida (5 anos)' },
      { value: 'contrato_escrito', label: 'Pretensão Contratual - Contrato Escrito (10 anos)' },
      { value: 'contrato_verbal', label: 'Pretensão Contratual - Contrato Verbal (10 anos)' },
      { value: 'enriquecimento_sem_causa', label: 'Enriquecimento Sem Causa (3 anos)' },
      { value: 'repeticao_indebito', label: 'Repetição de Indébito (10 anos)' },
    ],
    naturezaDecadencia: [
      { value: 'anulacao_negocio', label: 'Anulação de Negócio Jurídico (4 anos)' },
      { value: 'redibicao_vicio', label: 'Ação Redibitória - Vício Redibitório (30/180 dias)' },
      { value: 'abatimento_preco', label: 'Abatimento de Preço - Vício Redibitório (1 ano)' },
      { value: 'direito_preferencia', label: 'Direito de Preferência (180 dias)' },
      { value: 'revogacao_doacao', label: 'Revogação de Doação por Ingratidão (1 ano)' },
    ],
    marcosIniciais: [
      { label: 'Data do evento danoso', descricao: 'Quando ocorreu o fato gerador do dano' },
      { label: 'Ciência inequívoca do dano', descricao: 'Quando a parte tomou conhecimento do prejuízo (actio nata)' },
      { label: 'Vencimento da obrigação', descricao: 'Data do inadimplemento contratual' },
      { label: 'Trânsito em julgado', descricao: 'Data do trânsito em julgado de decisão' },
    ],
    alertas: [
      '⚠️ CC vs CDC: Verificar se relação é de consumo (prazo CDC pode ser mais favorável)',
      '⚠️ Teoria da actio nata: Prazo inicia da ciência inequívoca, não necessariamente do fato',
      '⚠️ Art. 200 CC: Prescrição não corre enquanto pender ação penal sobre mesmo fato',
    ],
    checklistTags: ['civel', 'contrato', 'responsabilidade'],
  },
  {
    value: 'consumidor',
    label: 'Direito do Consumidor',
    naturezaPrescricao: [
      { value: 'consumidor_fato', label: 'Fato do Produto/Serviço - CDC Art. 27 (5 anos)' },
      { value: 'repeticao_indebito_consumidor', label: 'Repetição de Indébito Consumerista (10 anos)' },
      { value: 'indenizacao_consumidor', label: 'Indenização por Danos ao Consumidor (5 anos)' },
    ],
    naturezaDecadencia: [
      { value: 'consumidor_vicio_aparente', label: 'Vício Aparente - Não Durável (30 dias)' },
      { value: 'consumidor_vicio_duravel', label: 'Vício Aparente - Durável (90 dias)' },
      { value: 'consumidor_vicio_oculto', label: 'Vício Oculto (30/90 dias após ciência)' },
    ],
    marcosIniciais: [
      { label: 'Data da aquisição', descricao: 'Quando o produto/serviço foi adquirido' },
      { label: 'Entrega efetiva', descricao: 'Data da entrega do produto ao consumidor' },
      { label: 'Ciência do vício', descricao: 'Quando o consumidor tomou conhecimento do defeito' },
      { label: 'Término do reparo', descricao: 'Após expirar prazo de 30 dias para reparo' },
      { label: 'Negativa do fornecedor', descricao: 'Recusa em solucionar o problema' },
    ],
    alertas: [
      '⚠️ CDC x CC: Fato do produto/serviço = 5 anos (CDC 27). Vício = decadência (CDC 26)',
      '⚠️ Obstação do prazo: Reclamação comprovada ao fornecedor OBSTA a decadência (CDC 26 §2º)',
      '⚠️ Vício oculto: Prazo inicia da ciência, não da aquisição',
      '⚠️ Responsabilidade solidária: Todos os fornecedores da cadeia respondem',
    ],
    checklistTags: ['consumidor', 'cdc', 'produto', 'servico'],
  },
  {
    value: 'trabalhista',
    label: 'Trabalhista',
    naturezaPrescricao: [
      { value: 'trabalhista_geral', label: 'Créditos Trabalhistas (2 anos após rescisão, últimos 5 anos)' },
      { value: 'trabalhista_fgts', label: 'FGTS (5 anos durante contrato, 2 após rescisão)' },
      { value: 'trabalhista_acidente', label: 'Indenização por Acidente de Trabalho (5 anos)' },
      { value: 'trabalhista_danos_morais', label: 'Danos Morais Trabalhistas (5 anos)' },
    ],
    naturezaDecadencia: [
      { value: 'trabalhista_habeas_data', label: 'Habeas Data - Retificação de Dados (prazo especial)' },
    ],
    marcosIniciais: [
      { label: 'Data da rescisão', descricao: 'Término do contrato de trabalho' },
      { label: 'Data do acidente', descricao: 'Quando ocorreu o infortúnio laboral' },
      { label: 'Consolidação das lesões', descricao: 'Estabilização do quadro de saúde' },
      { label: 'Ciência da doença ocupacional', descricao: 'Diagnóstico de doença relacionada ao trabalho' },
    ],
    alertas: [
      '⚠️ Prescrição bienal: Ação deve ser ajuizada em 2 anos da rescisão',
      '⚠️ Prescrição quinquenal: Só alcança verbas dos últimos 5 anos',
      '⚠️ Contrato vigente: Prescrição quinquenal corre normalmente durante o contrato',
      '⚠️ Menores de 18: Prescrição não corre contra menores (art. 440 CLT)',
    ],
    checklistTags: ['trabalhista', 'clt', 'rescisao'],
  },
  {
    value: 'tributario',
    label: 'Tributário',
    naturezaPrescricao: [
      { value: 'restituicao_tributaria_prescricao', label: 'Ação Anulatória de Débito (5 anos)' },
      { value: 'repeticao_tributo', label: 'Repetição de Indébito Tributário (5 anos)' },
      { value: 'execucao_fiscal', label: 'Execução Fiscal - Prescrição Intercorrente (5 anos)' },
    ],
    naturezaDecadencia: [
      { value: 'restituicao_tributaria', label: 'Restituição Tributária - CTN Art. 168 (5 anos)' },
      { value: 'lancamento_tributario', label: 'Lançamento de Ofício - CTN Art. 173 (5 anos)' },
      { value: 'lancamento_homologacao', label: 'Lançamento por Homologação - CTN Art. 150 (5+5 anos)' },
    ],
    marcosIniciais: [
      { label: 'Fato gerador', descricao: 'Data da ocorrência do fato gerador do tributo' },
      { label: 'Pagamento indevido', descricao: 'Data do recolhimento a maior ou indevido' },
      { label: 'Decisão administrativa definitiva', descricao: 'Trânsito em julgado administrativo' },
      { label: 'Decisão judicial definitiva', descricao: 'Trânsito em julgado declarando inconstitucionalidade' },
      { label: 'Constituição definitiva do crédito', descricao: 'Notificação do lançamento ou vencimento' },
    ],
    alertas: [
      '⚠️ CTN Art. 168: Decadência para pleitear restituição = 5 anos do pagamento indevido',
      '⚠️ CTN Art. 173: Decadência para lançamento = 5 anos do primeiro dia do exercício seguinte',
      '⚠️ CTN Art. 150 §4º: Homologação tácita = 5 anos do fato gerador',
      '⚠️ Tese do 5+5: Pagamento antecipado sem homologação expressa permite contagem diferenciada',
      '⚠️ LC 118/05: Atenção à data dos fatos (antes ou depois de 09/06/2005)',
    ],
    checklistTags: ['tributario', 'ctn', 'fiscal'],
  },
  {
    value: 'bancario',
    label: 'Bancário',
    naturezaPrescricao: [
      { value: 'repeticao_bancario', label: 'Repetição de Indébito Bancário (10 anos)' },
      { value: 'revisao_contratual', label: 'Revisão Contratual Bancária (10 anos)' },
      { value: 'cobranca_bancaria', label: 'Cobrança de Dívida Bancária (5 anos)' },
      { value: 'danos_bancarios', label: 'Danos Morais - Negativação Indevida (3 anos)' },
      { value: 'expurgos_poupanca', label: 'Expurgos Inflacionários de Poupança (5 anos do trânsito)' },
    ],
    naturezaDecadencia: [
      { value: 'vicio_servico_bancario', label: 'Vício no Serviço Bancário - CDC (90 dias)' },
    ],
    marcosIniciais: [
      { label: 'Data de cada cobrança', descricao: 'Cada parcela inicia novo prazo' },
      { label: 'Término do contrato', descricao: 'Quitação ou encerramento da relação' },
      { label: 'Negativação indevida', descricao: 'Data da inscrição nos cadastros restritivos' },
      { label: 'Ciência do débito', descricao: 'Conhecimento das cobranças indevidas' },
      { label: 'Última parcela paga', descricao: 'Término dos pagamentos no financiamento' },
    ],
    alertas: [
      '⚠️ Trato sucessivo: Cada cobrança indevida inicia novo prazo (relação continuada)',
      '⚠️ Repetição em dobro: CDC art. 42 - cobrança indevida = devolução em dobro',
      '⚠️ STJ Tema 1.085: Repetição do indébito bancário = prescrição decenal',
      '⚠️ Capitalização: Verificar legalidade da capitalização de juros',
      '⚠️ Súmula 381 STJ: Juiz não pode reconhecer abusividade de ofício',
    ],
    checklistTags: ['bancario', 'financeiro', 'repeticao'],
  },
  {
    value: 'familia',
    label: 'Família e Sucessões',
    naturezaPrescricao: [
      { value: 'alimentos_vencidos', label: 'Alimentos - Prestações Vencidas (2 anos)' },
      { value: 'alimentos_execucao', label: 'Execução de Alimentos (2 anos cada parcela)' },
      { value: 'peticao_heranca', label: 'Petição de Herança (10 anos)' },
      { value: 'nulidade_partilha', label: 'Anulação de Partilha (1 ano)' },
    ],
    naturezaDecadencia: [
      { value: 'anulacao_casamento', label: 'Anulação de Casamento (180 dias)' },
      { value: 'investigacao_paternidade', label: 'Investigação de Paternidade (imprescritível)' },
      { value: 'negatoria_paternidade', label: 'Negatória de Paternidade (4 anos - menor prazo)' },
    ],
    marcosIniciais: [
      { label: 'Vencimento de cada parcela', descricao: 'Data do vencimento de cada prestação alimentícia' },
      { label: 'Abertura da sucessão', descricao: 'Data do óbito do de cujus' },
      { label: 'Ciência da partilha', descricao: 'Conhecimento do ato de partilha' },
      { label: 'Casamento', descricao: 'Data da celebração do casamento' },
      { label: 'Ciência do vício de vontade', descricao: 'Conhecimento de erro, dolo ou coação' },
    ],
    alertas: [
      '⚠️ Alimentos: Prescrição de 2 anos corre para cada parcela individualmente',
      '⚠️ Investigação de paternidade: IMPRESCRITÍVEL quanto ao estado de filiação',
      '⚠️ Art. 197 CC: Prescrição não corre entre cônjuges na constância do casamento',
      '⚠️ Art. 198 CC: Prescrição não corre contra incapazes',
      '⚠️ Partilha: Prazo de 1 ano da ciência para anular',
    ],
    checklistTags: ['familia', 'alimentos', 'sucessoes'],
  },
  {
    value: 'imobiliario',
    label: 'Imobiliário',
    naturezaPrescricao: [
      { value: 'locacao', label: 'Locação - Aluguéis e Acessórios (3 anos)' },
      { value: 'cobranca_condominio', label: 'Cobrança de Cotas Condominiais (5 anos)' },
      { value: 'vicio_construcao', label: 'Vícios de Construção - CC Art. 618 (10 anos após garantia)' },
      { value: 'usucapiao', label: 'Usucapião (não há prescrição - aquisição originária)' },
    ],
    naturezaDecadencia: [
      { value: 'garantia_empreitada', label: 'Garantia de Empreitada - CC Art. 618 (180 dias)' },
      { value: 'direito_preferencia_locacao', label: 'Direito de Preferência na Locação (6 meses)' },
    ],
    marcosIniciais: [
      { label: 'Vencimento de cada aluguel', descricao: 'Data de vencimento de cada parcela locatícia' },
      { label: 'Entrega das chaves', descricao: 'Devolução do imóvel ao locador' },
      { label: 'Término da obra', descricao: 'Conclusão da construção (habite-se)' },
      { label: 'Aparecimento do vício', descricao: 'Surgimento do defeito construtivo' },
      { label: 'Ciência da venda', descricao: 'Conhecimento da alienação do imóvel locado' },
    ],
    alertas: [
      '⚠️ Art. 618 CC: Garantia de 5 anos + prazo de 180 dias para reclamar do vício',
      '⚠️ Condomínio: Contribuições condominiais têm prescrição quinquenal',
      '⚠️ Locação comercial: Atenção ao direito de renovação (Lei do Inquilinato)',
      '⚠️ Preferência: Locatário tem 6 meses para anular venda sem observância',
    ],
    checklistTags: ['imobiliario', 'locacao', 'construcao'],
  },
  {
    value: 'seguro',
    label: 'Securitário',
    naturezaPrescricao: [
      { value: 'seguro_segurado', label: 'Pretensão do Segurado contra Seguradora (1 ano)' },
      { value: 'seguro_terceiro', label: 'Pretensão de Terceiro contra Segurado (3 anos)' },
      { value: 'seguro_regresso', label: 'Ação de Regresso da Seguradora (3 anos)' },
    ],
    naturezaDecadencia: [
      { value: 'seguro_vicio', label: 'Vício no Serviço de Seguro - CDC (90 dias)' },
    ],
    marcosIniciais: [
      { label: 'Data do sinistro', descricao: 'Quando ocorreu o evento coberto' },
      { label: 'Ciência inequívoca do sinistro', descricao: 'Conhecimento efetivo do segurado' },
      { label: 'Negativa de cobertura', descricao: 'Recusa formal da seguradora' },
      { label: 'Trânsito em julgado', descricao: 'Decisão definitiva em ação de terceiro' },
    ],
    alertas: [
      '⚠️ Art. 206 §1º CC: Prazo de 1 ano para segurado = contado do sinistro ou ciência',
      '⚠️ Súmula 101 STJ: Ação de seguro de vida pode ser proposta pelo beneficiário',
      '⚠️ Regulação do sinistro: Prazo suspenso durante análise pela seguradora',
      '⚠️ DPVAT: Prazo de 3 anos (Súmula 405 STJ)',
    ],
    checklistTags: ['seguro', 'sinistro', 'segurado'],
  },
  {
    value: 'outro',
    label: 'Outro / Não Especificado',
    naturezaPrescricao: [
      { value: 'indenizacao_danos_morais', label: 'Indenização por Danos Morais (3 anos)' },
      { value: 'indenizacao_danos_materiais', label: 'Indenização por Danos Materiais (3 anos)' },
      { value: 'cobranca_divida', label: 'Cobrança de Dívida Líquida (5 anos)' },
      { value: 'contrato_escrito', label: 'Pretensão Contratual (10 anos)' },
      { value: 'responsabilidade_civil', label: 'Responsabilidade Civil (3 anos)' },
      { value: 'enriquecimento_sem_causa', label: 'Enriquecimento Sem Causa (3 anos)' },
      { value: 'repeticao_indebito', label: 'Repetição de Indébito (10 anos)' },
    ],
    naturezaDecadencia: [
      { value: 'anulacao_negocio', label: 'Anulação de Negócio Jurídico (4 anos)' },
      { value: 'redibicao_vicio', label: 'Ação Redibitória (30/180 dias)' },
      { value: 'revogacao_doacao', label: 'Revogação de Doação (1 ano)' },
    ],
    marcosIniciais: [
      { label: 'Data do evento', descricao: 'Quando ocorreu o fato relevante' },
      { label: 'Ciência do fato', descricao: 'Conhecimento inequívoco da situação' },
      { label: 'Vencimento da obrigação', descricao: 'Data do inadimplemento' },
    ],
    alertas: [
      '⚠️ Verifique qual legislação especial pode se aplicar ao caso',
      '⚠️ Atente para causas suspensivas e interruptivas específicas',
    ],
    checklistTags: ['geral'],
  },
];

// Map case.area values to preset values
export function mapCaseAreaToPreset(caseArea: string | null | undefined): string {
  if (!caseArea) return 'outro';
  
  const areaLower = caseArea.toLowerCase().trim();
  
  // Direct matches
  const directMappings: Record<string, string> = {
    'cível': 'civel',
    'civel': 'civel',
    'civil': 'civel',
    'consumidor': 'consumidor',
    'consumerista': 'consumidor',
    'cdc': 'consumidor',
    'trabalhista': 'trabalhista',
    'trabalho': 'trabalhista',
    'tributário': 'tributario',
    'tributario': 'tributario',
    'fiscal': 'tributario',
    'bancário': 'bancario',
    'bancario': 'bancario',
    'financeiro': 'bancario',
    'família': 'familia',
    'familia': 'familia',
    'sucessões': 'familia',
    'sucessoes': 'familia',
    'imobiliário': 'imobiliario',
    'imobiliario': 'imobiliario',
    'locação': 'imobiliario',
    'locacao': 'imobiliario',
    'securitário': 'seguro',
    'securitario': 'seguro',
    'seguro': 'seguro',
    'seguros': 'seguro',
  };

  if (directMappings[areaLower]) {
    return directMappings[areaLower];
  }

  // Partial matches
  if (areaLower.includes('consumidor') || areaLower.includes('cdc')) return 'consumidor';
  if (areaLower.includes('trabalh') || areaLower.includes('clt')) return 'trabalhista';
  if (areaLower.includes('tribut') || areaLower.includes('fiscal')) return 'tributario';
  if (areaLower.includes('banc') || areaLower.includes('financ')) return 'bancario';
  if (areaLower.includes('famíl') || areaLower.includes('famil') || areaLower.includes('alimento') || areaLower.includes('sucess')) return 'familia';
  if (areaLower.includes('imobil') || areaLower.includes('locaç') || areaLower.includes('locac')) return 'imobiliario';
  if (areaLower.includes('seguro') || areaLower.includes('sinistro')) return 'seguro';
  if (areaLower.includes('cível') || areaLower.includes('civel') || areaLower.includes('civil')) return 'civel';

  return 'outro';
}

export function getPresetByValue(value: string): AreaPreset | undefined {
  return AREA_PRESETS.find(p => p.value === value);
}
