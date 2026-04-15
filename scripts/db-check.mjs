import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  const tables = ['crm_leads', 'crm_activities', 'whatsapp_conversations', 'whatsapp_messages'];
  console.log('🔍 Verificando presença de tabelas no banco...');

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
       if (error.code === 'PGRST116' || error.message.includes('not found') || error.message.includes('does not exist')) {
         console.log(`❌ ${table}: Não existe`);
       } else {
         console.log(`⚠️ ${table}: Erro desconhecido: ${error.message} (${error.code})`);
       }
    } else {
       console.log(`✅ ${table}: Pronta`);
    }
  }
}

checkTables();
