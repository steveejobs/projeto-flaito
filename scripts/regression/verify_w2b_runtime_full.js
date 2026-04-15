import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function verifyRuntime() {
  console.log('--- STARTING COMPREHENSIVE WAVE 2B RUNTIME VALIDATION ---');

  // 1. Setup Office & Agent
  console.log('\n[TEST 1] Testing Published Selection & Flow Run Creation...');
  const officeId = '00000000-0000-0000-0000-000000000001'; // Static for test or create new
  
  // Clean up old test data for this office
  await supabaseAdmin.from('flow_runs').delete().eq('office_id', officeId);
  await supabaseAdmin.from('agent_profiles').delete().eq('office_id', officeId);
  await supabaseAdmin.from('automation_flows').delete().eq('office_id', officeId);
  await supabaseAdmin.from('whatsapp_conversations').delete().eq('office_id', officeId);

  const { data: office } = await supabaseAdmin.from('offices').upsert({
    id: officeId,
    name: 'W2B Test Office',
    office_type: 'LEGAL'
  }).select().single();

  const { data: flow } = await supabaseAdmin.from('automation_flows').insert({
    office_id: officeId,
    name: 'W2B Master Flow',
    is_active: true
  }).select().single();

  const definition = {
    nodes: [
      { id: 'start-node', type: 'message', label: 'Welcome', config: { text: 'Robot Response v1' } }
    ]
  };

  const { data: version } = await supabaseAdmin.from('flow_versions').insert({
    flow_id: flow.id,
    office_id: officeId,
    version_number: 1,
    status: 'published',
    definition_json: definition
  }).select().single();

  const { data: agent } = await supabaseAdmin.from('agent_profiles').insert({
    office_id: officeId,
    name: 'W2B Auditor Bot',
    is_active: true,
    default_flow_id: flow.id,
    fallback_message: 'Audit Fallback'
  }).select().single();

  const { data: instance } = await supabaseAdmin.from('whatsapp_instances').upsert({
    office_id: officeId,
    instance_id: 'w2b_verify_inst',
    label: 'Auditor Device',
    instance_token: 'test_token',
    is_active: true
  }).select().single();

  // Triggering the webhook
  const msgId = 'msg_' + Date.now();
  console.log(`Sending message ${msgId}...`);
  
  const r = await fetch('https://ccvbosbjtlxewqybvwqj.supabase.co/functions/v1/whatsapp-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: msgId,
      phone: '5511999999999',
      instanceId: 'w2b_verify_inst',
      text: { message: 'Auditor request' }
    })
  });

  console.log('Webhook Status:', r.status);

  // Verification 1: Selection & Run
  await new Promise(res => setTimeout(res, 3000));
  const { data: run } = await supabaseAdmin.from('flow_runs').select('*').eq('office_id', officeId).order('started_at', { ascending: false }).limit(1).single();
  
  if (run && run.version_id === version.id) {
    console.log('✅ TEST 1 PASSED: flow_run created with correct published version.');
  } else {
    console.log('❌ TEST 1 FAILED: flow_run missing or wrong version.', run?.version_id);
  }

  // Verification 2: Status Reflection
  const { data: conv } = await supabaseAdmin.from('whatsapp_conversations').select('status').eq('office_id', officeId).single();
  console.log('Conversation Status:', conv?.status);
  if (conv?.status === 'respondida_ia') {
    console.log('✅ TEST 2 PASSED: Inbox status updated to respondida_ia.');
  } else {
    console.log('❌ TEST 2 FAILED: Wrong status.');
  }

  // Verification 3: Idempotency
  console.log('\n[TEST 3] Testing Idempotency (resending same messageId)...');
  await fetch('https://ccvbosbjtlxewqybvwqj.supabase.co/functions/v1/whatsapp-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: msgId,
      phone: '5511999999999',
      instanceId: 'w2b_verify_inst',
      text: { message: 'Auditor request' }
    })
  });
  
  const { data: runs } = await supabaseAdmin.from('flow_runs').select('id').eq('metadata->>entry_message_id', msgId);
  if (runs.length === 1) {
    console.log('✅ TEST 3 PASSED: Idempotency blocked duplicate flow_run.');
  } else {
    console.log('❌ TEST 3 FAILED: Duplicate flow_run created!', runs.length);
  }

  // Verification 4: Handoff & CRM
  console.log('\n[TEST 4] Testing Handoff & CRM reflection...');
  const handoffDef = {
    nodes: [
      { id: 'start-node', type: 'handoff', label: 'Escalate to human' }
    ]
  };
  const { data: v2 } = await supabaseAdmin.from('flow_versions').insert({
    flow_id: flow.id,
    office_id: officeId,
    version_number: 2,
    status: 'published',
    definition_json: handoffDef
  }).select().single();

  const msgId2 = 'msg_handoff_' + Date.now();
  await fetch('https://ccvbosbjtlxewqybvwqj.supabase.co/functions/v1/whatsapp-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: msgId2,
      phone: '5511777777777',
      instanceId: 'w2b_verify_inst',
      text: { message: 'I need a human' }
    })
  });

  await new Promise(res => setTimeout(res, 3000));
  const { data: conv2 } = await supabaseAdmin.from('whatsapp_conversations').select('status').eq('normalized_phone', '5511777777777').single();
  const { data: lead } = await supabaseAdmin.from('crm_leads').select('*').eq('phone', '5511777777777').single();
  
  if (conv2?.status === 'humano_necessario' && lead) {
    console.log('✅ TEST 4 PASSED: Handoff updated status and created CRM lead.');
  } else {
    console.log('❌ TEST 4 FAILED: Handoff/CRM mismatch.', conv2?.status, !!lead);
  }

  console.log('\n--- VALIDATION COMPLETE ---');
}

verifyRuntime().catch(console.error);
