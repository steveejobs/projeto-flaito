/**
 * NIJA Logging Helper
 * Centraliza chamadas de log para o banco via RPC lexos_nija_log_event
 * NUNCA lança exceção - log não pode quebrar fluxo
 */

import { supabase } from "@/integrations/supabase/client";

export type NijaLogLevel = "INFO" | "WARN" | "ERROR";

export interface NijaLogParams {
  level: NijaLogLevel;
  source: string;
  action: string;
  officeId?: string | null;
  caseId?: string | null;
  sessionId?: string | null;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  error?: { message?: string; code?: string; details?: unknown } | null;
  durationMs?: number | null;
}

/**
 * Envia log para o banco via RPC.
 * Retorna o ID do log criado ou null se falhou (sem lançar exceção).
 */
export async function logNijaEvent(params: NijaLogParams): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("lexos_nija_log_event", {
      p_level: params.level,
      p_source: params.source,
      p_action: params.action,
      p_office_id: params.officeId || null,
      p_case_id: params.caseId || null,
      p_session_id: params.sessionId || null,
      p_payload: params.payload ? JSON.parse(JSON.stringify(params.payload)) : null,
      p_result: params.result ? JSON.parse(JSON.stringify(params.result)) : null,
      p_error: params.error ? JSON.parse(JSON.stringify(params.error)) : null,
      p_duration_ms: params.durationMs || null,
    });

    if (error) {
      // Log silencioso no console para debug
      console.warn("[NIJA Logger] Falha ao enviar log:", error.message);
      return null;
    }

    return data as string | null;
  } catch (err) {
    // NUNCA lançar exceção
    console.warn("[NIJA Logger] Erro inesperado:", err);
    return null;
  }
}

/**
 * Helper para criar timer de duração
 */
export function createNijaTimer(): { elapsed: () => number } {
  const start = performance.now();
  return {
    elapsed: () => Math.round(performance.now() - start),
  };
}

/**
 * Wrapper para log de início de operação
 */
export function logNijaStart(
  source: string,
  action: string,
  context: {
    officeId?: string | null;
    caseId?: string | null;
    sessionId?: string | null;
    payload?: Record<string, unknown>;
  }
): void {
  logNijaEvent({
    level: "INFO",
    source,
    action: `${action}_START`,
    officeId: context.officeId,
    caseId: context.caseId,
    sessionId: context.sessionId,
    payload: context.payload,
  });
}

/**
 * Wrapper para log de sucesso
 */
export function logNijaSuccess(
  source: string,
  action: string,
  context: {
    officeId?: string | null;
    caseId?: string | null;
    sessionId?: string | null;
    result?: Record<string, unknown>;
    durationMs?: number;
  }
): void {
  logNijaEvent({
    level: "INFO",
    source,
    action: `${action}_SUCCESS`,
    officeId: context.officeId,
    caseId: context.caseId,
    sessionId: context.sessionId,
    result: context.result,
    durationMs: context.durationMs,
  });
}

/**
 * Wrapper para log de erro
 */
export function logNijaError(
  source: string,
  action: string,
  err: unknown,
  context: {
    officeId?: string | null;
    caseId?: string | null;
    sessionId?: string | null;
    payload?: Record<string, unknown>;
    durationMs?: number;
  }
): void {
  // Serializar erro de forma robusta para evitar [object Object]
  let errorObj: { message: string; code?: string; details?: unknown };
  
  if (err instanceof Error) {
    errorObj = { 
      message: err.message, 
      code: (err as any).code,
      details: (err as any).details,
    };
  } else if (typeof err === "object" && err !== null) {
    // Objeto Supabase error ou similar
    const supaErr = err as { message?: string; code?: string; details?: unknown; hint?: string };
    errorObj = {
      message: supaErr.message || JSON.stringify(err),
      code: supaErr.code,
      details: supaErr.details || supaErr.hint,
    };
  } else {
    errorObj = { message: String(err) };
  }

  logNijaEvent({
    level: "ERROR",
    source,
    action: `${action}_ERROR`,
    officeId: context.officeId,
    caseId: context.caseId,
    sessionId: context.sessionId,
    payload: context.payload,
    error: errorObj,
    durationMs: context.durationMs,
  });
}
