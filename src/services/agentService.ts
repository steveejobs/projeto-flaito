import { supabase } from "@/integrations/supabase/client";

export interface AgentExecuteResponse {
  content: string;
  _audit?: {
    config_id: string;
    version: number;
    source: string;
    model: string;
  };
}

export interface AgentExecution {
  id: string;
  client_id: string;
  office_id: string;
  agent_slug: string;
  input: string;
  output: string;
  model: string;
  config_source: string;
  config_version: number;
  created_at: string;
}

/**
 * Executa um agente de IA para um cliente específico.
 * @param clientId ID do cliente (usado para contexto e resolução de office_id)
 * @param agentSlug Slug do agente (ex: 'lexos-chat-assistant')
 * @param input Pergunta ou comando do usuário
 */
export async function executeAgent(params: {
  clientId: string;
  agentSlug: string;
  input: string;
  useContext?: boolean;
}): Promise<AgentExecuteResponse> {
  const { clientId, agentSlug, input, useContext = false } = params;

  const { data, error } = await supabase.functions.invoke("execute-agent", {
    body: {
      client_id: clientId,
      agent_slug: agentSlug,
      input: input,
      use_context: useContext,
    },
  });

  if (error) {
    console.error("[agentService] Error invoking execute-agent:", error);
    throw new Error(error.message || "Erro ao executar agente de IA.");
  }

  return data as AgentExecuteResponse;
}

/**
 * Busca os agentes ativos que podem ser selecionados para teste.
 */
export async function getActiveAgents() {
  const { data, error } = await supabase
    .from("ai_agent_configs" as any)
    .select("slug, office_id")
    .eq("is_active", true)
    .order("slug", { ascending: true });

  if (error) {
    console.error("[agentService] Error fetching agents:", error);
    return [];
  }

  // Filtrar duplicados por slug (mantendo OFFICE override se houver, mas para a lista de nomes apenas o slug importa)
  const uniqueSlugs = Array.from(new Set((data || []).map((a: any) => a.slug)));
  
  return uniqueSlugs;
}

/**
 * Busca o histórico de execuções de agentes para um cliente.
 * Limitado às últimas 20 execuções.
 */
export async function getAgentHistory(clientId: string): Promise<AgentExecution[]> {
  const { data, error } = await supabase
    .from("agent_executions" as any)
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[agentService] Error fetching history:", error);
    throw new Error("Falha ao carregar histórico do agente.");
  }

  return (data || []) as unknown as AgentExecution[];
}
