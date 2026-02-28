/**
 * RBAC - Role-Based Access Control
 * Tipos e utilitários para controle de acesso baseado em roles
 */

export type OfficeRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type OfficeModule = 'LEGAL' | 'MEDICAL';


export const ROLE_RANK: Record<OfficeRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * Verifica se o role do usuário atende ao requisito mínimo
 * @param userRole - Role atual do usuário (pode ser null/undefined)
 * @param minRole - Role mínimo necessário
 * @returns true se o usuário tem permissão
 */
export function hasRole(
  userRole: OfficeRole | null | undefined,
  minRole: OfficeRole
): boolean {
  const effectiveRole = userRole || 'MEMBER';
  return ROLE_RANK[effectiveRole] >= ROLE_RANK[minRole];
}

/**
 * Normaliza o role para UPPERCASE
 * @param role - Role em qualquer case
 * @returns Role normalizado em UPPERCASE
 */
export function normalizeRole(role: string | null | undefined): OfficeRole {
  if (!role) return 'MEMBER';
  const upper = role.toUpperCase();
  if (upper === 'OWNER' || upper === 'ADMIN' || upper === 'MEMBER') {
    return upper as OfficeRole;
  }
  return 'MEMBER';
}

/**
 * Normaliza o tipo de escritório para OfficeModule
 */
export function normalizeModule(type: string | null | undefined): OfficeModule {
  if (!type) return 'LEGAL'; // Default para Jurídico por retrocompatibilidade
  const lower = type.toLowerCase();
  if (lower.includes('medical') || lower.includes('medico') || lower.includes('clinica')) {
    return 'MEDICAL';
  }
  return 'LEGAL';
}
