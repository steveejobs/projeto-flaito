import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) { console.error(error); return; }
  
  console.log(`Total de usuários: ${users.length}`);
  
  const today = new Date('2026-04-17T00:00:00Z');
  const recent = users.filter(u => new Date(u.created_at) >= today);
  
  console.log(`Usuários criados hoje: ${recent.length}`);
  recent.forEach(u => {
    console.log(`- ${u.email} (ID: ${u.id}, Confirmação: ${u.email_confirmed_at ? 'SIM' : 'NÃO'})`);
  });

  if (recent.length > 0) {
      console.log('\nConfirmando todos os usuários de hoje...');
      for (const u of recent) {
          if (!u.email_confirmed_at) {
              await supabase.auth.admin.updateUserById(u.id, { email_confirm: true });
              console.log(`Confirmado: ${u.email}`);
          }
      }
  }
}
check();
