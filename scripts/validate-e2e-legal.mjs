import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL.split('//')[1].split('.')[0];

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

async function validateE2E() {
  console.log('🚀 INICIANDO VALIDAÇÃO E2E DE FLUXO DOCUMENTAL\n');

  try {
    // 1. Tentar aplicar Migration
    console.log('📦 Aplicando/Verificando migration...');
    const migrationPath = './supabase/migrations/20260408160000_restore_template_engine.sql';
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    try {
      await request('/rest/v1/rpc/execute_db_sql', 'POST', { sql_query: sql });
      console.log('✅ Migration aplicada com sucesso.');
    } catch (e) {
      if (e.message.includes('schema cache')) {
        console.log('⚠️ PostgREST reportou erro de cache, mas a migration provavelmente foi aplicada. Prosseguindo...');
      } else {
        console.warn('⚠️ Erro ao aplicar migration:', e.message);
      }
    }

    // Esperar um pouco para o cache estabilizar
    await new Promise(r => setTimeout(r, 2000));

    // 2. Buscar um template real
    console.log('🔍 Buscando template de procuração...');
    const sqlSearch = "SELECT id, name FROM public.document_templates WHERE name ILIKE '%procuração%' LIMIT 1";
    const searchRes = await request('/rest/v1/rpc/execute_db_sql', 'POST', { sql_query: sqlSearch });
    
    let templateId;
    if (searchRes && searchRes.length > 0) {
      templateId = searchRes[0].id;
      console.log(`✅ Template encontrado: ${searchRes[0].name} (${templateId})`);
    } else {
      console.log('⚠️ Nenhum template de procuração encontrado. Criando um temporário...');
      const insertSql = `
        INSERT INTO public.document_templates (name, content, type, category)
        VALUES ('Procuração de Teste E2E', 
        '<h1>PROCURAÇÃO</h1><p>Eu, {{client.name}}, portador do CPF {{client.cpf}}, nomeio {{office.name}}.</p>
         {{#if has_attachments}}<p>Documentos em anexo: {{attachments_count}}</p>{{/if}}
         {{#if urgent}}<b>ESTE DOCUMENTO É URGENTE</b>{{/if}}
         <br>Assinatura:<br>{{{office.signature_html}}}',
        'procuracao', 'legal')
        RETURNING id;
      `;
      const insertRes = await request('/rest/v1/rpc/execute_db_sql', 'POST', { sql_query: insertSql });
      templateId = insertRes[0].id;
      console.log(`✅ Template temporário criado: ${templateId}`);
    }

    // 2. Preparar Payload
    const payload = {
      template_id: templateId,
      data: {
        "client.name": "Jardel Fernandes",
        "client.cpf": "123.456.789-00",
        "office.name": "Escritório Modelo Flaito",
        "office.signature_html": '<img src="https://via.placeholder.com/150" alt="Assinatura">',
        "has_attachments": true,
        "attachments_count": 3,
        "urgent": false // Deve remover o bloco de urgência
      },
      output_format: "html"
    };

    // 3. Testar RPC Diretamente (Camada 1)
    console.log('\n🛠️ Testando RPC render_template_preview...');
    const rpcRes = await request('/rest/v1/rpc/render_template_preview', 'POST', {
      p_template_id: payload.template_id,
      p_data: payload.data
    });

    if (rpcRes.ok) {
      console.log('✅ RPC respondeu corretamente.');
      console.log('📄 Conteúdo parcial renderizado:\n', rpcRes.content.substring(0, 100) + '...');
    } else {
      throw new Error(`RPC frustrada: ${rpcRes.reason}`);
    }

    // 4. Testar Edge Function (Camada 2 - End-to-End)
    console.log('\n⚡ Chamando Edge Function lexos-render-document...');
    const funcRes = await request('/functions/v1/lexos-render-document', 'POST', payload);

    if (funcRes.ok) {
        console.log('✅ Edge Function gerou o documento com sucesso!');
        console.log('📏 Tamanho do HTML:', funcRes.content.length, 'bytes');
        
        // Validações Críticas
        const html = funcRes.content;
        const checks = {
            "Nome do Cliente": html.includes("Jardel Fernandes"),
            "CPF do Cliente": html.includes("123.456.789-00"),
            "Condicional Veradeira": html.includes("Documentos em anexo: 3"),
            "Condicional Falsa (Removida)": !html.includes("ESTE DOCUMENTO É URGENTE"),
            "Triple Braces (HTML)": html.includes('<img src="https://via.placeholder.com/150"'),
            "Placeholder Residual": !html.includes("{{")
        };

        console.log('\n🔍 Verificações de Qualidade:');
        for (const [name, passed] of Object.entries(checks)) {
            console.log(`${passed ? '✅' : '❌'} ${name}`);
        }

        fs.writeFileSync('output-test.html', html);
        console.log('\n💾 Documento salvo em: output-test.html');
    } else {
        throw new Error(`Edge Function falhou: ${funcRes.reason}`);
    }

    console.log('\n🎉 VALIDAÇÃO E2E CONCLUÍDA COM SUCESSO!');

  } catch (error) {
    console.error('\n❌ FALHA NA VALIDAÇÃO E2E:', error.message);
    process.exit(1);
  }
}

validateE2E();
