/**
 * Interface unificada para metadados de auditoria (Trust Chain)
 * Alinhada com o contrato do agent-resolver no backend.
 */
export interface AIAuditMetadata {
  config_id: string;
  config_version: number;
  source_level: 'GLOBAL' | 'OFFICE' | 'STAGE' | 'FALLBACK';
  fallback_used: boolean;
  agent_slug: string;
}

/**
 * Wrapper para respostas de IA que podem conter metadados de auditoria
 */
export interface AIResponse<T> {
  data: T;
  _audit?: AIAuditMetadata;
}
