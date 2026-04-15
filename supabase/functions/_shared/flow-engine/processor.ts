import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface FlowDecision {
  response: string | null;
  shouldHandoff: boolean;
  metadata?: any;
}

export class FlowProcessor {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Ponto de entrada para processamento de mensagens no cloud.
   */
  async process(params: {
    officeId: string,
    conversationId: string,
    messageText: string,
    messageId: string,
    channel: string
  }): Promise<FlowDecision> {
    const { officeId, conversationId, messageText, messageId, channel } = params;

    // 1. Idempotência por mensagem original
    const { data: existingRun } = await this.supabase
      .from('flow_runs')
      .select('id, status')
      .eq('metadata->>entry_message_id', messageId)
      .maybeSingle();

    if (existingRun) {
      console.log(`[FlowProcessor] Message ${messageId} already processed in run ${existingRun.id}`);
      return { response: null, shouldHandoff: false, metadata: { runId: existingRun.id, duplicate: true } };
    }

    // 2. Resolver Agente e Fluxo Publicado
    const { data: agent } = await this.supabase
      .from('agent_profiles')
      .select('*')
      .eq('office_id', officeId)
      .eq('is_active', true)
      .maybeSingle();

    if (!agent) {
      return this.triggerFallback(null, officeId, conversationId, messageText, "No active agent found");
    }

    if (!agent.default_flow_id) {
      return this.triggerFallback(agent, officeId, conversationId, messageText, "No default flow for agent");
    }

    // Buscar APENAS versão publicada
    const { data: version } = await this.supabase
      .from('flow_versions')
      .select('id, definition_json')
      .eq('flow_id', agent.default_flow_id)
      .eq('status', 'published')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!version) {
      return this.triggerFallback(agent, officeId, conversationId, messageText, "No published version found");
    }

    // 3. Iniciar Run (Imutabilidade)
    const { data: run, error: runError } = await this.supabase
      .from('flow_runs')
      .insert({
        office_id: officeId,
        version_id: version.id,
        agent_id: agent.id,
        channel: channel,
        trigger_type: 'message',
        status: 'running',
        metadata: {
          conversation_id: conversationId,
          entry_message_id: messageId,
          triggered_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (runError) {
      console.error('[FlowProcessor] Error creating flow_run:', runError);
      throw runError;
    }

    // 4. Execução do Grafo
    try {
      const decision = await this.executeGraph(run, version.definition_json, messageText);
      
      // 5. Reflexão Inbox/CRM
      await this.reflectResult(run, decision, params);

      return decision;
    } catch (err) {
      console.error('[FlowProcessor] Execution Error:', err);
      await this.logEvent(officeId, conversationId, 'execution_error', { error: err.message, runId: run.id });
      return this.triggerFallback(agent, officeId, conversationId, messageText, err.message);
    }
  }

  private async executeGraph(run: any, definition: any, input: string): Promise<FlowDecision> {
    const nodes = definition.nodes || [];
    // Simplificação Staff: Encontra o primeiro nó de mensagem ou start
    const startNode = nodes.find((n: any) => n.id === 'start-node' || n.type === 'message');

    if (!startNode) {
      throw new Error("Initial node not found in flow definition");
    }

    // Log Step
    await this.logStep(run.id, startNode.id, startNode.type, startNode.label || 'Start', { input }, { output: startNode.config?.text });

    if (startNode.type === 'handoff') {
      return { response: "Transferindo...", shouldHandoff: true };
    }

    return { 
      response: startNode.config?.text || "Olá!", 
      shouldHandoff: false,
      metadata: { nodeId: startNode.id }
    };
  }

  private async reflectResult(run: any, decision: FlowDecision, params: { officeId: string, conversationId: string, channel: string }) {
     const { officeId, conversationId } = params;

     // 1. Atualizar Conversa
     const newStatus = decision.shouldHandoff ? 'humano_necessario' : 'respondida_ia';
     await this.supabase
       .from('whatsapp_conversations')
       .update({ 
         status: newStatus,
         human_required: decision.shouldHandoff,
         last_ai_response_at: new Date().toISOString(),
         current_agent_id: run.agent_id
       })
       .eq('id', conversationId);

     // 2. Evento de Sistema
     await this.logEvent(officeId, conversationId, decision.shouldHandoff ? 'human_requested' : 'ai_response', {
        run_id: run.id,
        handoff: decision.shouldHandoff
     });

     // 3. CRM Reflection (se for handoff ou novo lead em potencial)
     if (decision.shouldHandoff) {
        await this.ensureCrmLead(officeId, conversationId, run.id);
     }
  }

  private async ensureCrmLead(officeId: string, conversationId: string, runId: string) {
    // Busca dados da conversa para encontrar o cliente
    const { data: conv } = await this.supabase
      .from('whatsapp_conversations')
      .select('normalized_phone, client_id')
      .eq('id', conversationId)
      .single();

    if (!conv) return;

    // Tentar encontrar lead existente
    const { data: existingLead } = await this.supabase
      .from('crm_leads')
      .select('id')
      .eq('office_id', officeId)
      .eq('phone', conv.normalized_phone)
      .maybeSingle();

    let leadId = existingLead?.id;

    if (!leadId) {
      // Criar Lead
      const { data: newLead } = await this.supabase
        .from('crm_leads')
        .insert({
          office_id: officeId,
          client_id: conv.client_id,
          full_name: `WhatsApp ${conv.normalized_phone}`,
          phone: conv.normalized_phone,
          pipeline_stage: 'novo_contato',
          source: 'WhatsApp'
        })
        .select('id')
        .single();
      leadId = newLead?.id;
    }

    if (leadId) {
      // Registrar Atividade
      await this.supabase.from('crm_activities').insert({
        lead_id: leadId,
        office_id: officeId,
        activity_type: 'handoff_requested',
        description: 'Transbordado para humano via Robô de Atendimento.',
        metadata: { run_id: runId }
      });
    }
  }

  private async triggerFallback(agent: any, officeId: string, conversationId: string, messageText: string, reason: string): Promise<FlowDecision> {
    console.warn(`[FlowProcessor] Fallback Triggered: ${reason}`);
    const fallbackMsg = agent?.fallback_message || "Desculpe, não consegui processar sua solicitação no momento. Vou encaminhá-lo para um atendente.";
    
    await this.logEvent(officeId, conversationId, 'fallback_triggered', { reason, input: messageText });

    return {
      response: fallbackMsg,
      shouldHandoff: agent?.handoff_policy === 'always_human' || true,
      metadata: { source: 'agent_fallback', reason }
    };
  }

  private async logStep(runId: string, nodeId: string, nodeType: string, label: string, input: any, output: any) {
    await this.supabase.from('flow_run_steps').insert({
      run_id: runId,
      node_id: nodeId,
      node_type: nodeType,
      node_label: label,
      input_data: input,
      output_data: output
    });
  }

  private async logEvent(officeId: string, conversationId: string, eventType: string, metadata: any) {
    await this.supabase.from('conversation_events').insert({
      office_id: officeId,
      conversation_id: conversationId,
      event_type: eventType,
      actor_type: 'system',
      metadata
    });
  }
}
