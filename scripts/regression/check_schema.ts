
import { createClient } from '@supabase/supabase-admin';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('🔍 Inspecionando Database...');
  
  // 1. Verificar Colunas em Pacientes
  const { data: cols, error: colErr } = await supabaseAdmin.rpc('get_table_columns_info', { t_name: 'pacientes' });
  
  if (colErr) {
    // Fallback se a RPC não existir
    const { data: testData, error: testErr } = await supabaseAdmin.from('pacientes').select('*').limit(1);
    const columns = testData && testData[0] ? Object.keys(testData[0]) : [];
    console.log('📊 Colunas em pacientes:', columns.join(', '));
  } else {
    console.log('📊 Colunas em pacientes:', cols.map(c => c.column_name).join(', '));
  }

  // 2. Verificar Triggers
  const { data: triggers, error: trigErr } = await supabaseAdmin.rpc('get_table_triggers', { t_name: 'clients' });
  console.log('🔫 Triggers em clients:', triggers?.map(t => t.trigger_name).join(', ') || 'Nenhum');

  // 3. Verificar Tipos
  const { data: types, error: typeErr } = await supabaseAdmin.rpc('get_enum_values', { enum_name: 'person_type' });
  console.log('🧬 Valores de person_type:', types || 'Não encontrado');
}

check();
