import { supabase } from "@/integrations/supabase/client";

export interface ServiceHealth {
  service_name: string;
  circuit_state: 'OPEN' | 'CLOSED' | 'HALF_OPEN';
  error_count: number;
  consecutive_successes: number;
  total_calls_24h: number;
  error_rate_5m: number;
  avg_latency_ms: number | null;
  last_call_at: string | null;
}

export interface OperationalOverview {
  active_incidents: number;
  global_uptime_24h: number;
  pending_payments_count: number;
  pending_signatures_count: number;
  last_calculation_at: string;
}

export interface ActiveIncident {
  service_name: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  error_summary: string;
  duration_minutes: number;
  first_seen: string;
  last_seen: string;
  occurrences: number;
}

export interface PendingState {
  category: 'BILLING' | 'DOCUMENT' | 'NOTIFICATION';
  internal_id: string;
  description: string;
  office_id: string;
  correlation_ref: string | null;
  pending_since: string;
  minutes_pending: number;
  severity: 'CRITICAL' | 'WARNING' | 'MEDIUM';
}

export interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  status: 'SUCCESS' | 'ERROR' | 'RETRY' | 'PENDING' | string;
  details: string | null;
  metadata_json: any | null;
  correlation_id: string | null;
  office_id: string | null;
}

/**
 * Hook para obter a visão geral operacional do sistema.
 * Consome a view v_operational_dashboard.
 */
export function useOperationsOverview() {
  return useQuery({
    queryKey: ["operations-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_operational_dashboard" as any)
        .select("*")
        .single();

      if (error) throw error;
      return data as OperationalOverview;
    },
    refetchInterval: 30000,
  });
}

/**
 * Hook para obter o detalhamento de saúde por serviço e circuit breaker.
 * Consome a tabela service_health.
 */
export function useServiceHealth() {
  return useQuery({
    queryKey: ["service-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_health" as any)
        .select("*")
        .order("service_name", { ascending: true });

      if (error) throw error;
      return data as ServiceHealth[];
    },
    refetchInterval: 15000,
  });
}

/**
 * Hook para listar incidentes ativos.
 * Consome a view v_active_incidents.
 */
export function useActiveIncidents() {
  return useQuery({
    queryKey: ["active-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_active_incidents" as any)
        .select("*")
        .order("first_seen", { ascending: false });

      if (error) throw error;
      return data as ActiveIncident[];
    },
    refetchInterval: 20000,
  });
}

/**
 * Hook para buscar o rastro de um correlation_id nos logs de auditoria.
 * Exige um correlation_id válido.
 */
export function useTraceExplorer(correlationId?: string) {
  return useQuery({
    queryKey: ["trace-explorer", correlationId],
    queryFn: async () => {
      if (!correlationId) return null;

      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .eq("correlation_id", correlationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!correlationId,
  });
}

/**
 * Hook para listar estados pendentes consolidados (backlog técnico).
 * Consome a view v_operational_pending_states.
 */
export function usePendingStates() {
  return useQuery({
    queryKey: ["operations-pending-states"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_operational_pending_states" as any)
        .select("*")
        .order("minutes_pending", { ascending: false });

      if (error) throw error;
      return data as PendingState[];
    },
    refetchInterval: 30000,
  });
}

/**
 * Mutation para resetar o Circuit Breaker de um serviço.
 * Ação de alto risco, restrita operacionalmente (audidada).
 */
export function useResetCircuitBreaker() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (serviceName: string) => {
      const { error } = await supabase
        .from("service_health")
        .update({ 
          circuit_state: "CLOSED", 
          error_count: 0,
          consecutive_successes: 0,
          updated_at: new Date().toISOString()
        })
        .eq("service_name", serviceName);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-health"] });
    },
  });
}
