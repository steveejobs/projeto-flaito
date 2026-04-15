import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
          reject(new Error(`RPC ${name} failed (${res.statusCode}): ${body}`));
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Running Test Suite (Checking if functions exist and work)...');
  
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

  let allPassed = true;

  for (const tc of testCases) {
    try {
        const result = await callRpc('render_template_preview_raw', {
            p_content: tc.template,
            p_data: tc.data
        });

        // result is the raw string returned by the RPC
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

  if (allPassed) {
    console.log('\n✅ ALL TESTS PASSED! The engine is fully functional.');
  } else {
    console.error('\n❌ SOME TESTS FAILED. Please check the logs.');
    process.exit(1);
  }
}

runTests();
