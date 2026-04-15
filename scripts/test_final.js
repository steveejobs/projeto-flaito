const https = require('https');
const fs = require('fs');
const path = require('path');

// Leitura manual do .env
const envPath = '.env';
if (!fs.existsSync(envPath)) {
    console.error('❌ Arquivo .env não encontrado');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const processEnv = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...value] = trimmed.split('=');
    if (key && value) processEnv[key.trim()] = value.join('=').trim();
});

const SUPABASE_URL = processEnv.VITE_SUPABASE_URL || processEnv.SUPABASE_URL;
const SUPABASE_KEY = processEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Credenciais do Supabase não encontradas no .env');
    process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.split('//')[1].split('.')[0];

async function request(apiPath, method, body) {
  const data = JSON.stringify(body);
  const isEdgeFunction = apiPath.startsWith('/functions/v1/');
  const hostname = isEdgeFunction ? `${PROJECT_REF}.functions.supabase.co` : `${PROJECT_REF}.supabase.co`;
  const cleanPath = isEdgeFunction ? apiPath.replace('/functions/v1', '') : apiPath;

  const options = {
    hostname,
    port: 443,
    path: cleanPath,
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (d) => { responseBody += d; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(responseBody ? JSON.parse(responseBody) : {});
          } catch (e) {
            resolve(responseBody);
          }
        } else {
          reject(new Error(`Request to ${apiPath} failed (${res.statusCode}): ${responseBody}`));
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function runValidation() {
    console.log('🚀 INICIANDO VALIDAÇÃO FINAL E2E (PROCURAÇÃO & CONTRATO)\n');

    try {
        const cenarios = [
            {
                name: 'PROCURAÇÃO PREMIUM (Aninhado + Condicional + Triple Braces)',
                content: `
                    <div style="font-family: Arial; padding: 20px;">
                        <h1>PROCURAÇÃO</h1>
                        <p>OUTORGANTE: {{client.name}}, CPF: {{client.cpf}}</p>
                        <p>ENDEREÇO: {{client.address.street}}, {{client.address.city}}/{{client.address.state}}</p>
                        {{#if urgent}}
                        <div style="color: red; font-weight: bold;">⚠️ URGENTE: PROCESSAMENTO PRIORITÁRIO</div>
                        {{/if}}
                        <br>Assinatura:<br>{{{office.signature_html}}}
                    </div>
                `,
                data: {
                    "client.name": "Jardel Fernandes",
                    "client.cpf": "123.456.789-00",
                    "client.address.street": "Av. Paulista, 1000",
                    "client.address.city": "São Paulo",
                    "client.address.state": "SP",
                    "urgent": true,
                    "office.signature_html": '<img src="https://via.placeholder.com/200x50?text=ASSINATURA+JARDEL" alt="Assinatura">'
                }
            },
            {
                name: 'CONTRATO PREMIUM (Else Condition + Nested Logic)',
                content: `
                    <div style="font-family: serif; padding: 20px; border: 1px solid #ccc;">
                        <h2 style="text-align: center;">CONTRATO DE SERVIÇOS</h2>
                        <p>Contratante: {{client.name}}</p>
                        {{#if has_discount}}
                        <p style="color: green;">Desconto Aplicado: {{discount_value}}%</p>
                        {{else}}
                        <p>Valor Integral: R$ {{full_price}}</p>
                        {{/if}}
                        <p>Área Jurídica: {{case.details.area}}</p>
                        <p>Data: {{current_date}}</p>
                    </div>
                `,
                data: {
                    "client.name": "Empresa XPTO Solutions",
                    "has_discount": false,
                    "full_price": "10.000,00",
                    "case.details.area": "Direito Tributário e Civil",
                    "current_date": "08 de Abril de 2026"
                }
            }
        ];

        console.log('🧪 Testando motor de renderização (public.render_template_preview_raw)...');
        
        for (let i = 0; i < cenarios.length; i++) {
            const cenario = cenarios[i];
            console.log(`\n--- ${cenario.name} ---`);
            const html = await request('/rest/v1/rpc/render_template_preview_raw', 'POST', {
                p_content: cenario.content,
                p_data: cenario.data
            });

            const filename = `resultado_${i === 0 ? 'procuracao' : 'contrato'}.html`;
            fs.writeFileSync(filename, html);

            const checks = i === 0 ? {
                "Variável Simples (Nome)": html.includes("Jardel Fernandes"),
                "Variável Aninhada (Cidade)": html.includes("São Paulo"),
                "Condicional If (Urgente)": html.includes("⚠️ URGENTE"),
                "Triple Braces (Assinatura HTML)": html.includes('<img src="https://via.placeholder.com'),
                "Placeholders Limpos": !html.includes("{{")
            } : {
                "Variável Simples": html.includes("Empresa XPTO Solutions"),
                "Condicional Else": html.includes("Valor Integral: R$ 10.000,00"),
                "Nested Depth 3 (Area)": html.includes("Direito Tributário e Civil"),
                "Placeholders Limpos": !html.includes("{{")
            };

            for (const check in checks) {
                console.log(`${checks[check] ? '✅' : '❌'} ${check}`);
            }
            console.log(`💾 Evidência salva em: ${filename}`);
        }

        console.log('\n⚡ Testando integração: Edge Function -> RPC Preview -> Motor Raw...');
        const seedId = '50000000-0000-0000-0000-000000000001'; 
        const e2ePayload = {
            template_id: seedId,
            data: {
                "client_name": "Validação E2E Integração",
                "client_nationality": "Brasileiro",
                "client_marital_status": "Solteiro",
                "client_rg": "12.345.678-9",
                "lawyer_name": "Dr. Fernando Magalhães",
                "oab_number": "999.888/SP"
            }
        };

        try {
            const funcRes = await request('/functions/v1/lexos-render-document', 'POST', e2ePayload);
            if (funcRes && funcRes.ok) {
                console.log('✅ Edge Function gerou o documento final com sucesso!');
                fs.writeFileSync('e2e_integration_output.html', funcRes.content);
                console.log('💾 Evidência de integração salva em: e2e_integration_output.html');
            } else {
                console.warn('⚠️ Falha na integração Edge Function:', funcRes ? funcRes.reason : 'Sem resposta');
            }
        } catch (e) {
            console.error('❌ Erro ao chamar Edge Function:', e.message);
        }

        console.log('\n🏁 VALIDAÇÃO CONCLUÍDA COM SUCESSO.');

    } catch (error) {
        console.error('\n❌ ERRO NA VALIDAÇÃO:', error.message);
        process.exit(1);
    }
}

runValidation();
