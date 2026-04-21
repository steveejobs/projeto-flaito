
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function validate() {
  console.log('🧪 [DOCS] Iniciando Validação do Motor de Documentos...');

  try {
    // 1. Verificar Tabelas
    console.log('\nChecking Tables...');
    const tables = ['document_templates', 'document_template_versions', 'document_variables', 'generated_docs'];
    for (const table of tables) {
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        console.error(`❌ Tabela ${table} falhou:`, error.message);
      } else {
        console.log(`✅ Tabela ${table} ok.`);
      }
    }

    // 2. Verificar Função RPC
    console.log('\nTesting render_template_preview_raw RPC...');
    const testContent = 'Olá {{client.name}}!{{#if case.id}} Processo: {{case.id}}{{/if}}';
    const testData = { 'client.name': 'João Silva', 'case.id': '12345' };
    
    const { data: rendered, error: rpcError } = await supabase.rpc('render_template_preview_raw', {
      p_content: testContent,
      p_data: testData
    });

    if (rpcError) {
      console.error('❌ RPC render_template_preview_raw falhou:', rpcError.message);
    } else {
      console.log('✅ RPC render_template_preview_raw ok.');
      console.log('Result:', rendered);
      if (rendered.includes('João Silva') && rendered.includes('12345')) {
        console.log('✨ Renderização correta.');
      } else {
        console.error('❌ Resultado da renderização inesperado.');
      }
    }

    // 3. Testar RLS (Tentativa de leitura pública - deve falhar ou ser vazia se não autenticado)
    // Usando client anon para testar RLS
    const supabaseAnon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    console.log('\nTesting RLS with Anon Key...');
    const { data: anonData, error: anonError } = await supabaseAnon.from('document_templates').select('*');
    if (anonError) {
        console.log('✅ RLS bloqueou acesso anônimo (com erro ou vazio conforme política).');
    } else if (anonData && anonData.length === 0) {
        console.log('✅ RLS restringiu acesso anônimo (vazio).');
    } else {
        console.warn('⚠️  Aviso: Anon conseguiu ler templates. Verifique se isso é esperado para templates de sistema.');
    }

    console.log('\n🏁 Validação concluída.');

  } catch (err) {
    console.error('❌ Erro inesperado na validação:', err.message);
    process.exit(1);
  }
}

validate();
