// src/hooks/useAthenaSuggestions.ts
// Gerencia sugestões proativas da Athena: carrega, prioriza e controla estado
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AthenaSuggestion {
  id: string;
  category: "agenda" | "legal" | "medical" | "document" | "alert" | "followup";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action_type: string | null;
  action_payload: Record<string, unknown>;
  entity_type: string | null;
  entity_id: string | null;
  expires_at: string;
  is_dismissed: boolean;
  is_executed: boolean;
}

interface UseAthenaSuggestionsOptions {
  enabled?: boolean;
  runScanOnMount?: boolean;
}

export function useAthenaSuggestions(options: UseAthenaSuggestionsOptions = {}) {
  const { enabled = true, runScanOnMount = true } = options;

  const [suggestions, setSuggestions] = useState<AthenaSuggestion[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState<string | null>(null); // suggestion id being executed
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const scannedRef = useRef(false);

  // Load active suggestions from DB (fast path — no scan)
  const loadSuggestions = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("assistant_suggestions")
        .select("*")
        .eq("is_dismissed", false)
        .eq("is_executed", false)
        .gt("expires_at", new Date().toISOString())
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) {
        setSuggestions(data as AthenaSuggestion[]);
      }
    } catch (e) {
      console.error("[useAthenaSuggestions] Load error:", e);
    }
  }, []);

  // Run proactive scan via Edge Function
  const runScan = useCallback(async () => {
    if (isScanning) return;
    try {
      setIsScanning(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("athena-proactive-scan", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!error && data?.suggestions) {
        // Prioritize: high > medium > low
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const sorted = [...data.suggestions].sort(
          (a: AthenaSuggestion, b: AthenaSuggestion) =>
            (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
        );
        setSuggestions(sorted.slice(0, 5));
        setLastScanAt(new Date());
      }
    } catch (e) {
      console.error("[useAthenaSuggestions] Scan error:", e);
      // Fallback: load from DB without scan
      await loadSuggestions();
    } finally {
      setIsScanning(false);
      scannedRef.current = true;
    }
  }, [isScanning, loadSuggestions]);

  // Dismiss suggestion (hide without executing)
  const dismiss = useCallback(async (suggestionId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));

    try {
      await supabase
        .from("assistant_suggestions")
        .update({ is_dismissed: true })
        .eq("id", suggestionId);
    } catch (e) {
      console.error("[useAthenaSuggestions] Dismiss error:", e);
    }
  }, []);

  // Execute suggestion action (requires user confirmation)
  const execute = useCallback(async (suggestion: AthenaSuggestion): Promise<{
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
    navigate_to?: string;
  }> => {
    if (!suggestion.action_type) return { success: false, error: "Sem ação definida." };

    setIsExecuting(suggestion.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: "Sessão expirada." };

      const { data, error } = await supabase.functions.invoke("athena-execute-action", {
        body: {
          action_type: suggestion.action_type,
          action_payload: suggestion.action_payload,
          suggestion_id: suggestion.id,
          confirmed: true, // User confirmed via UI
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || data?.error) {
        return { success: false, error: data?.error || error?.message };
      }

      // Mark executed in local state
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      return {
        success: true,
        result: data?.result,
        navigate_to: data?.result?.navigate_to as string | undefined,
      };

    } catch (e: any) {
      return { success: false, error: e?.message || "Erro ao executar ação." };
    } finally {
      setIsExecuting(null);
    }
  }, []);

  // Auto-scan on mount (once per session)
  useEffect(() => {
    if (!enabled || scannedRef.current) return;

    if (runScanOnMount) {
      runScan();
    } else {
      loadSuggestions();
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    suggestions,
    isScanning,
    isExecuting,
    lastScanAt,
    runScan,
    dismiss,
    execute,
    count: suggestions.length,
    hasHighPriority: suggestions.some((s) => s.priority === "high"),
  };
}
