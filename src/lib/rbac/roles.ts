/**
 * RBAC - Role-Based Access Control
 * Camada de Frontend que consome o Contrato Centralizado
 */

import { 
  AppRole, 
  ROLE_RANK as CENTRAL_RANK, 
  isAtLeastRole as centralIsAtLeastRole,
  normalizeAppRole
} from "@shared/role-contract";

export type OfficeRole = AppRole;
export type OfficeModule = 'LEGAL' | 'MEDICAL';

/**
 * Re-exporta o ranking centralizado para componentes que precisam de pesos.
 * Agora usando 50, 80, 100.
 */
export const ROLE_RANK = CENTRAL_RANK;

/**
 * Verifica se o role do usuário atende ao requisito mínimo.
 * UX Gating: Apenas para controle visual. O enforcement real ocorre no backend.
 */
export function hasRole(
  userRole: AppRole,
  minRole: Exclude<AppRole, null>
): boolean {
  return centralIsAtLeastRole(userRole, minRole);
}

/**
 * Normaliza o role usando a lógica centralizada.
 * Retorna null se não houver um papel válido associado.
 */
export function normalizeRole(role: string | null | undefined): OfficeRole {
  return normalizeAppRole(role);
}

/**
 * Normaliza o tipo de escritório para OfficeModule (Layout/UX)
 */
export function normalizeModule(type: string | null | undefined): OfficeModule {
  if (!type) return 'LEGAL'; 
  const lower = type.toLowerCase();

  // Se o tipo for explicitamente híbrido ou contiver termos que indiquem ambos
  if (lower === 'ambos' || lower === 'mixed' || lower === 'hybrid' || lower === 'full' || lower === 'hibrido') {
    return 'LEGAL'; // Retornamos 'LEGAL' como base, mas o Guard permitirá ambos
  }

  // Inclui termos comuns para clínicas/médicos
  if (lower.includes('medical') || lower.includes('medico') || lower.includes('clinica') || lower.includes('health')) {
    return 'MEDICAL';
  }
  return 'LEGAL';
}
