import { DocumentContextSnapshot } from '@/types/institutional';

export const MOCK_DOCUMENT_CONTENT = `
  <h1>Petição de Acordo Extrajudicial</h1>
  <p>Pelo presente instrumento particular, as partes acima qualificadas resolvem, de livre e espontânea vontade, celebrar o presente acordo para por fim ao litígio referente ao contrato de prestação de serviços nº 882/2026.</p>
  
  <h2>1. Do Objeto do Acordo</h2>
  <p>O presente Termo tem por objetivo a composição amigável entre Credor e Devedor, visando a quitação integral do débito remanescente no valor histórico de R$ 15.400,00 (quinze mil e quatrocentos reais).</p>
  
  <h2>2. Das Condições de Pagamento</h2>
  <p>O Devedor compromete-se a efetuar o pagamento da importância de R$ 10.000,00 (dez mil reais), em parcela única, a ser depositada na conta bancária de titularidade do patrono do Credor em até 48 horas após a assinatura deste documento.</p>
  
  <p>Caso o pagamento não seja efetuado no prazo estipulado, o presente acordo será considerado rescindido de pleno direito, prosseguindo-se com as medidas executórias cabíveis sobre o valor total da dívida, acrescido de multa de 20% e honorários advocatícios.</p>

  <div class="page-break-avoid">
    <h2>3. Da Quitação</h2>
    <p>Com o efetivo pagamento do valor ora acordado, o Credor outorga ao Devedor a mais ampla, geral e irrevogável quitação de toda e qualquer obrigação decorrente do contrato mencionado, para nada mais reclamar em juízo ou fora dele, a qualquer título ou pretexto.</p>
  </div>
`;

export const BASE_MOCK_CONTEXT: DocumentContextSnapshot = {
  office: {
    name: 'Escritório Flaito Advocacia Premium',
    legalName: 'Flaito & Associados Sociedade de Advogados',
    cnpj: '12.345.678/0001-90',
    branding: {
      colors: {
        primary: '#1e293b',
        secondary: '#64748b',
        accent: '#3b82f6'
      },
      watermark: {
        enabled: true,
        opacity: 0.05,
        position: 'diagonal',
        size: 'md'
      },
      documentStyle: {
        legal: 'premium_elegant',
        medical: 'modern_executive'
      },
      logoPrimaryUrl: 'https://images.unsplash.com/photo-1593115057322-e94b77572f20?q=80&w=200&h=80&auto=format&fit=crop'
    }
  },
  unit: {
    id: 'unit-001',
    name: 'Sede Central Matriz São Paulo',
    unitType: 'ESCRITORIO',
    address: 'Av. Paulista, 1000 - 15º Andar, Conjunto 1502 - Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01310-100',
    phone: '(11) 3255-9000',
    email: 'contato@flaito.com.br'
  },
  professional: {
    name: 'Dr. Alexandre de Oliveira Magalhães',
    identType: 'OAB',
    identNumber: '123.456',
    identUf: 'SP',
    roleTitle: 'Sócio Fundador',
    signatures: [
      {
        role: 'Advogado Responsável',
        label: 'Signature',
        signatureUrl: 'https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?q=80&w=300&h=100&auto=format&fit=crop',
        stampUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=150&h=150&auto=format&fit=crop'
      }
    ]
  },
  templateMetadata: {
    id: 'premium_elegant',
    version: 1,
    resolvedAt: new Date().toISOString()
  },
  resolvedAt: new Date().toISOString(),
  version: '1.0.0'
};
