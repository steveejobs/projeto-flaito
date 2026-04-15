import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  console.log('--- Iniciando Diagnóstico de Causa Raiz ---');

  const queries = {
    function_def: `
      SELECT pg_get_functiondef(p.oid) 
      FROM pg_proc p 
      JOIN pg_namespace n ON n.oid = p.pronamespace 
      WHERE n.nspname = 'public' AND p.proname = 'ensure_personal_office'
    `,
    offices_schema: `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'offices' 
      ORDER BY ordinal_position
    `,
    office_members_schema: `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'office_members'
      ORDER BY ordinal_position
    `,
    constraints: `
      SELECT 
        conname as constraint_name, 
        contype as type, 
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid IN ('public.offices'::regclass, 'public.office_members'::regclass)
    `,
    triggers: `
      SELECT 
        tgname as trigger_name, 
        tgenabled as enabled, 
        pg_get_triggerdef(oid) as definition
      FROM pg_trigger 
      WHERE tgrelid IN ('public.offices'::regclass, 'public.office_members'::regclass)
      AND NOT tgisinternal
    `
  };

  const results: Record<string, any> = {};

  for (const [name, sql] of Object.entries(queries)) {
    try {
      // Usando get_service_config se estiver disponível, ou tentando via query direta se o RPC permitir
      const { data, error } = await supabase.rpc('get_service_config', { query: sql });
      
      if (error) {
        console.error(`Erro em ${name}: [${error.code}] ${error.message}`);
        results[name] = { error: error.message };
      } else {
        console.log(`Sucesso em ${name}`);
        results[name] = data;
      }
    } catch (e: any) {
      console.error(`Catch em ${name}:`, e.message);
      results[name] = { error: e.message };
    }
  }

  console.log('\n--- RESULTADO FINAL DO DIAGNÓSTICO ---');
  console.log(JSON.stringify(results, null, 2));
}

diagnose();
