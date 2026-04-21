// Versão JavaScript pura para validação imediata do motor de substituição
class TemplateEngine {
  static regex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

  static resolve(content, data) {
    if (!content) return "";
    return content.replace(this.regex, (match, path) => {
      const value = this.getValueByPath(data, path);
      if (value === undefined || value === null) return `[Pendente: ${path}]`;
      return this.formatValue(value, path);
    });
  }

  static getValueByPath(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  static formatValue(value, path) {
    if (value instanceof Date || (typeof value === 'string' && path.includes('date'))) {
      try { return new Date(value).toLocaleDateString('pt-BR'); } catch { return value; }
    }
    if (typeof value === 'number' && (path.includes('valor') || path.includes('price') || path.includes('honorarios'))) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
    return String(value);
  }

  static extractVariables(content) {
    const matches = content.matchAll(this.regex);
    const keys = new Set();
    for (const match of matches) { keys.add(match[1]); }
    return Array.from(keys);
  }
}

async function testEngine() {
  console.log('--- Iniciando Teste de Stress do Motor de Templates (JS Clean) ---');

  const template = `
    PROCURAÇÃO AD JUDICIA
    
    OUTORGANTE: {{client.full_name}}, CPF nº {{client.cpf}}, residente em {{client.address}}.
    OUTORGADO: {{office.name}}, através do advogado {{user.name}}, OAB {{user.oab}}.
    
    OBJETO: Propor ação judicial referente ao caso {{case.title}} (CNJ: {{case.cnj}}).
    HONORÁRIOS: Fica pactuado o valor de {{case.valor_honorarios}} a título de verba honorária.
    
    DATA: {{current_date}}
    ASSINATURA: _________________________________
    {{client.full_name}}
    
    VARIÁVEL INEXISTENTE: {{sistema.erro_teste}}
  `;

  const mockData = {
    client: { full_name: 'Francisco de Assis Silva', cpf: '123.456.789-00', address: 'Rua das Flores, 100, Palmas/TO' },
    office: { name: 'Silva & Associados Inteligência Jurídica' },
    user: { name: 'Dr. Roberto Cardoso', oab: 'TO/12345' },
    case: { title: 'Indenização por Danos Morais', cnj: '0012345-67.2026.8.27.0001', valor_honorarios: 3500.00 },
    current_date: '2026-04-20'
  };

  console.log('[AÇÃO] Processando substituições...');
  const result = TemplateEngine.resolve(template, mockData);

  console.log('\n--- RESULTADO FINAL GERADO ---');
  console.log(result);
  console.log('------------------------------\n');

  const hasName = result.includes('Francisco de Assis Silva');
  const hasCurrency = result.includes('R$ 3.500,00');
  const hasPending = result.includes('[Pendente: sistema.erro_teste]');

  if (hasName && hasCurrency && hasPending) {
    console.log('✅ COMPROVAÇÃO: O motor resolveu nomes, moedas e tratou pendências corretamente.');
  } else {
    console.error('❌ FALHA: Critérios de qualidade não atingidos.');
    process.exit(1);
  }

  const extracted = TemplateEngine.extractVariables(template);
  console.log(`[METADADOS] Variáveis identificadas: ${extracted.length}`);
  if (extracted.includes('client.full_name')) {
    console.log('✅ COMPROVAÇÃO: Extrator de metadados funcional.');
  }
}

testEngine();
