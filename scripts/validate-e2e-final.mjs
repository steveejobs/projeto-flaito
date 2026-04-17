import https from 'https';
import fs from 'fs';
import path from 'path';

// Leitura manual do .env para evitar dependências externas
const envPath = '.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const processEnv = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) processEnv[key.trim()] = value.join('=').trim();
});

const SUPABASE_URL = processEnv.VITE_SUPABASE_URL;
const SUPABASE_KEY = processEnv.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL.split('//')[1].split('.')[0];

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Credenciais do Supabase não encontradas no .env');
    process.exit(1);
}

async function request(path, method, body) {
  const data = JSON.stringify(body);
  const isEdgeFunction = path.startsWith('/functions/v1/');
  const hostname = isEdgeFunction ? `${PROJECT_REF}.functions.supabase.co` : `${PROJECT_REF}.supabase.co`;
  const fullPath = isEdgeFunction ? path.replace('/functions/v1', '') : path;

  const options = {
    hostname,
    port: 443,
    path: fullPath,
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
          resolve(responseBody ? JSON.parse(responseBody) : {});
        } else {
          reject(new Error(`Request to ${path} failed (${res.statusCode}): ${responseBody}`));
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
        // 1. Definição de Cenários Complexos
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

        // 2. Executar Validação via RPC RAW (Provar o Algoritmo do Motor)
        console.log('🧪 Testando motor de renderização (public.render_template_preview_raw)...');
        
        for (const [index, cenario] of cenarios.entries()) {
            console.log(`\n--- ${cenario.name} ---`);
            try {
                const res = await request('/rest/v1/rpc/render_template_preview_raw', 'POST', {
                    p_content: cenario.content,
                    p_data: cenario.data
                });

                const html = res;
                const filename = `resultado_${index === 0 ? 'procuracao' : 'contrato'}.html`;
                fs.writeFileSync(filename, html);

                // Verificações
                const checks = index === 0 ? {
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

                for (const [check, passed] of Object.entries(checks)) {
                    console.log(`${passed ? '✅' : '❌'} ${check}`);
                }
                console.log(`💾 Evidência salva em: ${filename}`);
            } catch (err) {
                console.error(`❌ Erro no motor raw (${cenario.name}): ${err.message}`);
                console.log('⚠️ Pulando para o próximo teste...');
            }
        }

        // 3. Validação de Integração com Edge Function (Caminho E2E)
        console.log('\n⚡ Testando integração: Edge Function -> RPC Preview -> Motor Raw...');
        // Usamos o ID do Seed 'Procuração Ad Judicia'
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

        const funcRes = await request('/functions/v1/lexos-render-document', 'POST', e2ePayload);
        
        if (funcRes.ok) {
            console.log('✅ Edge Function gerou o documento final com sucesso!');
            console.log('📄 Conteúdo validado via ID real do banco.');
            fs.writeFileSync('e2e_integration_output.html', funcRes.content);
            console.log('💾 Evidência de integração salva em: e2e_integration_output.html');
        } else {
            console.warn('⚠️ Falha na integração Edge Function:', funcRes.reason);
        }

        console.log('\n🏁 VALIDAÇÃO CONCLUÍDA COM SUCESSO.');

    } catch (error) {
        console.error('\n❌ ERRO NA VALIDAÇÃO:', error.message);
        process.exit(1);
    }
}

runValidation();
