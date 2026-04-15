import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";

export type FlowDecision = {
  response: string;
  shouldHandoff: boolean;
  metadata?: any;
};

export const flowExecutionService = {
  /**
   * Valida a integridade de um fluxo antes da publicação.
   */
  async validateFlow(definition: any) {
    const errors: string[] = [];
    if (!definition || !definition.nodes || definition.nodes.length === 0) {
      errors.push("O fluxo deve conter pelo menos um nó.");
    } else {
      const hasStart = definition.nodes.some((n: any) => n.id === 'start-node' || n.type === 'message');
      if (!hasStart) errors.push("Nó inicial não encontrado ou inválido.");
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Executa a lógica de decisão para uma mensagem recebida.
   */
  async execute(params: {
    officeId: string, 
    conversationId: string, 
    messageText: string, 
    channel?: string,
    startedBy?: string,
    entryMessageId?: string
  }): Promise<FlowDecision> {
    const { officeId, conversationId, messageText, channel = 'whatsapp', startedBy, entryMessageId } = params;
    console.log(`[FlowEngine] Executando para Office ${officeId}, Conversa ${conversationId}`);

    // 1. Carregar Perfil do Agente Ativo
    const { data: agent } = await supabase
      .from('agent_profiles' as any)
      .select('*')
      .eq('office_id', officeId)
      .eq('is_active', true)
      .maybeSingle();

    // 2. Localizar versão do Fluxo para execução (IMUTABILIDADE)
    let activeRun = await this.getActiveRun(conversationId);
    let versionId = activeRun?.version_id;
    let flowDefinition = activeRun?.flow_versions?.definition_json;

    if (!activeRun) {
      const flowId = agent?.default_flow_id;
      if (flowId) {
        const { data: version } = await supabase
          .from('flow_versions' as any)
          .select('id, definition_json')
          .eq('flow_id', flowId)
          .eq('status', 'published')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (version) {
          versionId = version.id;
          flowDefinition = version.definition_json;
          
          activeRun = await this.startRun({
            officeId, 
            conversationId, 
            versionId, 
            agentId: agent?.id, 
            channel,
            startedBy,
            entryMessageId
          });
        }
      }
    }

    // 3. Execução do Grafo
    if (flowDefinition && flowDefinition.nodes) {
      const decision = await this.processNodes(activeRun, flowDefinition, messageText, officeId);
      if (decision) return decision;
    }

    // 4. Fallback Estrutural
    return this.triggerFallback(agent, officeId, conversationId, messageText);
  },

  async triggerFallback(agent: any, officeId: string, conversationId: string, messageText: string): Promise<FlowDecision> {
    const fallbackMsg = agent?.fallback_message || "Desculpe, não entendi. Vou encaminhar sua solicitação.";
    
    await this.logEvent(officeId, conversationId, 'fallback_triggered', { input: messageText });

    return {
      response: fallbackMsg,
      shouldHandoff: agent?.handoff_policy === 'always_human',
      metadata: { source: 'agent_fallback' }
    };
  },

  async getActiveRun(conversationId: string) {
    const { data } = await supabase
      .from('flow_runs' as any)
      .select('*, flow_versions(definition_json)')
      .eq('metadata->>conversation_id', conversationId)
      .eq('status', 'running')
      .maybeSingle();
    return data;
  },

  async startRun(params: {
    officeId: string, 
    conversationId: string, 
    versionId: string, 
    agentId: string, 
    channel: string,
    startedBy?: string,
    entryMessageId?: string
  }) {
    const { data } = await supabase
      .from('flow_runs' as any)
      .insert({
        office_id: params.officeId,
        version_id: params.versionId,
        agent_id: params.agentId,
        channel: params.channel,
        trigger_type: 'message',
        status: 'running',
        metadata: { 
          conversation_id: params.conversationId,
          started_by: params.startedBy,
          entry_message_id: params.entryMessageId
        }
      })
      .select()
      .single();
    return data;
  },

  async processNodes(run: any, definition: any, input: string, officeId: string): Promise<FlowDecision | null> {
    // Busca nó atual ou inicial
    const currentNode = definition.nodes.find((n: any) => n.id === 'start-node' || n.type === 'message');
    
    if (!currentNode) return null;

    // Lógica de nós
    if (currentNode.type === 'message') {
      await this.logStep(run.id, currentNode.id, currentNode.type, currentNode.label, { input }, { output: currentNode.config.text });
      return { response: currentNode.config.text, shouldHandoff: false };
    }

    if (currentNode.type === 'handoff') {
      await this.logStep(run.id, currentNode.id, currentNode.type, currentNode.label, { input }, { output: 'handoff_triggered' });
      return { response: "Transferindo...", shouldHandoff: true };
    }

    return null;
  },

  async logStep(runId: string, nodeId: string, nodeType: string, label: string, input: any, output: any) {
    await supabase.from('flow_run_steps' as any).insert({
      run_id: runId,
      node_id: nodeId,
      node_type: nodeType,
      node_label: label,
      input_data: input,
      output_data: output
    });
  },

  async logEvent(officeId: string, conversationId: string, eventType: string, metadata: any) {
    try {
      await supabase.from('conversation_events' as any).insert({
        office_id: officeId,
        conversation_id: conversationId,
        event_type: eventType,
        metadata,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[FlowEngine] Erro ao logar evento:', e);
    }
  }
};
