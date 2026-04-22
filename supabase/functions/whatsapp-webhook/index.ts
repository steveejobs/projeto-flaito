import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const url = new URL(req.url);
  const officeId = url.searchParams.get("office_id");

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const payload = await req.json()
    console.log(`[Webhook] Evento recebido para office ${officeId}:`, JSON.stringify(payload));

    // 1. Tratar eventos de Conexão/Desconexão (uazapi)
    const isConnectionEvent = payload.event === "connection" || payload.status === "CONNECTED" || payload.connected === true;
    const isDisconnectionEvent = payload.event === "disconnected" || payload.status === "DISCONNECTED" || payload.connected === false;

    if (officeId && (isConnectionEvent || isDisconnectionEvent)) {
      const status = isConnectionEvent ? 'connected' : 'disconnected';
      const isConnected = isConnectionEvent;
      
      const updateData: any = { 
        status, 
        is_connected: isConnected,
        updated_at: new Date().toISOString()
      };
      
      if (isConnectionEvent) {
        updateData.last_connection_at = new Date().toISOString();
      }

      await supabase.from('whatsapp_instances')
        .update(updateData)
        .eq('office_id', officeId);
      
      console.log(`[Webhook] Status da instância atualizado para: ${status}`);
      
      // Se for apenas evento de conexão, podemos retornar aqui
      if (!payload.message) {
         return new Response(JSON.stringify({ ok: true, type: 'status_update' }), { status: 200 });
      }
    }

    // 2. Processar Mensagens Recebidas (Inbound)
    const { messageId, phone, instanceId, text, content } = payload;
    
    // Se não tiver dados de mensagem, ignorar o resto do processamento
    if (!phone && !messageId) {
       return new Response(JSON.stringify({ ok: true, message: 'No message content' }), { status: 200 });
    }

    // Normalização básica
    const normalizedPhone = (phone || '').replace(/\D/g, '')
    const messageContent = text?.message || content || payload.message?.text || ''

    if (!messageId || !officeId) {
      return new Response('Missing Required Fields (messageId or officeId)', { status: 200 }) // Return 200 to avoid retries if we can't process
    }

    // Persistir Inbound
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('external_id', messageId)
      .maybeSingle()

    if (existing) {
       return new Response('Already Processed', { status: 200 })
    }

    // Criar conversa se não existir
    let { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('office_id', officeId)
      .eq('normalized_phone', normalizedPhone)
      .eq('status', 'active')
      .maybeSingle()

    if (!conv) {
      const { data: newConv } = await supabase
        .from('whatsapp_conversations')
        .insert({ office_id: officeId, normalized_phone: normalizedPhone })
        .select().single()
      conv = newConv
    }

    // Inserir mensagem
    if (conv) {
      await supabase.from('whatsapp_messages').insert({
          office_id: officeId,
          conversation_id: conv.id,
          content: messageContent,
          direction: 'inbound',
          external_id: messageId,
          sender_phone: normalizedPhone
      });

      // 3. Processar via Motor de Fluxo (Internal Orchestration)
      try {
        const { FlowProcessor } = await import("../_shared/flow-engine/processor.ts");
        const processor = new FlowProcessor(supabase);
        await processor.process({
          officeId,
          conversationId: conv.id,
          messageText: messageContent,
          messageId: messageId,
          channel: 'whatsapp'
        });
      } catch (procErr) {
        console.error('[Webhook] Flow Engine Error:', procErr.message);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err) {
    console.error('[Webhook Error]', err.message)
    return new Response('Error', { status: 500 })
  }
})
