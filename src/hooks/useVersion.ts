import { LEXOS_VERSION, CHANGELOG, getVersionLabel, getLastUpdateDate, formatChangelogDate } from '@/lib/changelog';

/**
 * Hook para acessar informações de versão do sistema
 */
export function useVersion() {
  return {
    version: LEXOS_VERSION,
    label: getVersionLabel(),
    changelog: CHANGELOG,
    lastUpdate: getLastUpdateDate(),
    lastUpdateFormatted: formatChangelogDate(getLastUpdateDate()),
  };
}
