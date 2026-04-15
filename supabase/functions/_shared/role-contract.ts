/**
 * RBAC - Role-Based Access Control (Contract)
 * Fonte Única de Verdade para Hierarquia e Permissões
 * 
 * Localização: supabase/functions/_shared/role-contract.ts
 */

export type AppRole = 'OWNER' | 'ADMIN' | 'MEMBER' | null;

/**
 * Pesos numéricos para comparação de hierarquia.
 * Alinhado com o padrão de segurança do backend.
 */
export const ROLE_RANK: Record<string, number> = {
  OWNER: 100,
  ADMIN: 80,
  MEMBER: 50,
};

/**
 * Obtém o peso numérico de uma role.
 * Role nula (sem office) tem peso 0.
 */
export function getRoleRank(role: AppRole): number {
  if (!role) return 0;
  // Normalização básica para evitar erros de case
  const normalized = role.toUpperCase();
  return ROLE_RANK[normalized] || 0;
}

/**
 * Verifica se a role do usuário atende ao requisito mínimo (Hierarquia).
 * Ex: isAtLeastRole('ADMIN', 'MEMBER') -> true
 */
export function isAtLeastRole(userRole: AppRole, minRole: Exclude<AppRole, null>): boolean {
  if (!userRole) return false;
  return getRoleRank(userRole) >= getRoleRank(minRole);
}

/**
 * Verifica se a role do usuário satisfaz uma das roles permitidas,
 * considerando a hierarquia descendente.
 */
export function hasRequiredRole(userRole: AppRole, requiredRoles: Exclude<AppRole, null>[]): boolean {
  if (!userRole) return false;
  const userLevel = getRoleRank(userRole);
  return requiredRoles.some(r => userLevel >= getRoleRank(r));
}

/**
 * Helper para normalização consistente de strings em AppRole.
 */
export function normalizeAppRole(role: string | null | undefined): AppRole {
  if (!role) return null;
  const upper = role.toUpperCase();
  if (upper === 'OWNER' || upper === 'ADMIN' || upper === 'MEMBER') {
    return upper as AppRole;
  }
  return null;
}
