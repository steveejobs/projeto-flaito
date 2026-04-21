import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const payload = await req.json()
    const { messageId, phone, instanceId, text, content } = payload
    
    // Normalização básica
    const normalizedPhone = (phone || '').replace(/\D/g, '')
    const messageContent = text?.message || content || ''

    if (!messageId || !instanceId) {
      return new Response('Missing Required Fields', { status: 400 })
    }

    // 1. Resolver Office e Validar Instância
    const { data: inst, error: instErr } = await supabase
      .from('whatsapp_instances')
      .select('office_id, instance_token')
      .eq('instance_id', instanceId)
      .maybeSingle()

    if (instErr || !inst) {
      console.error(`[Webhook] Instância não reconhecida: ${instanceId}`)
      return new Response('Unauthorized Instance', { status: 403 })
    }

    const officeId = inst.office_id

    // 2. Persistir Inbound
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

    // Inserir mensagem com os campos REAIS do banco
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
      // Não falha o webhook se o motor de fluxo falhar (auditamos via logs/flow_runs)
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
