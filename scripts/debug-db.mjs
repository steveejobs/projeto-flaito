import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugInsert() {
  console.log('🧪 Iniciando insert de teste...');
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .insert({
      office_id: 'b5681abc-c101-4466-b684-4cf162d64973',
      normalized_phone: 'debug_test',
      status: 'active'
    })
    .select();

  if (error) {
    console.error('❌ Resposta do DB:', error.message);
    console.error('❌ Código:', error.code);
  } else {
    console.log('✅ Sucesso! Tabela reconhecida e acessível.');
    console.log('Data:', data);
  }
}

debugInsert();
