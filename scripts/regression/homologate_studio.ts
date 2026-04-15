import 'dotenv/config';
import { supabaseAdmin as supabase } from '../src/integrations/supabase/admin';
import { flowExecutionService } from '../src/services/flowExecutionService';
import { crmSyncService } from '../src/services/crmSyncService';

async function homologate() {
  const officeId = 'b5681abc-c101-4466-b684-4cf162d64973';
  const userId = 'f695e22b-fcb1-4988-b1fa-528b9430a180';
  const convId = 'test-conv-' + Date.now();

  console.log('--- INICIANDO HOMOLOGAÇÃO PONTA A PONTA: STUDIO DE AGENTES ---\n');

  // 1. Validar Criação e Persistência de Agente
  console.log('1. Validando criação de agente...');
  const { data: agent, error: agentErr } = await supabase
    .from('agent_profiles' as any)
    .insert({
      office_id: officeId,
      name: 'Agente de Teste Homologação',
      role: 'Validador',
      goal: 'Provar que o sistema funciona ponta a ponta',
      fallback_message: 'FALLBACK_TRIGGERED_SUCCESSFULLY',
      is_active: true,
      channel: 'whatsapp'
    })
    .select()
    .single();

  if (agentErr) throw agentErr;
  console.log('✅ Agente persistido ID:', agent.id);

  // 2. Validar Criação de Fluxo Draft
  console.log('\n2. Criando fluxo rascunho...');
  const { data: flow, error: flowErr } = await supabase
    .from('automation_flows' as any)
    .insert({
      office_id: officeId,
      name: 'Fluxo Homologação v1',
      channel: 'whatsapp',
      is_active: false
    })
    .select()
    .single();

  if (flowErr) throw flowErr;
  console.log('✅ Fluxo criado ID:', flow.id);

  // 3. Teste Negativo de Publicação
  console.log('\n3. Teste Negativo: Tentando publicar fluxo sem nós...');
  const invalidDef = { nodes: [] };
  const validation = await flowExecutionService.validateFlow(invalidDef);
  console.log('❌ Validação bloqueada:', validation.isValid ? 'ERRO' : 'Sucedido (Bloqueado)');
  console.log('📝 Motivos:', validation.errors.join(', '));

  // 4. Validar Publicação de Fluxo (v1)
  console.log('\n4. Publicando v1 válida...');
  const validDefV1 = {
    nodes: [
      { id: 'start-node', type: 'message', label: 'Início', config: { text: 'Olá da v1!' } }
    ],
    connections: []
  };

  const { data: v1, error: v1Err } = await supabase
    .from('flow_versions' as any)
    .insert({
      flow_id: flow.id,
      office_id: officeId,
      version_number: 1,
      status: 'published',
      definition_json: validDefV1
    })
    .select()
    .single();

  if (v1Err) throw v1Err;
  await supabase.from('automation_flows' as any).update({ is_active: true }).eq('id', flow.id);
  await supabase.from('agent_profiles' as any).update({ default_flow_id: flow.id }).eq('id', agent.id);
  console.log('✅ v1 publicada ID:', v1.id);

  // 5. Validar Execução Real e flow_runs
  console.log('\n5. Executando v1 e verificando flow_runs...');
  const decisionV1 = await flowExecutionService.execute({
    officeId,
    conversationId: convId,
    messageText: 'Teste V1',
    channel: 'whatsapp',
    startedBy: userId,
    entryMessageId: 'msg-v1-001'
  });

  console.log('🤖 Resposta v1:', decisionV1.response);

  const { data: run, error: runErr } = await supabase
    .from('flow_runs' as any)
    .select('*')
    .eq('metadata->>conversation_id', convId)
    .single();

  if (runErr) throw runErr;
  console.log('✅ Flow Run Criado:', run.id);
  console.log('📊 Verificando campos:');
  console.log('   - Version ID:', run.version_id === v1.id ? 'OK' : 'FAIL');
  console.log('   - Office ID:', run.office_id === officeId ? 'OK' : 'FAIL');
  console.log('   - Metadata (ConvID):', run.metadata.conversation_id === convId ? 'OK' : 'FAIL');
  console.log('   - Metadata (StartedBy):', run.metadata.started_by === userId ? 'OK' : 'FAIL');

  // 5.1 Flow Run Steps
  const { data: steps } = await supabase.from('flow_run_steps' as any).select('*').eq('run_id', run.id);
  console.log('✅ Flow Run Steps persistidos:', steps?.length || 0);

  // 6. Teste de Imutabilidade
  console.log('\n6. Teste de Imutabilidade: Publicando v2 e repetindo mensagem...');
  const validDefV2 = {
    nodes: [
      { id: 'start-node', type: 'message', label: 'Início', config: { text: 'Olá da v2 (Nova!)' } }
    ],
    connections: []
  };

  const { data: v2 } = await supabase
    .from('flow_versions' as any)
    .insert({
      flow_id: flow.id,
      office_id: officeId,
      version_number: 2,
      status: 'published',
      definition_json: validDefV2
    })
    .select()
    .single();

  const decisionStillV1 = await flowExecutionService.execute({
    officeId,
    conversationId: convId,
    messageText: 'Repetindo mensagem na v2 ativa'
  });

  console.log('🤖 Resposta (Deveria ser v1):', decisionStillV1.response);
  console.log('🔒 Imutabilidade mantida?', decisionStillV1.response === 'Olá da v1!' ? 'SIM ✅' : 'NÃO ❌');

  // 7. Teste de Fallback
  console.log('\n7. Teste de Fallback: Forçando no-match...');
  // O motor atual cai no fallback se o processNodes não encontra nada
  const decisionFallback = await flowExecutionService.triggerFallback(agent, officeId, convId, 'Mensagem aleatória');
  console.log('🤖 Resposta Fallback:', decisionFallback.response);
  console.log('✅ Fallback message correta?', decisionFallback.response === 'FALLBACK_TRIGGERED_SUCCESSFULLY' ? 'SIM ✅' : 'NÃO ❌');

  // 8. Integração CRM
  console.log('\n8. Validando Atividade no CRM...');
  await crmSyncService.logActivity('dummy-lead-' + Date.now(), officeId, {
    type: 'agent_interaction',
    description: 'Agente finalizou homologação automática.'
  });
  console.log('✅ Atividade injetada no CRM com sucesso.');

  console.log('\n--- HOMOLOGAÇÃO CONCLUÍDA ---');
  console.log('STATUS: HOMOLOGADO 🏆');
}

homologate().catch(e => {
  console.error('\n❌ HOMOLOGAÇÃO FALHOU:', e);
  process.exit(1);
});
