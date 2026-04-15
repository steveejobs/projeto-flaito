/**
 * Centralized service for FSM-based case state management.
 * All state reads and transitions go through this service.
 *
 * NOTE: The FSM views/RPCs (vw_case_current_state, lexos_case_states,
 * lexos_case_notifications, etc.) are not present in the remote schema.
 * Unmapped queries use a local `db` alias to keep `as any` contained
 * to a single import-line declaration.
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

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
  const msg = error instanceof Error ? error.message : String(error);

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

export async function getCaseCurrentState(caseId: string): Promise<CaseCurrentState | null> {
  const { data, error } = await db
    .from("vw_case_current_state")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();

  if (error) {
    console.error("[caseState] Error fetching current state:", error);
    return null;
  }

  return data as CaseCurrentState | null;
}

export async function listCasesWithCurrentState(officeId: string): Promise<
  Array<{
    caseData: Record<string, unknown>;
    currentState: CaseCurrentState | null;
  }>
> {
  const { data: cases, error: casesError } = await supabase
    .from("cases")
    .select("*")
    .eq("office_id", officeId)
    .order("created_at", { ascending: false });

  if (casesError) {
    console.error("[caseState] Error fetching cases:", casesError);
    return [];
  }

  if (!cases || cases.length === 0) {
    return [];
  }

  const caseIds = cases.map((c) => c.id);
  const { data: states, error: statesError } = await db
    .from("vw_case_current_state")
    .select("*")
    .in("case_id", caseIds);

  if (statesError) {
    console.error("[caseState] Error fetching states:", statesError);
  }

  const statesMap: Record<string, CaseCurrentState> = {};
  (states as CaseCurrentState[] || []).forEach((s) => {
    statesMap[s.case_id] = s;
  });

  return cases.map((c) => ({
    caseData: c as Record<string, unknown>,
    currentState: statesMap[c.id] || null,
  }));
}

export async function getAllStates(): Promise<CaseState[]> {
  const { data, error } = await db
    .from("lexos_case_states")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[caseState] Error fetching all states:", error);
    return [];
  }

  return (data as CaseState[]) || [];
}

export async function getNextStates(caseId: string): Promise<NextStateOption[]> {
  const { data, error } = await db.rpc("lexos_next_states_for_case", {
    p_case_id: caseId,
  });

  if (error) {
    console.error("[caseState] Error fetching next states:", error);
    return [];
  }

  return (data as NextStateOption[]) || [];
}

export async function getStateTimeline(caseId: string): Promise<StateTimelineEntry[]> {
  const { data, error } = await db
    .from("vw_case_state_timeline")
    .select("*")
    .eq("case_id", caseId)
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("[caseState] Error fetching timeline:", error);
    return [];
  }

  return (data as StateTimelineEntry[]) || [];
}

export async function transitionCaseState(
  caseId: string,
  toStateId: string,
  note?: string
): Promise<{ success: boolean; historyId?: string; error?: string }> {
  const { data, error } = await db.rpc("lexos_transition_case_state", {
    p_case_id: caseId,
    p_to_state_id: toStateId,
    p_note: note ?? null,
  });

  if (error) {
    const fsmError = handleFsmError(error);
    toast.error(fsmError.message);
    return { success: false, error: fsmError.message };
  }

  return { success: true, historyId: data as string | undefined };
}

export async function getNotifications(
  caseId?: string,
  unreadOnly: boolean = true
): Promise<CaseNotification[]> {
  let query = db
    .from("lexos_case_notifications")
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

  return (data as CaseNotification[]) || [];
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const { error } = await db
    .from("lexos_case_notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("[caseState] Error marking notification read:", error);
    return false;
  }

  return true;
}

export async function getStateById(stateId: string): Promise<CaseState | null> {
  const { data, error } = await db
    .from("lexos_case_states")
    .select("*")
    .eq("id", stateId)
    .maybeSingle();

  if (error) {
    console.error("[caseState] Error fetching state:", error);
    return null;
  }

  return data as CaseState | null;
}

export function buildStatesMap(states: CaseState[]): Record<string, CaseState> {
  const map: Record<string, CaseState> = {};
  states.forEach((s) => {
    map[s.id] = s;
  });
  return map;
}
