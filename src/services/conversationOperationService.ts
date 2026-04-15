import { supabase } from "@/integrations/supabase/client";
import { crmSyncService } from "./crmSyncService";

export const conversationOperationService = {
  /**
   * Assume o atendimento de uma conversa (Takeover)
   */
  async takeover(conversationId: string, userId: string, officeId: string) {
    console.log(`[ConvOp] Usuário ${userId} assumindo conversa ${conversationId}`);

    const { data: conv, error } = await supabase
      .from('whatsapp_conversations' as any)
      .update({
        assigned_user_id: userId,
        status: 'em_atendimento_humano',
        human_required: false,
        last_human_action_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .select('office_id, lead_id')
      .single();

    if (error) throw error;

    // Log de Evento
    await this.logEvent(conversationId, officeId, userId, 'takeover', { assigned_to: userId });

    // Sync CRM se houver lead
    if (conv.lead_id) {
      await crmSyncService.logActivity(conv.lead_id, officeId, {
        type: 'human_takeover',
        description: `Atendimento assumido manualmente via Central Operacional.`,
        metadata: { operator_id: userId }
      });
    }
  },

  /**
   * Adiciona uma nota interna
   */
  async addNote(conversationId: string, officeId: string, userId: string, body: string) {
    const { error } = await supabase
      .from('conversation_notes' as any)
      .insert({
        conversation_id: conversationId,
        office_id: officeId,
        author_user_id: userId,
        body
      });

    if (error) throw error;

    await this.logEvent(conversationId, officeId, userId, 'note_added', { snippet: body.substring(0, 50) });
  },

  /**
   * Encerra a conversa
   */
  async close(conversationId: string, userId: string, officeId: string) {
    const { data: conv, error } = await supabase
      .from('whatsapp_conversations' as any)
      .update({
        status: 'encerrada',
        closed_at: new Date().toISOString(),
        human_required: false
      })
      .eq('id', conversationId)
      .select('lead_id')
      .single();

    if (error) throw error;

    await this.logEvent(conversationId, officeId, userId, 'closed');

    if (conv.lead_id) {
      await crmSyncService.logActivity(conv.lead_id, officeId, {
        type: 'conversation_closed',
        description: `Atendimento encerrado na Central Operacional.`,
      });
    }
  },

  /**
   * Registra um evento de auditoria operacional
   */
  async logEvent(conversationId: string, officeId: string, userId: string | null, type: string, metadata: any = {}) {
    await supabase.from('conversation_events' as any).insert({
      conversation_id: conversationId,
      office_id: officeId,
      actor_type: userId ? 'user' : 'system',
      actor_user_id: userId,
      event_type: type,
      metadata
    });
  }
};
