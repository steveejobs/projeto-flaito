import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env from root
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Erro: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos em .env');
  process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.split('//')[1].split('.')[0];

async function callRpc(name, params) {
  const data = JSON.stringify(params);
  const options = {
    hostname: `${PROJECT_REF}.supabase.co`,
    port: 443,
    path: `/rest/v1/rpc/${name}`,
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : {});
        } else {
          console.error(`❌ RPC Error Body: ${body}`);
          reject(new Error(`RPC ${name} failed (${res.statusCode}): ${body}`));
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

// Helper para rodar SQL via RPC interna execute_db_sql (que sabemos que existe no Flaito)
async function executeSql(sql) {
    return callRpc('execute_db_sql', { sql_query: sql });
}

async function runValidation() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 GSD ► VALIDATING TEMPLATE ENGINE RESTORATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Aplicar Migration
  const migrationPath = './supabase/migrations/20260408160000_restore_template_engine.sql';
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📦 Step 1: Applying Migration...');
  try {
    await executeSql(sql);
    console.log('✅ Migration applied successfully!\n');
  } catch (e) {
    console.error('❌ Error applying migration:', e.message);
    process.exit(1);
  }

  // 2. Bateria de Testes
  const testCases = [
    {
      id: 'T1',
      name: 'Variável Simples',
      template: 'Olá {{name}}!',
      data: { name: 'João' },
      expected: 'Olá João!'
    },
    {
      id: 'T2',
      name: 'Variável Aninhada',
      template: 'Documento: {{client.info.id}}',
      data: { client: { info: { id: 'BR-99' } } },
      expected: 'Documento: BR-99'
    },
    {
      id: 'T3',
      name: 'Condicional Verdadeira',
      template: '{{#if public}}PÚBLICO{{/if}}',
      data: { public: true },
      expected: 'PÚBLICO'
    },
    {
      id: 'T4',
      name: 'Condicional Falsa',
      template: 'INÍCIO{{#if hide}}OCULTO{{/if}}FIM',
      data: { hide: false },
      expected: 'INÍCIOFIM'
    },
    {
      id: 'T5',
      name: 'Triple Braces (HTML)',
      template: 'Logo: {{{sign}}}',
      data: { sign: '<img src="ok.png">' },
      expected: 'Logo: <img src="ok.png">'
    },
    {
      id: 'T6',
      name: 'Limpeza de Placeholders',
      template: 'Valor: {{missing}}.',
      data: {},
      expected: 'Valor: .'
    }
  ];

  console.log('🧪 Step 2: Running Test Suite...');
  
  let allPassed = true;

  for (const tc of testCases) {
    try {
        const result = await callRpc('render_template_preview_raw', {
            p_content: tc.template,
            p_data: tc.data
        });

        const passed = result && result.trim() === tc.expected.trim();
        
        if (passed) {
          console.log(`✅ [${tc.id}] ${tc.name}: PASSED`);
        } else {
          console.log(`❌ [${tc.id}] ${tc.name}: FAILED`);
          console.log(`   - Expected: "${tc.expected}"`);
          console.log(`   - Actual:   "${result}"`);
          allPassed = false;
        }
    } catch (e) {
      console.error(`❌ [${tc.id}] ${tc.name} FAILED with error:`, e.message);
      allPassed = false;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏁 FINAL VERDICT: ${allPassed ? 'VALIDATED ✅' : 'FAILED ❌'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!allPassed) process.exit(1);
}

runValidation();
