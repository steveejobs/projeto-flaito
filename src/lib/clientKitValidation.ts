/**
 * Validação de dados obrigatórios do cliente antes de gerar Kit de documentos
 */

export interface ClientData {
  id: string;
  person_type: 'PF' | 'PJ';
  full_name: string | null;
  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  rg_issuer: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  nationality: string | null;
  marital_status: string | null;
  profession: string | null;
  representative_name: string | null;
  representative_cpf: string | null;
  representative_rg: string | null;
  representative_nationality: string | null;
  representative_marital_status: string | null;
  representative_profession: string | null;
}

export interface ValidationField {
  field: keyof ClientData;
  label: string;
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: ValidationField[];
}

// Campos obrigatórios para Pessoa Física
const REQUIRED_PF_FIELDS: ValidationField[] = [
  { field: 'full_name', label: 'Nome completo' },
  { field: 'cpf', label: 'CPF' },
  { field: 'rg', label: 'RG' },
  { field: 'rg_issuer', label: 'Órgão emissor do RG' },
  { field: 'address_line', label: 'Endereço' },
  { field: 'city', label: 'Cidade' },
  { field: 'state', label: 'Estado' },
  { field: 'nationality', label: 'Nacionalidade' },
  { field: 'marital_status', label: 'Estado civil' },
  { field: 'profession', label: 'Profissão' },
];

// Campos obrigatórios para Pessoa Jurídica
const REQUIRED_PJ_FIELDS: ValidationField[] = [
  { field: 'full_name', label: 'Razão Social' },
  { field: 'cnpj', label: 'CNPJ' },
  { field: 'address_line', label: 'Endereço da sede' },
  { field: 'city', label: 'Cidade' },
  { field: 'state', label: 'Estado' },
  { field: 'representative_name', label: 'Nome do representante legal' },
  { field: 'representative_cpf', label: 'CPF do representante' },
  { field: 'representative_rg', label: 'RG do representante' },
  { field: 'representative_nationality', label: 'Nacionalidade do representante' },
  { field: 'representative_marital_status', label: 'Estado civil do representante' },
  { field: 'representative_profession', label: 'Profissão do representante' },
];

/**
 * Valida se o cliente possui todos os campos obrigatórios preenchidos
 * para gerar documentos jurídicos válidos (Procuração, Declaração, Contrato)
 */
export function validateClientForKit(client: ClientData): ValidationResult {
  const isPJ = client.person_type === 'PJ' || !!client.cnpj;
  const requiredFields = isPJ ? REQUIRED_PJ_FIELDS : REQUIRED_PF_FIELDS;
  
  const missingFields: ValidationField[] = [];
  
  for (const { field, label } of requiredFields) {
    const value = client[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push({ field, label });
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Retorna apenas os campos obrigatórios baseado no tipo de pessoa
 */
export function getRequiredFields(personType: 'PF' | 'PJ'): ValidationField[] {
  return personType === 'PJ' ? REQUIRED_PJ_FIELDS : REQUIRED_PF_FIELDS;
}

// Campos obrigatórios mínimos para Recibo de Pagamento
const REQUIRED_RECIBO_FIELDS: ValidationField[] = [
  { field: 'full_name', label: 'Nome completo' },
  { field: 'cpf', label: 'CPF' },
];

/**
 * Validação simplificada para geração de Recibo de Pagamento
 * Requer apenas nome e CPF do cliente
 */
export function validateClientForRecibo(client: ClientData): ValidationResult {
  const missingFields: ValidationField[] = [];
  
  for (const { field, label } of REQUIRED_RECIBO_FIELDS) {
    const value = client[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push({ field, label });
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}
