/**
 * shared/utils/brazilianUtils.ts
 * Utilitários para Normalização e Validação de Documentação Brasileira (Intake Hardening)
 */

/**
 * Normaliza e valida CPF
 * @param cpf String suja com o CPF
 * @returns { value: string | null, isValid: boolean }
 */
export function normalizeCPF(cpf: string): { value: string | null; isValid: boolean } {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return { value: clean, isValid: false };

  // Elimina CPFs conhecidos inválidos
  if (/^(\d)\1{10}$/.test(clean)) return { value: clean, isValid: false };

  // Validação do primeiro dígito
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return { value: clean, isValid: false };

  // Validação do segundo dígito
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return { value: clean, isValid: false };

  return { value: clean, isValid: true };
}

/**
 * Normaliza RG (Remove pontos e traços, mantém alfanumérico)
 */
export function normalizeRG(rg: string): string {
  return rg.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Normaliza CNH (Mínimo de 11 dígitos numéricos)
 */
export function normalizeCNH(cnh: string): string {
  return cnh.replace(/\D/g, '');
}

/**
 * Compara dois nomes de forma insensível a acentos, case e espaços extras
 */
export function compareNames(n1: string, n2: string): boolean {
  const normalize = (s: string) => 
    s.toLowerCase()
     .normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .replace(/\s+/g, ' ')
     .trim();
  
  return normalize(n1) === normalize(n2);
}

/**
 * Tenta parsear datas no formato brasileiro (DD/MM/YYYY) para ISO
 */
export function parseBrazilianDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Se já for ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;

  // Formato DD/MM/YYYY ou D/M/YY
  const parts = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (parts) {
    let day = parts[1].padStart(2, '0');
    let month = parts[2].padStart(2, '0');
    let year = parts[3];
    if (year.length === 2) year = '20' + year; // Assunção simples para séc XXI
    
    const iso = `${year}-${month}-${day}`;
    // Valida se a data é real
    const d = new Date(iso);
    return !isNaN(d.getTime()) ? iso : null;
  }

  return null;
}

/**
 * Calcula um "Deduplication Score" entre dois perfis de paciente
 */
export function calculateDedupScore(p1: any, p2: any): { score: number; criteria: any } {
  let score = 0;
  const criteria: any = {};

  // CPF é o sinal mais forte (1.0)
  if (p1.cpf && p2.cpf && normalizeCPF(p1.cpf).value === normalizeCPF(p2.cpf).value) {
    score = 1.0;
    criteria.cpf = 'exact_match';
    return { score, criteria };
  }

  // Nome Exato + Data Nascimento (0.9)
  if (compareNames(p1.nome || p1.full_name, p2.nome || p2.full_name)) {
    score += 0.5;
    criteria.name = 'exact_match';
  }

  if (p1.data_nascimento && p2.data_nascimento && p1.data_nascimento === p2.data_nascimento) {
    score += 0.4;
    criteria.birth_date = 'exact_match';
  }

  // Se tiver RG e UF iguais (0.8)
  if (p1.rg && p2.rg && normalizeRG(p1.rg) === normalizeRG(p2.rg) && p1.uf_documento === p2.uf_documento) {
    score = Math.max(score, 0.8);
    criteria.rg = 'exact_match_with_uf';
  }

  return { score: Math.min(score, 1.0), criteria };
}
