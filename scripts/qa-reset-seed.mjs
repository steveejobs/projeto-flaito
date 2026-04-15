import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis do Supabase não encontradas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ID do Escritório de QA (Fixo para segurança)
const QA_OFFICE_ID = 'b5681abc-c101-4466-b684-4cf162d64973';
const QA_USER_ID = 'f695e22b-fcb1-4988-b1fa-528b9430a180';

async function resetAndSeed() {
  console.log('🚀 [QA] Iniciando Reset + Seed do Ambiente...');
  console.log(`📍 Escritório Alvo: ${QA_OFFICE_ID}`);

  try {
    // 1. Limpeza Determinística (Apenas do office de QA)
    console.log('🧹 Limpando dados antigos...');
    
    // Ordem importa por causa de FKs
    console.log('🧹 Limpando dados operacionais...');
    await supabase.from('agenda_medica').delete().eq('office_id', QA_OFFICE_ID);
    await supabase.from('nija_sessions').delete().eq('office_id', QA_OFFICE_ID);
    await supabase.from('cases').delete().eq('office_id', QA_OFFICE_ID);
    
    console.log('🧹 Limpando dados de CRM (se existirem)...');
    // Usamos try/catch simples pois as tabelas podem ainda não ter sido migradas no banco alvo
    try {
      await supabase.from('crm_activities').delete().eq('office_id', QA_OFFICE_ID);
      await supabase.from('crm_leads').delete().eq('office_id', QA_OFFICE_ID);
    } catch (e) {
      console.log('⚠️ Tabelas de CRM ainda não migradas, pulando limpeza.');
    }

    await supabase.from('clients').delete().eq('office_id', QA_OFFICE_ID);

    console.log('✅ Limpeza concluída.');

    // 2. Seed Mínimo
    console.log('🌱 Semeando dados de teste...');

    // Inserir Cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        full_name: 'JOÃO DA SILVA - QA AUTOMATION',
        cpf: '000.000.000-00',
        email: 'qa-client@test.com',
        phone: '(11) 99999-9999',
        office_id: QA_OFFICE_ID,
        created_by: QA_USER_ID,
        status: 'ACTIVE'
      })
      .select()
      .single();

    if (clientError) throw clientError;
    console.log(`👤 Cliente Seed: ${client.full_name} (${client.id})`);

    // Inserir Caso
    const { data: caseItem, error: caseError } = await supabase
      .from('cases')
      .insert({
        title: 'AÇÃO DE COBRANÇA - QA 001',
        client_id: client.id,
        office_id: QA_OFFICE_ID,
        area: 'CIVIL',
        status: 'ACTIVE',
        created_by: QA_USER_ID,
        internal_id: 'f6d90a1c-3b5e-4903-8898-8f58b9f0e395'
      })
      .select()
      .single();

    if (caseError) throw caseError;
    console.log(`⚖️  Caso Seed: ${caseItem.title} (${caseItem.id})`);

    console.log('✨ [QA] Ambiente resetado e semeado com sucesso!');
  } catch (error) {
    console.error('❌ [QA] Erro fatal no Reset/Seed:', error.message);
    process.exit(1);
  }
}

resetAndSeed();
