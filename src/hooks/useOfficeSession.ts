import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHECK_KEY = "lexos_office_checked";
const OFFICE_ID_KEY = "lexos_office_id";
const TRACE_KEY = "lexos_office_trace";

interface UseOfficeSessionResult {
  ready: boolean;
  loading: boolean;
  error: string | null;
  officeId: string | null;
  reset: () => void;
  retry: () => void;
}

// Helper outside hook - timeout wrapper
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);
    promise
      .then((v) => { clearTimeout(t); resolve(v); })
      .catch((e) => { clearTimeout(t); reject(e); });
  });
}

export function useOfficeSession(userId: string | null | undefined): UseOfficeSessionResult {
  const [ready, setReady] = useState(() => {
    try { return sessionStorage.getItem(CHECK_KEY) === "true"; } catch { return false; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(OFFICE_ID_KEY); } catch { return null; }
  });
  const inFlightRef = useRef(false);

  const reset = useCallback(() => {
    try { sessionStorage.removeItem(CHECK_KEY); } catch {}
    try { sessionStorage.removeItem(OFFICE_ID_KEY); } catch {}
    setReady(false);
    setLoading(false);
    setOfficeId(null);
    setError(null);
    inFlightRef.current = false;
  }, []);

  const retry = useCallback(() => {
    if (import.meta.env.DEV) {
      console.warn("[useOfficeSession] RETRY clicked");
    }
    try { sessionStorage.removeItem(CHECK_KEY); } catch {}
    try { sessionStorage.removeItem(OFFICE_ID_KEY); } catch {}
    setReady(false);
    setError(null);
    setOfficeId(null);
    inFlightRef.current = false;
  }, []);

  useEffect(() => {
    // DEV trace (nunca pode quebrar o fluxo)
    if (import.meta.env.DEV) {
      try {
        sessionStorage.setItem(TRACE_KEY, JSON.stringify({
          at: new Date().toISOString(),
          phase: "effect_enter",
          userId: userId ?? null,
          ready,
          loading,
          storageChecked: (() => { try { return sessionStorage.getItem(CHECK_KEY); } catch { return "ERR"; } })(),
          storageOfficeId: (() => { try { return sessionStorage.getItem(OFFICE_ID_KEY); } catch { return "ERR"; } })(),
        }));
      } catch {}
    }

    if (!userId) {
      setReady(false);
      setLoading(false);
      setError(null);
      setOfficeId(null);
      inFlightRef.current = false;
      try { sessionStorage.removeItem(OFFICE_ID_KEY); } catch {}
      try { sessionStorage.removeItem(CHECK_KEY); } catch {}
      return;
    }

    if (ready || inFlightRef.current) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    inFlightRef.current = true;
    setLoading(true);

    (async () => {
      let nextOfficeId: string | null = null;
      try {
        const rpcBuilder = supabase.rpc("lexos_healthcheck_session").maybeSingle();
        const rpcPromise = Promise.resolve(rpcBuilder);
        const result = await withTimeout(rpcPromise, 8000, "lexos_healthcheck_session");
        const { data, error: rpcError } = result as { data: any; error: any };
        
        if (!cancelled) {
          if (rpcError) setError("Erro ao verificar sessão do escritório");
          else setError(null);
        }
        
        nextOfficeId = (data as any)?.office_id ?? null;
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Falha ao inicializar sessão");
        nextOfficeId = null;
      } finally {
        // COMMIT e finalize SEMPRE (independente de cancelled)
        try {
          if (nextOfficeId) sessionStorage.setItem(OFFICE_ID_KEY, nextOfficeId);
          else sessionStorage.removeItem(OFFICE_ID_KEY);
        } catch {}
        try { sessionStorage.setItem(CHECK_KEY, "true"); } catch {}
        
        if (!cancelled) {
          setOfficeId(nextOfficeId);
          setReady(true);
          setLoading(false);
        }
        // mesmo cancelado, nunca deixe inFlight preso
        inFlightRef.current = false;
        
        if (import.meta.env.DEV) {
          try {
            sessionStorage.setItem(TRACE_KEY, JSON.stringify({
              at: new Date().toISOString(),
              phase: "finally_exit",
              storageChecked: (() => { try { return sessionStorage.getItem(CHECK_KEY); } catch { return "ERR"; } })(),
              storageOfficeId: (() => { try { return sessionStorage.getItem(OFFICE_ID_KEY); } catch { return "ERR"; } })(),
            }));
          } catch {}
        }
      }
    })();

    return () => { cancelled = true; };
  }, [userId, ready]);

  return { ready, loading, error, officeId, reset, retry };
}
