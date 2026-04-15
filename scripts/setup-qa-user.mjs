import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Erro: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const QA_EMAIL = 'qa-automation@flaito.com.br';
const QA_PASSWORD = 'QA_password_123!';

async function setup() {
  console.log(`[QA Setup] Iniciando configuração para: ${QA_EMAIL}`);

  // 1. Verificar se usuário existe
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Erro ao listar usuários:', listError);
    return;
  }

  const existingUser = users.find(u => u.email === QA_EMAIL);

  if (existingUser) {
    console.log(`[QA Setup] Usuário já existe (ID: ${existingUser.id}). Atualizando confirmação de e-mail...`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      user_metadata: { is_qa: true }
    });

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError);
    } else {
      console.log('[QA Setup] Usuário atualizado com sucesso.');
    }
  } else {
    console.log('[QA Setup] Criando novo usuário de QA...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: QA_EMAIL,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: { is_qa: true }
    });

    if (createError) {
      console.error('Erro ao criar usuário:', createError);
      return;
    }
    console.log(`[QA Setup] Usuário criado com sucesso (ID: ${newUser.user.id}).`);
  }

  // 2. Garantir Office (Backend Alignment)
  console.log('[QA Setup] Garantindo escritório pessoal para o usuário de QA...');
  const userId = existingUser ? existingUser.id : newUser.user.id;

  // Verificar se já tem escritório em office_members
  const { data: membership, error: memberError } = await supabase
    .from('office_members')
    .select('office_id')
    .eq('user_id', userId)
    .single();

  if (membership) {
    console.log(`[QA Setup] Usuário já possui um escritório (ID: ${membership.office_id}).`);
  } else {
    console.log('[QA Setup] Criando escritório pessoal e vincunlando ao usuário...');
    
    // Inserir escritório
    const { data: office, error: officeError } = await supabase
      .from('offices')
      .insert({ 
        name: 'QA Automation Office', 
        metadata: { is_qa: true, is_personal: true } 
      })
      .select()
      .single();

    if (officeError) {
      console.error('[QA Setup] Erro ao criar escritório:', officeError);
      return;
    }

    // Inserir membro
    const { error: joinError } = await supabase
      .from('office_members')
      .insert({
        office_id: office.id,
        user_id: userId,
        role: 'OWNER',
        is_active: true
      });

    if (joinError) {
      console.error('[QA Setup] Erro ao vincular usuário ao escritório:', joinError);
    } else {
      console.log(`[QA Setup] Escritório criado e vinculado com sucesso (Office ID: ${office.id}).`);
    }
  }

  console.log('[QA Setup] Setup completo. O usuário de QA está pronto para o Smoke Test.');
}

setup();
