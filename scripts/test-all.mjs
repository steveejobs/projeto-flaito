import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const QA_INSTANCE_ID = 'zapi-qa-instance-001';

async function runOperationalTest() {
  console.log('🔍 [1] Verificando Tabelas e Cache...');
  const tables = ['whatsapp_instances', 'whatsapp_conversations', 'whatsapp_messages'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ ${table} (Erro): ${error.message} [${error.code}]`);
    } else {
      console.log(`✅ ${table}: Acessível`);
    }
  }

  console.log('\n🎯 [2] Testando Resolução de Instância...');
  const { data: inst, error: instError } = await supabase
    .from('whatsapp_instances')
    .select('office_id')
    .eq('instance_id', QA_INSTANCE_ID)
    .single();

  if (instError) {
    console.error('❌ Erro ao buscar instância de QA:', instError.message);
    process.exit(1);
  }
  const officeId = inst.office_id;
  console.log(`✅ Instância resolvida para Office: ${officeId}`);

  console.log('\n📲 [3] Testando Persistência com RLS/ServiceRole...');
  const phone = '5511777778888';
  const externalId = 'final-op-test-' + Date.now();

  try {
    // Criar Conversa
    const { data: conv, error: cError } = await supabase
      .from('whatsapp_conversations')
      .insert({ office_id: officeId, normalized_phone: phone })
      .select().single();
    if (cError) throw cError;
    console.log('✅ Conversa criada com sucesso.');

    // Inserir Mensagem Inbound (Idempotência)
    const { error: mError } = await supabase
      .from('whatsapp_messages')
      .insert({
        office_id: officeId,
        conversation_id: conv.id,
        external_id: externalId,
        direction: 'inbound',
        content: 'Teste operacional final',
        intent_detected: 'duvida_geral',
        sender_phone: phone
      });
    if (mError) throw mError;
    console.log('✅ Mensagem Inbound persistida com sucesso.');

    console.log('\n🏁 RESULTADO: AMBIENTE OPERACIONAL VALIDADO.');
  } catch (err) {
    console.error('\n❌ ERRO NA PERSISTÊNCIA REAIS:', err.message);
    if (err.code === 'PGRST205') {
       console.log('⚠️ Dica: O cache do Supabase ainda está travado. Tente rodar a migração novamente ou esperar 5 min.');
    }
  }
}

runOperationalTest();
