import { supabase } from "@/integrations/supabase/client";
import { crmSyncService, STAGES } from "./crmSyncService";
import { zapiProvider, NormalizedMessage } from "./providers/zapiProvider";
import { flowExecutionService } from "./flowExecutionService";

export const whatsappProcessorService = {
  /**
   * Ponto de entrada universal para o processamento de mensagens.
   */
  async processMessage(instanceId: string, message: NormalizedMessage): Promise<void> {
    const { id: externalId, phone, text, direction } = message;

    if (direction === 'outbound') return;

    // 1. Resolver Office e Token via Instância
    const { data: inst, error: instErr } = await supabase
      .from('whatsapp_instances' as any)
      .select('office_id, instance_token')
      .eq('instance_id', instanceId)
      .maybeSingle();

    if (instErr || !inst) {
      console.error(`[WhatsApp Engine] Instância não encontrada ou erro: ${instanceId}`);
      return;
    }

    const officeId = inst.office_id;

    // 2. Idempotência
    const { data: existing } = await supabase
      .from('whatsapp_messages' as any)
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle();
      
    if (existing) return;

    // 3. Obter ou Criar Conversa
    const conversationId = await this.getOrCreateConversation(officeId, phone);

    // 4. Executar Motor de Fluxo (Fase 0)
    const decision = await flowExecutionService.execute(officeId, conversationId, text);

    // 5. Persistir Mensagem Inbound
    await supabase.from('whatsapp_messages' as any).insert({
      conversation_id: conversationId,
      office_id: officeId,
      external_id: externalId,
      direction: 'inbound',
      content: text,
      intent_detected: decision.shouldHandoff ? 'escalar_humano' : 'fluxo_decidido',
      sender_phone: phone,
      metadata: { ...message.rawPayload, flow_decision: decision },
      processed_at: new Date().toISOString()
    });

    // 6. Sincronização CRM básica
    if (decision.shouldHandoff) {
      // Simplesmente loga no crm por enquanto
      console.log(`[WhatsApp Engine] Escalando ${phone} para atendimento humano.`);
    }

    // 7. Resposta Automática (se houver e se não for handoff puro sem resposta)
    if (decision.response) {
      await this.handleAutoResponse(officeId, conversationId, decision.response, phone, instanceId, inst.instance_token);
    }
  },

  async handleAutoResponse(officeId: string, conversationId: string, responseText: string, phone: string, instanceId: string, token: string) {
    // Envio real
    const result = await zapiProvider.sendTextMessage({
      instanceId,
      token,
      to: phone,
      message: responseText
    });

    // Persistir Outbound
    await supabase.from('whatsapp_messages' as any).insert({
      conversation_id: conversationId,
      office_id: officeId,
      direction: 'outbound',
      content: responseText,
      receiver_phone: phone,
      metadata: { zapi_result: result, source: 'ai_flow_engine' }
    });
  },

  async getOrCreateConversation(officeId: string, phone: string): Promise<string> {
    const { data: existing } = await supabase
      .from('whatsapp_conversations' as any)
      .select('id')
      .eq('office_id', officeId)
      .eq('normalized_phone', phone)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created } = await supabase
      .from('whatsapp_conversations' as any)
      .insert({
        office_id: officeId,
        normalized_phone: phone,
        status: 'active'
      })
      .select('id')
      .single();

    return created.id;
  }
};
