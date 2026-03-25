import { serve } from "https://deno.land/std@0.168.1/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizePhone } from "../_shared/phoneUtils.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const KEYWORDS = {
  CANCELLATION: ['não', 'cancelar', 'não vou', 'desisto', 'impossível', 'cancelado'],
  RESCHEDULE: ['outro dia', 'remarcar', 'mudar', 'horário', 'trocar', 'dia'],
  CONFIRMATION: ['sim', 'ok', 'confirmado', 'pode ser', 'estarei', 'com certeza']
};

const classifyMessage = (text: string): string => {
  const words = text.toLowerCase();
  if (KEYWORDS.CANCELLATION.some(k => words.includes(k))) return 'CANCELLATION';
  if (KEYWORDS.RESCHEDULE.some(k => words.includes(k))) return 'RESCHEDULE';
  if (KEYWORDS.CONFIRMATION.some(k => words.includes(k))) return 'CONFIRMATION';
  return 'DOUBT';
};

const logger = (level: 'info' | 'error' | 'warn', message: string, context: any = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const correlationId = crypto.randomUUID();
  const url = new URL(req.url);

  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    
    // Validates that it is a subscription request from Meta
    if (mode === 'subscribe' && challenge) {
      logger('info', 'Meta Webhook Verified', { correlationId });
      return new Response(challenge, { status: 200 }); // Echo back the challenge token
    }
    logger('warn', 'Invalid GET request for webhook', { correlationId });
    return new Response('Invalid verification', { status: 403 });
  }

  // 2. Process POST Requests
  logger('info', 'Webhook POST execution started', { correlationId });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase Env Vars");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();

    // Determine Provider
    const isMeta = payload.object === 'whatsapp_business_account';
    
    let eventId: string | undefined;
    let type: string | undefined;
    let messageId: string | undefined;
    let status: string | undefined;
    let text: string | undefined;
    let phone: string | undefined;
    let providerName: string;

    if (isMeta) {
       providerName = 'whatsapp_meta';
       const entry = payload.entry?.[0];
       const change = entry?.changes?.[0]?.value;
       
       if (!change) return new Response('OK', { status: 200, headers: corsHeaders });
       
       if (change.messages && change.messages.length > 0) {
          type = 'on-message-received';
          const msg = change.messages[0];
          messageId = msg.id;
          eventId = messageId;
          text = msg.text?.body || '';
          phone = change.contacts?.[0]?.wa_id;
       } else if (change.statuses && change.statuses.length > 0) {
          type = 'on-message-status';
          const stat = change.statuses[0];
          messageId = stat.id;
          eventId = `${messageId}_${stat.status}`;
          status = stat.status; // 'sent', 'delivered', 'read', 'failed'
       } else {
          return new Response('OK', { status: 200, headers: corsHeaders });
       }
    } else {
       // Z-API
       providerName = 'whatsapp_zapi';
       eventId = payload.eventId || payload.id;
       type = payload.type;
       messageId = payload.messageId;
       status = payload.status;
       text = payload.text?.message;
       phone = payload.phone;
    }

    if (!eventId) {
       logger('warn', 'Payload missing eventId', { payload, correlationId });
       return new Response('Payload missing eventId', { status: 400 });
    }

    logger('info', `Processing webhook event: ${type}`, { eventId, providerName, correlationId });

    // 3. Idempotency Check
    const { data: existingEvent } = await supabase
      .from('webhook_processed_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      logger('info', 'Event already processed', { eventId, correlationId });
      return new Response(JSON.stringify({ success: true, message: 'Already processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Update Status
    if (type === 'on-message-status' && messageId) {
      if (status === 'read' || status === 'delivered') {
        const updateData: any = { status };
        if (status === 'read') {
          updateData.read_at = new Date().toISOString();
          const { data: log } = await supabase.from('message_logs').select('created_at').eq('external_id', messageId).maybeSingle();
          if (log) {
            const diffMin = (new Date().getTime() - new Date(log.created_at).getTime()) / (1000 * 60);
            updateData.engagement_score = Math.max(0, Math.min(100, Math.round(100 - (diffMin / 10))));
          }
        }
        await supabase.from('message_logs').update(updateData).eq('external_id', messageId);
      }
    } 
    // 5. Inbound Message Received
    else if (type === 'on-message-received' && text && phone) {
      const classification = classifyMessage(text);
      
      let clientId = null;
      let officeId = null;

      const normPhone = normalizePhone(phone);

      if (normPhone) {
         // Consulta unificada apenas na tabela clients, 
         // já que todos os pacientes foram consolidados com um client_id
         const { data: cl } = await supabase.from('clients').select('id, office_id').eq('normalized_phone', normPhone).maybeSingle();
         if (cl) {
            clientId = cl.id;
            officeId = cl.office_id;
         }
      }

      if (clientId && officeId) {
        logger('info', 'Message received from known client', { clientId, classification, correlationId });
        await supabase.from('message_logs').insert({
          office_id: officeId,
          client_id: clientId,
          direction: 'inbound',
          content: text,
          status: 'received',
          external_id: messageId,
          classification,
          channel: 'whatsapp',
          provider: providerName,
          metadata: { correlation_id: correlationId }
        });
        
        // Audit
        await supabase.from('audit_logs').insert({
          entity_type: 'MESSAGE',
          entity_id: messageId!,
          action: 'RECEIVED',
          office_id: officeId,
          correlation_id: correlationId,
          after_snapshot: { text, classification }
        });
      }
    }

    // 6. Mark as processed
    await supabase.from('webhook_processed_events').insert({
        event_id: eventId,
        provider: providerName,
        event_type: type || 'unknown'
    });

    return new Response(JSON.stringify({ success: true, correlationId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    logger('error', 'Webhook processing failure', { error: error.message, correlationId });
    return new Response(JSON.stringify({ error: error.message, correlationId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
