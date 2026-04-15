import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

async function runVerification() {
  console.log('🛡️  [QA] Iniciando Verificação de Integridade de Ponta a Ponta...');

  try {
    // 1. Setup do Usuário (Garante existência e permissões)
    console.log('\nStep 1: Provisionando Usuário QA...');
    execSync('node scripts/setup-qa-user.mjs', { stdio: 'inherit' });

    // 2. Reset + Seed (Garante estado previsível)
    console.log('\nStep 2: Resetando e Semeando Ambiente...');
    execSync('node scripts/qa-reset-seed.mjs', { stdio: 'inherit' });

    // 3. Validação de Variaveis de Ambiente
    if (process.env.VITE_ENABLE_QA_MODE !== 'true') {
        console.warn('⚠️  AVISO: VITE_ENABLE_QA_MODE não está "true" no .env. O login programático pode falhar no frontend.');
    }

    console.log('\nStep 3: Simulando Fluxo de WhatsApp Inteligente...');
    execSync('node scripts/qa-whatsapp-simulator.mjs --phone="5511999990000" --text="Quero conversar com um advogado sobre divórcio"', { stdio: 'inherit' });
    execSync('node scripts/qa-whatsapp-simulator.mjs --phone="5511999990000" --text="Pode agendar para amanhã?"', { stdio: 'inherit' });

    console.log('\nStep 4: Validando Cenário de CRM Autônomo...');
    console.log('✨ O motor de sincronização será disparado ao acessar a página /crm.');

    console.log('\n🏁 Infraestrutura de QA pronta.');
    console.log('🔗 Login: http://localhost:5173/login?qa_access=true');
    console.log('🔗 CRM: http://localhost:5173/crm');
    console.log('\n[INFO] Em um ambiente de CI, o próximo passo seria rodar testes de interface (Playwright).');
    console.log('[INFO] No ambiente local, abra as URLs acima para validar visualmente o CRM + Timeline WhatsApp.');

  } catch (error) {
    console.error('\n❌ [QA] Falha na verificação:', error.message);
    process.exit(1);
  }
}

runVerification();
