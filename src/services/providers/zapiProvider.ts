/**
 * Z-API Provider Adapter
 * Abstração para comunicação real com WhatsApp via Z-API
 */

export interface NormalizedMessage {
  id: string;               // ID único da mensagem no provedor (idempotência)
  phone: string;            // Telefone normalizado
  text: string;             // Conteúdo da mensagem
  direction: 'inbound' | 'outbound';
  timestamp: string;
  rawPayload: any;          // Payload bruto para auditoria
}

interface ZapiWebhookPayload {
  messageId: string;
  phone: string;
  text: { message: string };
  instanceId: string;
  momment?: number;
}

export const zapiProvider = {
  /**
   * Converte o payload bruto da Z-API para o formato interno do Flaito
   */
  normalizeIncoming(payload: any): NormalizedMessage {
    // A Z-API envia o texto em diferentes locais dependendo do tipo, 
    // simplificamos para o MVP de texto.
    const messageId = payload.messageId || `zapi-${Date.now()}`;
    const phone = payload.phone ? payload.phone.replace(/\D/g, '') : '';
    const text = payload.text?.message || payload.content || '';

    return {
      id: messageId,
      phone,
      text,
      direction: 'inbound',
      timestamp: new Date().toISOString(),
      rawPayload: payload
    };
  },

  /**
   * Envia uma mensagem de texto via Z-API
   */
  async sendMessage(to: string, text: string, officeId?: string): Promise<boolean> {
    try {
      if (!officeId) throw new Error("Office ID is required for dynamic Z-API routing");

      // 1. Buscar a instância primária ativa para este escritório
      const { data: instance, error } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, instance_token')
        .eq('office_id', officeId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false }) // Pega a primária primeiro
        .limit(1)
        .single();
      
      if (error || !instance) {
        console.error(`[zapiProvider] Nenhuma instância ativa para o escritório ${officeId}`);
        return false;
      }

      console.log(`[zapiProvider] Enviando via instância ${instance.instance_id}...`);
      
      const response = await fetch(`${this.baseUrl}/instances/${instance.instance_id}/token/${instance.instance_token}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': token // Algumas rotas exigem este header
        },
        body: JSON.stringify({
          phone: to,
          message: message
        })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, messageId: data.messageId };
      }

      return { success: false, error: data.message || 'Erro desconhecido na Z-API' };
    } catch (err: any) {
      console.error('[Z-API Provider] Erro no fetch:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Helper para normalização de telefone padrão Flaito
   */
  normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }
};
