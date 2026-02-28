/**
 * Constantes para tipos de precedentes jurídicos
 * Valores validados conforme enums do Supabase (types.ts)
 */

import type { Database } from '@/integrations/supabase/types';

// Tipos derivados do Supabase
export type PrecedentKind = Database['public']['Enums']['precedent_kind'];
export type PrecedentStatus = Database['public']['Enums']['precedent_status'];
export type PrecedentSourceKind = Database['public']['Enums']['precedent_source_kind'];

// Enum: precedent_kind (do Supabase) - VALORES EXATOS do banco
export const KIND_OPTIONS: { value: PrecedentKind; label: string }[] = [
  { value: 'SUMULA', label: 'Súmula' },
  { value: 'ACORDAO', label: 'Acórdão' },
  { value: 'JURISPRUDENCIA', label: 'Jurisprudência' },
  { value: 'TEMA_REPETITIVO', label: 'Tema Repetitivo' },
  { value: 'REPERcussAO_GERAL', label: 'Repercussão Geral' },
  { value: 'ORIENTACAO_JURISPRUDENCIAL', label: 'Orientação Jurisprudencial' },
  { value: 'TESE', label: 'Tese' },
  { value: 'INFORMATIVO', label: 'Informativo' },
  { value: 'OUTRO', label: 'Outro' },
];

// Enum: precedent_status (do Supabase)
export const STATUS_OPTIONS: { value: PrecedentStatus; label: string }[] = [
  { value: 'ATIVA', label: 'Ativa/Vigente' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'ALTERADA', label: 'Alterada' },
  { value: 'SUPERADA', label: 'Superada' },
  { value: 'DESCONHECIDO', label: 'Desconhecido' },
];

// Enum: precedent_source_kind (do Supabase)
export const SOURCE_KIND_OPTIONS: { value: PrecedentSourceKind; label: string }[] = [
  { value: 'OFICIAL', label: 'Oficial' },
  { value: 'SECUNDARIA', label: 'Secundária' },
];

// Tribunais comuns (não é enum, apenas lista de referência)
export const TRIBUNAIS_COMUNS = [
  'STF',
  'STJ',
  'TST',
  'TSE',
  'STM',
  'TJSP',
  'TJRJ',
  'TJMG',
  'TJRS',
  'TJPR',
  'TJSC',
  'TJBA',
  'TJPE',
  'TJCE',
  'TJGO',
  'TJDF',
  'TJTO',
  'TRF1',
  'TRF2',
  'TRF3',
  'TRF4',
  'TRF5',
  'TRF6',
] as const;

// Helper para obter label a partir do value
export function getKindLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return KIND_OPTIONS.find((k) => k.value === value)?.label ?? value;
}

export function getStatusLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

export function getSourceKindLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return SOURCE_KIND_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

// Mapeamento de termos normalizados para valores do enum
const KIND_MAPPING: Record<string, PrecedentKind> = {
  'SUMULA': 'SUMULA',
  'VINCULANTE': 'SUMULA',
  'ACORDAO': 'ACORDAO',
  'TEMA': 'TEMA_REPETITIVO',
  'REPETITIVO': 'TEMA_REPETITIVO',
  'TEMA_REPETITIVO': 'TEMA_REPETITIVO',
  'REPERCUSSAO': 'REPERcussAO_GERAL',
  'REPERCUSSAO_GERAL': 'REPERcussAO_GERAL',
  'REPERCUSSAOGERAL': 'REPERcussAO_GERAL',
  'REPERcussAO_GERAL': 'REPERcussAO_GERAL',
  'ORIENTACAO': 'ORIENTACAO_JURISPRUDENCIAL',
  'OJ': 'ORIENTACAO_JURISPRUDENCIAL',
  'ORIENTACAO_JURISPRUDENCIAL': 'ORIENTACAO_JURISPRUDENCIAL',
  'TESE': 'TESE',
  'INFORMATIVO': 'INFORMATIVO',
  'JURISPRUDENCIA': 'JURISPRUDENCIA',
  'OUTRO': 'OUTRO',
};

const STATUS_MAPPING: Record<string, PrecedentStatus> = {
  'ATIVA': 'ATIVA',
  'VIGENTE': 'ATIVA',
  'CANCELADA': 'CANCELADA',
  'ALTERADA': 'ALTERADA',
  'SUPERADA': 'SUPERADA',
  'DESCONHECIDO': 'DESCONHECIDO',
};

/**
 * Normaliza kind para valor válido do enum precedent_kind
 * Sempre retorna um valor válido do enum
 */
export function normalizeKind(raw: string | null | undefined): PrecedentKind {
  if (!raw) return 'OUTRO';
  
  // Remove acentos e converte para uppercase
  const normalized = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .trim();
  
  // Verificar mapeamento direto
  if (KIND_MAPPING[normalized]) {
    return KIND_MAPPING[normalized];
  }
  
  // Verificar se já é um valor válido do enum
  const validKind = KIND_OPTIONS.find((k) => k.value === raw);
  if (validKind) return validKind.value;
  
  // Tentar inferir por substring
  if (normalized.includes('SUMULA') || normalized.includes('VINCULANTE')) {
    return 'SUMULA';
  }
  if (normalized.includes('ACORDAO')) {
    return 'ACORDAO';
  }
  if (normalized.includes('TEMA') || normalized.includes('REPETITIVO')) {
    return 'TEMA_REPETITIVO';
  }
  if (normalized.includes('REPERCUSS')) {
    return 'REPERcussAO_GERAL';
  }
  if (normalized.includes('ORIENTACAO') || normalized === 'OJ') {
    return 'ORIENTACAO_JURISPRUDENCIAL';
  }
  if (normalized.includes('TESE')) {
    return 'TESE';
  }
  if (normalized.includes('INFORMATIVO')) {
    return 'INFORMATIVO';
  }
  if (normalized.includes('JURISPRUD')) {
    return 'JURISPRUDENCIA';
  }
  
  return 'OUTRO';
}

/**
 * Normaliza status para valor válido do enum precedent_status
 * Sempre retorna um valor válido do enum
 */
export function normalizeStatus(raw: string | null | undefined): PrecedentStatus {
  if (!raw) return 'DESCONHECIDO';
  
  // Remove acentos e converte para uppercase
  const normalized = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .trim();
  
  // Verificar mapeamento direto
  if (STATUS_MAPPING[normalized]) {
    return STATUS_MAPPING[normalized];
  }
  
  // Verificar se já é um valor válido do enum
  const validStatus = STATUS_OPTIONS.find((s) => s.value === raw);
  if (validStatus) return validStatus.value;
  
  // Tentar inferir por substring
  if (normalized.includes('ATIVA') || normalized.includes('VIGENTE')) {
    return 'ATIVA';
  }
  if (normalized.includes('CANCELADA')) {
    return 'CANCELADA';
  }
  if (normalized.includes('ALTERADA')) {
    return 'ALTERADA';
  }
  if (normalized.includes('SUPERADA')) {
    return 'SUPERADA';
  }
  
  return 'DESCONHECIDO';
}
