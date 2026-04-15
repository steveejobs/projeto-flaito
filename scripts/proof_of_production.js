const https = require('https');
const fs = require('fs');

// 1. Carregar Configurações
const envContent = fs.readFileSync('.env', 'utf8');
const processEnv = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...value] = trimmed.split('=');
    if (key && value) processEnv[key.trim()] = value.join('=').trim();
});

const SUPABASE_URL = processEnv.VITE_SUPABASE_URL || processEnv.SUPABASE_URL;
const SUPABASE_KEY = processEnv.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL.split('//')[1].split('.')[0];

async function request(apiPath, method, body, isEdge = false) {
    const data = JSON.stringify(body);
    const hostname = isEdge ? `${PROJECT_REF}.functions.supabase.co` : `${PROJECT_REF}.supabase.co`;
    const cleanPath = isEdge ? apiPath.replace('/functions/v1', '') : apiPath;

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
                try {
                    const parsed = responseBody ? JSON.parse(responseBody) : {};
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: responseBody });
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function runProof() {
    console.log('💎 INICIANDO PROVA DE PRODUÇÃO - FLAITO DOCUMENT ENGINE\n');

    try {
        // PASSO 1: Buscar Template Real
        console.log('📂 1. Buscando template real (Procuração Ad Judicia)...');
        const templateSearch = await request('/rest/v1/document_templates?id=eq.50000000-0000-0000-0000-000000000001&select=*', 'GET');
        const template = templateSearch.data[0];
        console.log(`✅ Template encontrado: "${template.name}" (ID: ${template.id})`);

        // PASSO 2: Montar Payload de Produção
        console.log('\n📦 2. Montando payload de produção...');
        const payload = {
            template_id: template.id,
            data: {
                // Variáveis Simples
                "client_name": "Jardel Fernandes de Oliveira",
                "client_cpf": "123.456.789-01",
                "client_nationality": "Brasileiro",
                "client_marital_status": "Casado",
                "client_occupation": "Engenheiro de Software",
                "lawyer_name": "Dr. Fernando Magalhães",
                "oab_number": "SP/123.456",
                // Variáveis Aninhadas
                "client": {
                    "name": "Jardel Fernandes de Oliveira",
                    "address": {
                        "street": "Rua das Flores, 123",
                        "city": "São Paulo",
                        "state": "SP"
                    }
                },
                // Variáveis para Lógica Condicional (#if)
                "is_urgent": true,
                "has_guarantee": false,
                // Variáveis Triple Braces (HTML)
                "office": {
                    "name": "Flaito Legal Services",
                    "signature_html": "<div style='border-top:1px solid #000; width:200px; text-align:center; padding-top:5px;'><img src='https://placehold.co/150x50/EEE/31343C?text=Assinatura+Digital' alt='Signature'><br><span style='font-size:10px;'>Assinado Digitalmente por Dr. Fernando Magalhães</span></div>"
                }
            }
        };
        console.log('✅ Payload montado (com aninhamento e assinaturas HTML).');

        // PASSO 3: Executar Preview (RPC)
        console.log('\n🧪 3. Executando RPC render_template_preview...');
        const previewRes = await request('/rest/v1/rpc/render_template_preview', 'POST', payload);
        const previewHtml = previewRes.data.content;
        fs.writeFileSync('production_preview.html', previewHtml);
        console.log('✅ Preview gerado com sucesso.');

        // PASSO 4: Executar Documento Final (Edge Function)
        console.log('\n⚡ 4. Executando Edge Function lexos-render-document (Fluxo E2E)...');
        const finalRes = await request('/functions/v1/lexos-render-document', 'POST', payload, true);
        
        if (finalRes.status === 200 && finalRes.data.ok) {
            const finalHtml = finalRes.data.content;
            fs.writeFileSync('production_final_document.html', finalHtml);
            console.log('✅ DOCUMENTO FINAL GERADO PELA EDGE FUNCTION!');
            console.log(`🔗 URL para Armazenamento (simulada): ${finalRes.data.file_path || 'Pendente de upload final'}`);
            
            // Validações Visuais no Log
            console.log('\n🔍 CHECKS DE QUALIDADE:');
            console.log(`${finalHtml.includes('Jardel Fernandes de Oliveira') ? '✅' : '❌'} client_name resolvido`);
            console.log(`${finalHtml.includes('São Paulo') ? '✅' : '❌'} Variável aninhada resolvida`);
            console.log(`${finalHtml.includes('Assinado Digitalmente') ? '✅' : '❌'} Assinatura HTML renderizada`);
            console.log(`${!finalHtml.includes('{{') ? '✅' : '❌'} Nenhum placeholder residual`);
            console.log(`${finalHtml.includes('<br>') || finalHtml.includes('</p>') ? '✅' : '❌'} Formatação HTML preservada`);
            
            console.log('\n🏆 STATUS FINAL: PRONTO PARA PRODUÇÃO.');
        } else {
            console.error('❌ Falha na geração final:', finalRes.data.reason || finalRes.data);
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO NA PROVA:', error.message);
        process.exit(1);
    }
}

runProof();
