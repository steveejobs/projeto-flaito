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
const QA_INSTANCE_ID = 'zapi-qa-instance-001';
const QA_TOKEN = 'zapi-qa-token-secret';

async function seedInstance() {
  console.log('🌱 Provisionando Instância de Teste Z-API...');
  
  const { data, error } = await supabase
    .from('whatsapp_instances')
    .upsert({
      office_id: QA_OFFICE_ID,
      instance_id: QA_INSTANCE_ID,
      instance_token: QA_TOKEN,
      metadata: { env: 'qa-simulator' }
    }, { onConflict: 'instance_id' })
    .select();

  if (error) {
    console.error('❌ Erro no seed:', error.message);
  } else {
    console.log('✅ Instância vinculada ao Office:', QA_OFFICE_ID);
    console.log('ID do Registro:', data[0].id);
  }
}

seedInstance();
