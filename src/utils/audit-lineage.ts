import { AIAuditMetadata } from "../types/ai-audit";

/**
 * Utilitário para capturar e processar a linhagem de auditoria de uma resposta de IA.
 * 
 * @param response Qualquer resposta de IA que possa conter o campo _audit
 * @returns O objeto de auditoria se presente, ou null.
 */
export const captureLineage = (response: any): AIAuditMetadata | null => {
  if (response && response._audit) {
    const audit = response._audit as AIAuditMetadata;
    
    // Logging padronizado para depuração técnica em ambientes permitidos
    // Este log não deve aparecer em produção para usuários finais
    if (import.meta.env.DEV || window.localStorage.getItem('FLAITO_DEBUG') === 'true') {
      console.debug(`[TrustChain] Agent: ${audit.agent_slug} | Config: ${audit.config_id} v${audit.config_version} | Source: ${audit.source_level} ${audit.fallback_used ? '(FALLBACK ACTIVE)' : ''}`);
    }

    return audit;
  }
  
  return null;
};
