import { supabase } from "@/integrations/supabase/client";
import { crmSyncService, STAGES } from "./crmSyncService";
import { flowExecutionService } from "./flowExecutionService";

export interface NormalizedMessage {
  id: string;
  phone: string;
  text: string;
  direction: 'inbound' | 'outbound';
  rawPayload: any;
}

export const whatsappProcessorService = {
  /**
   * Ponto de entrada universal para o processamento de mensagens.
   */
  async processMessage(instanceId: string, message: NormalizedMessage): Promise<void> {
    const { id: externalId, phone, text, direction } = message;

    if (direction === 'outbound') return;

    // 1. Resolver Office e Token via Instância (UAZAPI)
    const { data: inst, error: instErr } = await supabase
      .from('whatsapp_instances')
      .select('office_id, instance_token, server_url')
      .eq('instance_name', instanceId)
      .maybeSingle();

    if (instErr || !inst) {
      console.error(`[WhatsApp Engine] Instância não encontrada ou erro: ${instanceId}`);
      return;
    }

    const officeId = inst.office_id;

    // 2. Idempotência
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle();
      
    if (existing) return;

    // 3. Obter ou Criar Conversa
    const conversationId = await this.getOrCreateConversation(officeId, phone);

    // 4. Executar Motor de Fluxo (Fase 0)
    const decision = await flowExecutionService.execute(officeId, conversationId, text);

    // 5. Persistir Mensagem Inbound
    await supabase.from('whatsapp_messages').insert({
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
      console.log(`[WhatsApp Engine] Escalando ${phone} para atendimento humano.`);
    }

    // 7. Resposta Automática
    if (decision.response) {
      await this.handleAutoResponse(officeId, conversationId, decision.response, phone, inst.server_url, inst.instance_token);
    }
  },

  async handleAutoResponse(officeId: string, conversationId: string, responseText: string, phone: string, serverUrl: string, instanceToken: string) {
    try {
      console.log(`[WhatsApp Engine] Enviando resposta via WhatsApi: ${responseText}`);
      
      const response = await fetch(`${serverUrl}/message/text`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "token": instanceToken 
        },
        body: JSON.stringify({
          number: phone,
          text: responseText
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar mensagem: ${response.statusText}`);
      }

      // Persistir Outbound
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        office_id: officeId,
        direction: 'outbound',
        content: responseText,
        receiver_phone: phone,
        metadata: { source: 'ai_flow_engine', status: 'sent' }
      });
      
    } catch (err) {
      console.error("[WhatsApp Engine] Falha no envio outbound:", err);
      
      // Salvar mesmo assim para histórico com erro
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        office_id: officeId,
        direction: 'outbound',
        content: responseText,
        receiver_phone: phone,
        metadata: { source: 'ai_flow_engine', status: 'failed', error: err.message }
      });
    }
  },

  async getOrCreateConversation(officeId: string, phone: string): Promise<string> {
    const { data: existing } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('office_id', officeId)
      .eq('normalized_phone', phone)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created } = await supabase
      .from('whatsapp_conversations')
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
