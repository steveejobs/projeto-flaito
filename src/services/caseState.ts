/**
 * Centralized service for FSM-based case state management.
 * All state reads and transitions go through this service.
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============ Types ============

export interface CaseState {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
  is_active: boolean;
}

export interface CaseCurrentState {
  case_id: string;
  office_id: string;
  current_state_id: string | null;
  current_state_changed_at: string | null;
  current_state_changed_by: string | null;
  current_state_note: string | null;
}

export interface NextStateOption {
  to_state_id: string;
  to_state_code: string;
  to_state_name: string;
  sort_order: number;
}

export interface StateTimelineEntry {
  history_id: string;
  case_id: string;
  from_state_id: string | null;
  from_state_code: string | null;
  from_state_name: string | null;
  to_state_id: string;
  to_state_code: string;
  to_state_name: string;
  changed_at: string;
  changed_by: string | null;
  note: string | null;
}

export interface CaseNotification {
  id: string;
  case_id: string;
  office_id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

// ============ Error Handling ============

export interface FsmErrorResult {
  message: string;
  isBlocked: boolean;
}

export function handleFsmError(error: unknown): FsmErrorResult {
  const msg = (error as any)?.message || String(error);
  
  if (msg.includes("BLOQUEIO") || msg.includes("Use RPC")) {
    return {
      message: "Transição não permitida no fluxo do caso. Verifique as regras de transição.",
      isBlocked: true,
    };
  }
  
  if (msg.includes("Transição inválida") || msg.includes("transição inválida")) {
    return {
      message: "Esta mudança de estado não é permitida a partir do estado atual.",
      isBlocked: true,
    };
  }
  
  if (msg.includes("Estado destino não encontrado")) {
    return {
      message: "Estado de destino não encontrado.",
      isBlocked: true,
    };
  }
  
  return {
    message: "Erro ao atualizar estado do processo.",
    isBlocked: false,
  };
}

// ============ Service Functions ============

/**
 * Get the current state of a case from the FSM view.
 */
export async function getCaseCurrentState(caseId: string): Promise<CaseCurrentState | null> {
  const { data, error } = await supabase
    .from("vw_case_current_state" as any)
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();

  if (error) {
    console.error("[caseState] Error fetching current state:", error);
    return null;
  }

  return data as unknown as CaseCurrentState | null;
}

/**
 * Fetch all cases with their current FSM state merged.
 * Returns cases with an additional `currentState` property.
 */
export async function listCasesWithCurrentState(officeId: string): Promise<
  Array<{
    caseData: any;
    currentState: CaseCurrentState | null;
  }>
> {
  // Fetch cases
  const { data: cases, error: casesError } = await supabase
    .from("cases")
    .select("*")
    .eq("office_id", officeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (casesError) {
    console.error("[caseState] Error fetching cases:", casesError);
    return [];
  }

  if (!cases || cases.length === 0) {
    return [];
  }

  // Fetch current states for all cases
  const caseIds = cases.map((c) => c.id);
  const { data: states, error: statesError } = await supabase
    .from("vw_case_current_state" as any)
    .select("*")
    .in("case_id", caseIds);

  if (statesError) {
    console.error("[caseState] Error fetching states:", statesError);
  }

  // Build a map of states by case_id
  const statesMap: Record<string, CaseCurrentState> = {};
  (states || []).forEach((s: any) => {
    statesMap[s.case_id] = s as CaseCurrentState;
  });

  // Merge
  return cases.map((c) => ({
    caseData: c,
    currentState: statesMap[c.id] || null,
  }));
}

/**
 * Get all available FSM states for display/mapping.
 */
export async function getAllStates(): Promise<CaseState[]> {
  const { data, error } = await supabase
    .from("lexos_case_states" as any)
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[caseState] Error fetching all states:", error);
    return [];
  }

  return (data || []) as unknown as CaseState[];
}

/**
 * Get valid next states for a given case via RPC.
 */
export async function getNextStates(caseId: string): Promise<NextStateOption[]> {
  const { data, error } = await supabase.rpc("lexos_next_states_for_case" as any, {
    p_case_id: caseId,
  });

  if (error) {
    console.error("[caseState] Error fetching next states:", error);
    return [];
  }

  return (data || []) as NextStateOption[];
}

/**
 * Get the state timeline for a case.
 */
export async function getStateTimeline(caseId: string): Promise<StateTimelineEntry[]> {
  const { data, error } = await supabase
    .from("vw_case_state_timeline" as any)
    .select("*")
    .eq("case_id", caseId)
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("[caseState] Error fetching timeline:", error);
    return [];
  }

  return (data || []) as unknown as StateTimelineEntry[];
}

/**
 * Transition a case to a new state via RPC.
 */
export async function transitionCaseState(
  caseId: string,
  toStateId: string,
  note?: string
): Promise<{ success: boolean; historyId?: string; error?: string }> {
  const { data, error } = await supabase.rpc("lexos_transition_case_state" as any, {
    p_case_id: caseId,
    p_to_state_id: toStateId,
    p_note: note ?? null,
  });

  if (error) {
    const fsmError = handleFsmError(error);
    toast.error(fsmError.message);
    return { success: false, error: fsmError.message };
  }

  return { success: true, historyId: data as string };
}

/**
 * Get notifications for a case (or all notifications if caseId is not provided).
 */
export async function getNotifications(
  caseId?: string,
  unreadOnly: boolean = true
): Promise<CaseNotification[]> {
  let query = supabase
    .from("lexos_case_notifications" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (caseId) {
    query = query.eq("case_id", caseId);
  }

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    console.error("[caseState] Error fetching notifications:", error);
    return [];
  }

  return (data || []) as unknown as CaseNotification[];
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from("lexos_case_notifications" as any)
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("[caseState] Error marking notification read:", error);
    return false;
  }

  return true;
}

/**
 * Get a state by ID from the cache or fetch it.
 */
export async function getStateById(stateId: string): Promise<CaseState | null> {
  const { data, error } = await supabase
    .from("lexos_case_states" as any)
    .select("*")
    .eq("id", stateId)
    .maybeSingle();

  if (error) {
    console.error("[caseState] Error fetching state:", error);
    return null;
  }

  return data as unknown as CaseState | null;
}

/**
 * Build a state ID to state map for efficient lookups.
 */
export function buildStatesMap(states: CaseState[]): Record<string, CaseState> {
  const map: Record<string, CaseState> = {};
  states.forEach((s) => {
    map[s.id] = s;
  });
  return map;
}
