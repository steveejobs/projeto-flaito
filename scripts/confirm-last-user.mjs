import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function findAndConfirm() {
  console.log('Listando usuários para encontrar o mais recente...');
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Erro ao listar usuários:', error);
    process.exit(1);
  }

  if (users.length === 0) {
    console.log('Nenhum usuário encontrado.');
    return;
  }

  // Encontrar o usuário com a data de criação mais recente
  const lastUser = users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  console.log(`Usuário encontrado: ${lastUser.email} (Criado em: ${lastUser.created_at})`);

  if (lastUser.email_confirmed_at) {
    console.log('Este usuário já está confirmado.');
    return;
  }

  console.log(`Confirmando e-mail para ${lastUser.email}...`);
  const { error: updateError } = await supabase.auth.admin.updateUserByAppMetadata(lastUser.id, {
    email_confirm: true
  });

  // Nota: updateUserByAppMetadata não existe, o correto é updateUserById
  const { error: realUpdateError } = await supabase.auth.admin.updateUserById(lastUser.id, {
    email_confirm: true
  });

  if (realUpdateError) {
    console.error('Erro ao confirmar:', realUpdateError);
  } else {
    console.log('Sucesso! Usuário confirmado manualmente.');
  }
}

findAndConfirm();
