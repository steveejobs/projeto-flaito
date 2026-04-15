import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizePhone } from "../_shared/phoneUtils.ts"
import { QueueStatus, MessageLogStatus, MessagingContext } from "../_shared/constants.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logger = (level: 'info' | 'error' | 'warn', message: string, context: any = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }));
};

import { resilientFetch } from "../_shared/external-adapter.ts"

// ----------------------------------------------------
// PROVIDERS ABSTRACTION
// ----------------------------------------------------
interface IWhatsAppProvider {
  sendText(phone: string, text: string, messageLogId?: string): Promise<any>;
  sendDocument(phone: string, url: string, caption?: string, messageLogId?: string): Promise<any>;
  sendTemplate(phone: string, templateName: string, vars: any[], messageLogId?: string): Promise<any>;
}

class ZApiProvider implements IWhatsAppProvider {
  constructor(
    private apiUrl: string, 
    private instanceId: string, 
    private instanceToken: string, 
    private clientToken?: string,
    private correlationId?: string
  ) {}

  private getBaseUrl() {
    let baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    if (!baseUrl.includes('/instances/')) {
      baseUrl = `${baseUrl}/instances/${this.instanceId}/token/${this.instanceToken}`;
    }
    return baseUrl;
  }

  private async request(endpoint: string, body: any) {
    const url = `${this.getBaseUrl()}/${endpoint}`;
    
    // ── Resilient Call to Z-API ──────────────────────────
    const response = await resilientFetch(url, {
      method: "POST",
      headers: {
        ...(this.clientToken ? { 'Client-Token': this.clientToken } : {}),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      serviceName: "zapi",
      correlationId: this.correlationId,
      timeoutMs: 15000,
      isIdempotent: true // Z-API aceita reenviar se o endpoint for idempotente ou idempotency_key for implementado
    });

    if (!response.ok) {
       const errText = await response.text();
       const isPermanent = [400, 401, 403, 404].includes(response.status);
       throw { message: `Z-API Error: ${errText}`, code: `API_${response.status}`, isPermanent };
    }
    return response.json();
  }

  async sendText(phone: string, text: string, messageLogId?: string) {
    return this.request('send-text', { phone, message: text, delayTyping: 1, messageId: messageLogId });
  }

  async sendDocument(phone: string, url: string, caption?: string, messageLogId?: string) {
    return this.request('send-document', { phone, document: url, caption, fileName: "documento.pdf", messageId: messageLogId });
  }

  async sendTemplate(phone: string, templateNameOrText: string, vars: any[], messageLogId?: string) {
    return this.sendText(phone, templateNameOrText, messageLogId);
  }
}

class MetaOfficialProvider implements IWhatsAppProvider {
  constructor(private apiToken: string, private phoneNumberId: string, private correlationId?: string) {}

  private async request(body: any) {
    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
    
    // ── Resilient Call to Meta (Official) ────────────────
    const response = await resilientFetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      serviceName: "zapi", // Usando zapi como pool genérico de WhatsApp SRE por enquanto
      correlationId: this.correlationId,
      timeoutMs: 20000,
      isIdempotent: true
    });

    if (!response.ok) {
       const errText = await response.text();
       const errJson = JSON.parse(errText || '{}');
       throw { message: `Meta Error: ${errText}`, code: errJson.error?.code?.toString() || `API_${response.status}`, isPermanent: true };
    }
    return response.json();
  }

  async sendText(phone: string, text: string) {
    return this.request({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "text",
      text: { body: text }
    });
  }

  async sendDocument(phone: string, url: string, caption?: string) {
    return this.request({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "document",
      document: { link: url, caption }
    });
  }

  async sendTemplate(phone: string, templateName: string, vars: any[]) {
    return this.request({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "pt_BR" },
        components: vars.length ? [{
          type: "body",
          parameters: vars.map(v => ({ type: "text", text: v }))
        }] : []
      }
    });
  }
}

class ProviderFactory {
  static create(type: string, config: any, correlationId?: string): IWhatsAppProvider {
    if (type === 'META_OFFICIAL_PROVIDER') {
      return new MetaOfficialProvider(config.api_token, config.whatsapp_instance_id, correlationId);
    }
    return new ZApiProvider(
      config.api_endpoint || Deno.env.get('WHATSAPP_API_URL') || 'https://api.z-api.io',
      config.whatsapp_instance_id || Deno.env.get('WHATSAPP_INSTANCE_ID'),
      config.api_token || Deno.env.get('WHATSAPP_API_TOKEN'),
      config.whatsapp_client_token || Deno.env.get('WHATSAPP_CLIENT_TOKEN'),
      correlationId
    );
  }
}

