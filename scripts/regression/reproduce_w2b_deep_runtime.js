import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function reproduceDeepRuntime() {
  console.log('--- STARTING W2B DEEP RUNTIME REPRODUCTION ---');

  // 1. Setup Test Data
  console.log('\n[SETUP] Creating test data...');
  const { data: office, error: offErr } = await supabaseAdmin.from('offices').insert({
    name: 'W2B Deep Runtime Office',
    office_type: 'LEGAL',
    is_personal: false
  }).select().single();
  if (offErr) console.error('Office Error:', offErr);

  const { data: flow, error: flowErr } = await supabaseAdmin.from('automation_flows').insert({
    office_id: office?.id,
    name: 'Test Flow',
    is_active: true
  }).select().single();
  if (flowErr) console.error('Flow Error:', flowErr);

  const definition = {
    nodes: [
      { id: 'start-node', type: 'message', label: 'Welcome', config: { text: 'Hello! How can I help you today?' } },
      { id: 'node-2', type: 'handoff', label: 'Escalate', config: {} }
    ],
    edges: [
      { id: 'e1', source: 'start-node', target: 'node-2' }
    ]
  };

  const { data: version, error: verErr } = await supabaseAdmin.from('flow_versions').insert({
    flow_id: flow?.id,
    office_id: office?.id,
    version_number: 1,
    status: 'published',
    definition_json: definition
  }).select().single();
  if (verErr) console.error('Version Error:', verErr);

  const { data: agent, error: agErr } = await supabaseAdmin.from('agent_profiles').insert({
    office_id: office?.id,
    name: 'Test Agent',
    is_active: true,
    default_flow_id: flow?.id,
    handoff_policy: 'always_human',
    fallback_message: 'Oops, falling back.'
  }).select().single();
  if (agErr) console.error('Agent Error:', agErr);

  const { data: instance, error: instErr } = await supabaseAdmin.from('whatsapp_instances').insert({
    office_id: office?.id,
    instance_id: 'w2b_deep_inst_' + Date.now(),
    label: 'Deep Test Device',
    instance_token: 'test_token',
    is_active: true
  }).select().single();
  if (instErr) console.error('Instance Error:', instErr);

  console.log('Setup complete. Testing Published Flow Selection...');

  // 2. Trigger Webhook (Simulated)
  const webhookUrl = 'https://ccvbosbjtlxewqybvwqj.supabase.co/functions/v1/whatsapp-webhook';
  const payload = {
    messageId: 'w2b_test_msg_' + Date.now(),
    phone: '5511888888888',
    instanceId: instance?.instance_id,
    text: { message: 'Start flow' }
  };

  const r = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('Webhook Status:', r.status);
  const result = await r.json();
  console.log('Webhook Result:', result);

  // 3. Evidence Collection
  console.log('\n--- EVIDENCE COLLECTION ---');
  
  // Wait a bit for async processing if any
  await new Promise(res => setTimeout(res, 3000));

  const { data: conv } = await supabaseAdmin.from('whatsapp_conversations').select('*').eq('office_id', office?.id).maybeSingle();
  console.log('Conversation:', conv ? 'CREATED' : 'MISSING');

  const { data: run } = await supabaseAdmin.from('flow_runs').select('*').eq('office_id', office?.id).maybeSingle();
  console.log('Flow Run:', run ? 'CREATED' : 'MISSING');
  if (run) {
    console.log('Selected Version ID:', run.version_id);
    console.log('Selected Agent ID:', run.agent_id);
  } else {
     // Check if there are ANY flow_runs in case office_id was missed (though I sent it)
     const { data: anyRun } = await supabaseAdmin.from('flow_runs').select('*').limit(1).order('started_at', { ascending: false });
     console.log('Last flow_run in DB:', anyRun?.[0]?.office_id === office?.id ? 'Matches our office' : 'DIFFERENT OFFICE');
  }

  const { data: steps } = await supabaseAdmin.from('flow_run_steps').select('*').eq('run_id', run?.id);
  console.log('Flow Run Steps:', steps?.length || 0);
  if (steps) {
    steps.forEach(s => console.log(`Step: ${s.node_label} (${s.node_type})`));
  }

  console.log('\n--- EVALUATION ---');
  if (!run) {
    console.log('🔴 REPRODUCTION CONCLUSION: flow_run was NOT created.');
  } else if (steps?.length === 0) {
    console.log('🔴 REPRODUCTION CONCLUSION: flow_run_steps were NOT created.');
  } else {
    console.log('🟢 REPRODUCTION CONCLUSION: Published flow selection, run, and steps creation working.');
  }
}

reproduceDeepRuntime().catch(console.error);
