/**
 * Sistema de versionamento e changelog do Lexos
 * 
 * INSTRUÇÕES DE USO:
 * 1. Toda alteração significativa deve ser registrada aqui
 * 2. Atualize LEXOS_VERSION seguindo semantic versioning (MAJOR.MINOR.PATCH)
 * 3. Adicione uma nova entrada no início do array CHANGELOG
 * 
 * Tipos de mudança:
 * - feature: Nova funcionalidade
 * - fix: Correção de bug
 * - improvement: Melhoria em funcionalidade existente
 * - breaking: Mudança que pode afetar comportamento anterior
 */

export interface ChangelogChange {
  type: 'feature' | 'fix' | 'improvement' | 'breaking';
  description: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: ChangelogChange[];
}

// Versão atual do sistema
export const LEXOS_VERSION = "1.0.0";

// Histórico de modificações (mais recente primeiro)
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-01-11",
    title: "Lançamento Inicial",
    changes: [
      { type: "feature", description: "Sistema de gestão jurídica multi-escritório" },
      { type: "feature", description: "Módulo NIJA com 20 detectores heurísticos de vícios processuais" },
      { type: "feature", description: "Extração automática de processos EPROC e TJTO" },
      { type: "feature", description: "Sistema de auditoria e governança" },
      { type: "feature", description: "Assistente de IA contextual (Lexos Chat)" },
      { type: "feature", description: "Gestão de clientes com kit documental" },
      { type: "feature", description: "Controle de prazos e agenda integrada" },
      { type: "feature", description: "Integração com Plaud para transcrição de áudio" },
      { type: "feature", description: "Geração automática de petições e documentos" },
      { type: "feature", description: "Sistema de versionamento com changelog" },
    ],
  },
];

/**
 * Retorna a versão formatada (ex: "v1.0.0")
 */
export function getVersionLabel(): string {
  return `v${LEXOS_VERSION}`;
}

/**
 * Retorna a data da última atualização
 */
export function getLastUpdateDate(): string {
  return CHANGELOG[0]?.date || "N/A";
}

/**
 * Retorna a data formatada em português
 */
export function formatChangelogDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}
