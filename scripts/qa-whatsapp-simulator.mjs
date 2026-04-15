import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const QA_OFFICE_ID = 'b5681abc-c101-4466-b684-4cf162d64973';
const STAGES = { NOVO_CONTATO: 'novo_contato', QUALIFICACAO: 'qualificacao' };

/**
 * Simulador de Entrada via Z-API
 */
async function simulateZapiInbound(phone, text) {
  console.log(`\n🚀 [QA Z-API Sim] Simulando webhook de ${phone}: "${text}"`);
  
  const externalId = 'zapi-sim-' + Date.now();
  const normalizedPhone = phone.replace(/\D/g, '');

  try {
    // 1. Simular Normalização (como no zapiProvider)
    const normalizedMessage = {
      id: externalId,
      phone: normalizedPhone,
      text: text,
      direction: 'inbound',
      timestamp: new Date().toISOString(),
      rawPayload: { simulated: true, provider: 'Z-API', id: externalId }
    };

    // 2. Executar Processamento (Replica lógica do whatsappProcessorService para Node)
    // Buscamos conversa
    let { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('id, lead_id')
      .eq('office_id', QA_OFFICE_ID)
      .eq('normalized_phone', normalizedPhone)
      .eq('status', 'active')
      .maybeSingle();

    if (!conv) {
      const { data: newConv, error: convErr } = await supabase
        .from('whatsapp_conversations')
        .insert({ office_id: QA_OFFICE_ID, normalized_phone: normalizedPhone, status: 'active' })
        .select().single();
      
      if (convErr) {
        console.error('❌ Erro ao criar conversa:', convErr.message);
        throw convErr;
      }
      conv = newConv;
    }

    // Identificar intenção
    const intent = identifyIntent(text);
    console.log(`🎯 Intenção Detectada: ${intent}`);

    // Persistir Inbound
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conv.id,
      office_id: QA_OFFICE_ID,
      external_id: externalId,
      direction: 'inbound',
      content: text,
      intent_detected: intent,
      sender_phone: normalizedPhone,
      metadata: normalizedMessage.rawPayload,
      processed_at: new Date().toISOString()
    });

    // Orquestrar CRM
    await handleCRM(normalizedPhone, intent, conv.id, text);

    // Simular Resposta (Outbound)
    const responseText = getResponse(intent);
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conv.id,
      office_id: QA_OFFICE_ID,
      direction: 'outbound',
      content: responseText,
      intent_detected: intent,
      receiver_phone: normalizedPhone,
      metadata: { simulated_response: true }
    });

    console.log(`🤖 IA Respondeu: "${responseText}"`);
    console.log(`✅ Fluxo Z-API Simulado com Sucesso.\n`);

  } catch (error) {
    console.error(`❌ Erro no simulador:`, error.message);
  }
}

function identifyIntent(text) {
  const t = text.toLowerCase();
  if (t.includes('humano') || t.includes('atendente')) return 'escalar_humano';
  if (t.includes('marcar') || t.includes('agendar') || t.includes('reunião') || t.includes('consulta')) return 'agendamento';
  if (t.includes('processo') || t.includes('andamento') || t.includes('meu caso')) return 'acompanhamento_processo';
  if (t.includes('ajuda') || t.includes('advogado') || t.includes('preciso') || t.includes('contratar')) return 'novo_lead';
  return 'duvida_geral';
}

function getResponse(intent) {
  const responses = {
    novo_lead: "Olá! Sou o assistente jurídico. Recebi seu interesse. Um especialista analisará em breve. Qual seu nome?",
    agendamento: "Claro! Posso ajudar com o agendamento. Prefere amanhã de manhã ou tarde?",
    acompanhamento_processo: "Consultando seu processo no sistema estruturado... Sem novidades no momento. Te aviso qualquer mudança!",
    escalar_humano: "Entendido. Vou passar sua conversa para um advogado agora.",
    duvida_geral: "Obrigado pelo contato! Como posso ajudar você hoje?"
  };
  return responses[intent] || responses.duvida_geral;
}

async function handleCRM(phone, intent, conversationId, text) {
  const { data: lead } = await supabase
    .from('crm_leads')
    .select('id, pipeline_stage')
    .eq('office_id', QA_OFFICE_ID)
    .eq('phone', phone)
    .maybeSingle();

  if (!lead) {
    const { data: newLead } = await supabase.from('crm_leads').insert({
      office_id: QA_OFFICE_ID,
      full_name: 'Lead Z-API (' + phone.slice(-4) + ')',
      phone: phone,
      pipeline_stage: STAGES.NOVO_CONTATO,
      source: 'WhatsApp',
      ai_summary: `Capturado via canal Z-API: "${text.slice(0, 30)}..."`
    }).select().single();

    await supabase.from('crm_activities').insert({
      lead_id: newLead.id,
      office_id: QA_OFFICE_ID,
      activity_type: 'whatsapp_capture',
      description: 'Captação automática via Z-API.',
      current_stage: STAGES.NOVO_CONTATO
    });

    await supabase.from('whatsapp_conversations').update({ lead_id: newLead.id }).eq('id', conversationId);
  } else if (intent === 'agendamento') {
    await supabase.from('crm_leads').update({ pipeline_stage: STAGES.QUALIFICACAO }).eq('id', lead.id);
    await supabase.from('crm_activities').insert({
      lead_id: lead.id,
      office_id: QA_OFFICE_ID,
      activity_type: 'automation_move',
      description: 'IA: Lead encaminhado após detecção de interesse real em agendamento.',
      previous_stage: lead.pipeline_stage,
      current_stage: STAGES.QUALIFICACAO
    });
  }
}

// CLI
const args = process.argv.slice(2);
const phone = args.find(a => a.startsWith('--phone='))?.split('=')[1] || '5511999998888';
const text = args.find(a => a.startsWith('--text='))?.split('=')[1] || 'Olá, quero agendar uma consulta';

simulateZapiInbound(phone, text);