async function check24hWindow(supabaseAdmin: any, clientId: string, officeId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('message_logs')
    .select('created_at')
    .eq('client_id', clientId)
    .eq('office_id', officeId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return false;
  
  const lastInboundMs = new Date(data.created_at).getTime();
  const nowMs = new Date().getTime();
  const diffHours = (nowMs - lastInboundMs) / (1000 * 60 * 60);
  return diffHours <= 24;
}

// ----------------------------------------------------
// WORKER EXECUTION
// ----------------------------------------------------
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const correlationId = crypto.randomUUID();
  const triggerSource = req.headers.get('user-agent')?.includes('PostgreSQL') ? 'cron_job' : 'manual_trigger';
  logger('info', 'Worker execution started', { correlationId, triggerSource });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration missing');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch pending notifications
    const { data: queue, error: queueError } = await supabaseAdmin
      .from('notificacoes_fila')
      .select('*')
      .eq('status', QueueStatus.PENDING)
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .limit(10);

    if (queueError) throw queueError;

    const results = [];

    for (const item of (queue || [])) {
      const itemContext = { notification_id: item.id, office_id: item.office_id, retry_count: item.retry_count || 0, correlationId };

      try {
        logger('info', 'Processing notification', itemContext);

        // 2. Set Status PROCESSING
        await supabaseAdmin.from('notificacoes_fila').update({ status: QueueStatus.PROCESSING, last_attempt_at: new Date().toISOString() }).eq('id', item.id);

        // 3. Hierarchical Config Resolution (context_type -> GLOBAL -> Fallback)
        const { data: rawConfigs } = await supabaseAdmin
          .from('notificacao_config')
          .select('*')
          .eq('office_id', item.office_id);

        const configs = (rawConfigs || []).filter(c => c.enabled !== false && c.api_token && c.api_token.trim() !== "");

        let config = null;
        let resolutionSource = 'none';

        if (configs && configs.length > 0) {
          // 3.1 Attempt specific context match
          config = configs.find((c: any) => c.context_type === item.context_type);
          if (config) {
            resolutionSource = `exact_match_${item.context_type}`;
          } else {
            // 3.2 Attempt GLOBAL fallback
            config = configs.find((c: any) => c.context_type === MessagingContext.GLOBAL);
            if (config) {
              resolutionSource = 'global_fallback';
            } else if (configs.length === 1) {
              // 3.3 Exclusive instance fallback (if only one exists, use it)
              config = configs[0];
              resolutionSource = 'single_instance_fallback';
            }
          }
        }

        // 4. Ultra-Fallback: Environment Variables (System Default)
        if (!config || !config.api_token) {
          const sysEndpoint = Deno.env.get('WHATSAPP_API_ENDPOINT');
          const sysToken = Deno.env.get('WHATSAPP_API_TOKEN');
          const sysInstance = Deno.env.get('WHATSAPP_INSTANCE_ID');
          
          if (sysEndpoint && sysToken) {
            config = {
              api_endpoint: sysEndpoint,
              api_token: sysToken,
              instance_id: sysInstance,
              provider_type: 'NON_OFFICIAL_PROVIDER' // Default for system fallback
            };
            resolutionSource = 'environment_variables';
          }
        }

        if (!config || !config.api_token) {
           throw { 
             message: 'No WhatsApp configuration found for this office (exact, global or system fallback).', 
             code: 'CONFIG_MISSING', 
             isPermanent: true 
           };
        }

        console.log(`[Worker] Configuration resolved via ${resolutionSource} for office ${item.office_id}`);
        const providerType = config.provider_type || 'NON_OFFICIAL_PROVIDER';
        
        if (!config.api_token || !config.whatsapp_instance_id) {
           throw { message: `Missing credentials for provider ${providerType}`, code: 'CONFIG_MISSING', isPermanent: true };
        }

        const provider = ProviderFactory.create(providerType, config, correlationId);

        // 4. Meta 24h Window Validation & Data preparation
        let clientId = item.payload_envio?.client_id;
        
        // Se não tiver clientId no payload, tentamos resolver via destinatário apenas se for estritamente necessário (Meta)
        if (!clientId && item.destinatario && providerType === 'META_OFFICIAL_PROVIDER') {
           const cleanPhone = item.destinatario.replace(/\D/g, '');
           const normPhone = cleanPhone.length >= 10 ? cleanPhone : null;
           
           if (normPhone) {
             const { data: clientData } = await supabaseAdmin
               .from('clients')
               .select('id')
               .eq('office_id', item.office_id) // Isolamento por escritório
               .or(`phone.ilike.%${normPhone},normalized_phone.ilike.%${normPhone}`)
               .maybeSingle();
             
             if (clientData) clientId = clientData.id;
           }
        }

        if (providerType === 'META_OFFICIAL_PROVIDER' && clientId) {
           const insideWindow = await check24hWindow(supabaseAdmin, clientId, item.office_id);
           if (!insideWindow && !item.template_id) {
              throw { message: 'META OFFICIAL: Outside 24h window. Must use APPROVED template.', code: 'OUTSIDE_WINDOW', isPermanent: true };
           }
        }

        // 5. Send logic
        let responseData;
        const cleanPhone = item.destinatario.replace(/\D/g, '');
        const messageId = item.id;
        
        let attachmentUrl = item.payload_envio?.static_attachments?.[0]; // from new payload format
        const isDocument = !!attachmentUrl;

        if (item.template_id && providerType === 'META_OFFICIAL_PROVIDER') {
            const { data: tpl } = await supabaseAdmin.from('message_templates').select('name').eq('id', item.template_id).single();
            if (!tpl) throw { message: 'Template not found', isPermanent: true };
            const vars = item.payload_envio?.template_vars || [];
            responseData = await provider.sendTemplate(cleanPhone, tpl.name, vars, messageId);
        } else if (isDocument && attachmentUrl) {
            responseData = await provider.sendDocument(cleanPhone, attachmentUrl, item.mensagem, messageId);
        } else if (item.template_id && providerType === 'NON_OFFICIAL_PROVIDER') {
            // Send compiled message content as text since Z-API handles it as normal text
            responseData = await provider.sendTemplate(cleanPhone, item.mensagem, [], messageId);
        } else {
            responseData = await provider.sendText(cleanPhone, item.mensagem, messageId);
        }

        // 6. Success Handling
        logger('info', 'Notification sent successfully', { ...itemContext, providerType });
        await supabaseAdmin.from('notificacoes_fila').update({ 
           status: QueueStatus.SENT, 
           resposta_provedor: responseData,
           retry_count: (item.retry_count || 0) + 1,
           last_error_code: null,
           last_error_message: null
        }).eq('id', item.id);

        if (item.payload_envio?.message_log_id) {
           await supabaseAdmin.from('message_logs').update({ 
             status: MessageLogStatus.SENT, 
             external_id: responseData?.messages?.[0]?.id || responseData?.messageId || item.id,
             provider: providerType === 'META_OFFICIAL_PROVIDER' ? 'whatsapp_meta' : 'whatsapp_zapi'
           }).eq('id', item.payload_envio.message_log_id);
        }

        results.push({ id: item.id, status: 'Success' });

      } catch (err: any) {
        // 7. Error Handling & Retry Backoff
        logger('error', 'Error processing notification', { ...itemContext, error: err });
        const retryCount = (item.retry_count || 0) + 1;
        const isPermanent = err.isPermanent || retryCount >= 5;
        
        const backoffMinutes = [1, 5, 15, 60, 240];
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + (backoffMinutes[retryCount - 1] || 240));

        await supabaseAdmin.from('notificacoes_fila').update({ 
            status: isPermanent ? QueueStatus.FAILED_PERMANENT : QueueStatus.PENDING,
            last_error_code: err.code || 'UNKNOWN',
            last_error_message: err.message,
            retry_count: retryCount,
            next_retry_at: isPermanent ? null : nextRetry.toISOString(),
            attempts_json: [...(item.attempts_json || []), { timestamp: new Date().toISOString(), error: err.message, code: err.code }]
        }).eq('id', item.id);

        if (isPermanent && item.payload_envio?.message_log_id) {
           await supabaseAdmin.from('message_logs').update({ status: MessageLogStatus.FAILED, metadata: { error: err.message } })
             .eq('id', item.payload_envio.message_log_id);
        }
        
        results.push({ id: item.id, status: isPermanent ? 'Permanent Failure' : 'Retry Scheduled' });
      }
    }

    return new Response(JSON.stringify({ success: true, results, correlationId, triggerSource }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    logger('error', 'Critical worker failure', { error: error.message, correlationId });
    return new Response(JSON.stringify({ error: error.message, correlationId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
