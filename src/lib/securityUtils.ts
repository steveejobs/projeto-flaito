// src/lib/securityUtils.ts
import { supabase } from '@/integrations/supabase/client';

// ==================== USER-FACING MESSAGES ====================
export const PERMISSION_ERROR_MSG =
  'Sem permissão para acessar este caso/documento.';
export const QUOTA_ERROR_MSG =
  'Limite do plano atingido. Fale com o administrador do escritório.';

// ==================== TYPES ====================
export type QuotaType = 'docs_gen' | 'ai_requests' | 'storage_mb';

export type SecurityResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export type QuotaConsumeOk = {
  ok: true;
  kind: string;
  limit?: number;
  used?: number;
};

export type QuotaConsumeFail = {
  ok: false;
  error?: string; // ex: quota_exceeded, kind_invalid...
  kind?: string;
  limit?: number;
  used?: number;
  requested?: number;
};

export type QuotaConsumeResult = QuotaConsumeOk | QuotaConsumeFail;

// ==================== HELPERS ====================
export function mbFromFile(file: File): number {
  return Math.max(1, Math.ceil(file.size / (1024 * 1024)));
}

function normalizeMsg(msg?: string) {
  return (msg || '').toLowerCase();
}

export function isPermissionError(err: unknown): boolean {
  const e = err as { message?: string; code?: string };
  const m = normalizeMsg(e?.message);
  const c = e?.code || '';
  return (
    m.includes('permission') ||
    m.includes('denied') ||
    m.includes('unauthorized') ||
    m.includes('rls') ||
    m.includes('row level security') ||
    m.includes('policy') ||
    c === '42501' || // insufficient_privilege
    c === 'PGRST301'
  );
}

export function isQuotaError(err: unknown): boolean {
  const e = err as { message?: string };
  const m = normalizeMsg(e?.message);
  return (
    m.includes('quota') ||
    m.includes('limit') ||
    m.includes('exceeded') ||
    m.includes('quota_exceeded')
  );
}

export function getSecurityErrorMessage(err: unknown): string {
  if (!err) return 'Erro ao processar solicitação.';
  if (isPermissionError(err)) return PERMISSION_ERROR_MSG;
  if (isQuotaError(err)) return QUOTA_ERROR_MSG;

  const e = err as { message?: string };
  return e?.message || 'Erro ao processar solicitação.';
}

// ==================== AUDITED DOCUMENT READ ====================
/**
 * Fetch a document via audited RPC (LGPD).
 * RPC exists in Supabase: lexos_get_document_audited(p_id uuid) returns jsonb
 * NO fallback (security posture).
 */
export async function getDocumentAudited<T extends Record<string, unknown>>(
  documentId: string
): Promise<SecurityResult<T>> {
  try {
    const { data, error } = await supabase.rpc('lexos_get_document_audited', {
      p_id: documentId,
    } as any);

    if (error) {
      return { ok: false, error: getSecurityErrorMessage(error), code: error.code };
    }

    if (!data) {
      return { ok: false, error: 'Documento não encontrado.' };
    }

    // data é jsonb (objeto)
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, error: getSecurityErrorMessage(err) };
  }
}

// ==================== QUOTA CONSUMPTION ====================
/**
 * Consume quota atomically before critical action.
 * RPC exists in Supabase: lexos_quota_consume(p_kind text, p_amount int) returns jsonb
 * Expected return shape includes { ok: boolean, error?: string, limit?, used?, ... }
 * NO fallback.
 */
export async function consumeQuota(
  quotaType: QuotaType,
  amount: number = 1
): Promise<QuotaConsumeResult> {
  try {
    const { data, error } = await supabase.rpc('lexos_quota_consume', {
      p_kind: quotaType,
      p_amount: amount,
    } as any);

    if (error) {
      if (isPermissionError(error)) return { ok: false, error: 'permission_denied' };
      if (isQuotaError(error)) return { ok: false, error: 'quota_exceeded' };
      return { ok: false, error: error.message || 'quota_error' };
    }

    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'invalid_quota_response' };
    }

    const result = data as Record<string, unknown>;

    if (result.ok === true) {
      return {
        ok: true,
        kind: String(result.kind ?? quotaType),
        limit: typeof result.limit === 'number' ? result.limit : undefined,
        used: typeof result.used === 'number' ? result.used : undefined,
      };
    }

    // ok === false
    return {
      ok: false,
      error: String(result.error ?? 'quota_exceeded'),
      kind: result.kind ? String(result.kind) : undefined,
      limit: typeof result.limit === 'number' ? result.limit : undefined,
      used: typeof result.used === 'number' ? result.used : undefined,
      requested: typeof result.requested === 'number' ? result.requested : undefined,
    };
  } catch (err) {
    if (isQuotaError(err)) return { ok: false, error: 'quota_exceeded' };
    if (isPermissionError(err)) return { ok: false, error: 'permission_denied' };
    return { ok: false, error: getSecurityErrorMessage(err) };
  }
}

// ==================== CASE STATE CHANGE ====================
export type CaseStateResult =
  | { ok: true; newState: string; message?: string }
  | { ok: false; error: string; code?: string };

/**
 * Change case state via FSM-controlled RPC.
 * RPC: lexos_set_case_state(p_case_id uuid, p_to_code text, p_note text) returns jsonb
 * NO direct update to cases.state_id allowed.
 */
export async function setCaseState(
  caseId: string,
  toCode: string,
  note: string = ''
): Promise<CaseStateResult> {
  try {
    const { data, error } = await supabase.rpc('lexos_set_case_state', {
      p_case_id: caseId,
      p_to_state_code: toCode,
      p_note: note,
    } as any);

    if (error) {
      return { ok: false, error: getSecurityErrorMessage(error), code: error.code };
    }

    if (!(data as any) || typeof data !== 'object') {
      return { ok: false, error: 'Resposta inválida do servidor.' };
    }

    const result = data as Record<string, unknown>;

    if (result.ok === true) {
      return {
        ok: true,
        newState: String(result.new_state ?? toCode),
        message: result.message ? String(result.message) : undefined,
      };
    }

    return {
      ok: false,
      error: String(result.error ?? 'Não foi possível alterar o estado do caso.'),
      code: result.code ? String(result.code) : undefined,
    };
  } catch (err) {
    return { ok: false, error: getSecurityErrorMessage(err) };
  }
}
