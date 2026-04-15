
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTypes() {
  console.log('🔍 Identificando Tipos de Dados Reais...');
  
  const query = `
    SELECT table_name, column_name, udt_name 
    FROM information_schema.columns 
    WHERE table_name IN ('clients', 'pacientes') 
    AND column_name IN ('person_type', 'marital_status');
  `;

  // Podemos usar query direta se houver uma RPC genérica, 
  // senão tentamos inferir via select
  try {
    const { data: clients, error: e1 } = await supabaseAdmin.from('clients').select('person_type, marital_status').limit(1);
    const { data: pacientes, error: e2 } = await supabaseAdmin.from('pacientes').select('person_type, marital_status').limit(1);
    
    console.log('Dados Clientes:', clients);
    console.log('Dados Pacientes:', pacientes);
  } catch (e) {
    console.log('Erro ao ler colunas:', e.message);
  }
}

checkTypes();
