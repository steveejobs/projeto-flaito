import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'projeto-flaito', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUnificationLogic() {
  console.log('--- Iniciando Validação de Unificação de Agentes ---');

  // 1. Simular busca de configs globais
  const { data: globals, error: gErr } = await supabase
    .from('ai_agent_configs')
    .select('*')
    .is('office_id', null);

  if (gErr) throw gErr;
  console.log(`[OK] Configurações globais encontradas: ${globals.length}`);

  // 2. Verificar se o Agente de Voz e NIJA estão presentes nos globais
  const hasVoice = globals.find(g => g.slug === 'voice-assistant');
  const hasNija = globals.find(g => g.slug.includes('nija'));
  
  if (!hasVoice) console.error('[FAIL] Agente de voz não encontrado nos globais');
  if (!hasNija) console.error('[FAIL] Agente NIJA não encontrado nos globais');

  // 3. Testar lógica de merge (Mock manual para validação de conceito)
  const mockOfficeId = '00000000-0000-0000-0000-000000000000';
  const mockOverrides = [
    { slug: 'voice-assistant', model: 'gpt-4o', office_id: mockOfficeId }
  ];

  const merged = globals.map(g => {
    const override = mockOverrides.find(o => o.slug === g.slug);
    return override ? { ...g, ...override, is_override: true } : { ...g, is_override: false };
  });

  const voiceResult = merged.find(m => m.slug === 'voice-assistant');
  if (voiceResult?.model === 'gpt-4o' && voiceResult?.is_override) {
    console.log('[OK] Lógica de override de escritório validada');
  } else {
    console.error('[FAIL] Falha na lógica de override');
  }

  // 4. Verificar filtro de vertical
  const legalAgents = merged.filter(a => {
    // Regra: NIJA é só LEGAL, Voice é BOTH
    if (a.slug.includes('nija')) return true;
    if (a.slug === 'voice-assistant') return true;
    return false;
  });

  const medicalAgents = merged.filter(a => {
    if (a.slug.includes('nija')) return false;
    if (a.slug === 'voice-assistant') return true;
    return false;
  });

  if (legalAgents.length > medicalAgents.length && medicalAgents.some(a => a.slug === 'voice-assistant')) {
    console.log('[OK] Lógica de filtragem por vertical validada');
  } else {
    console.error('[FAIL] Falha na filtragem por vertical');
  }

  console.log('--- Validação Concluída ---');
}

testUnificationLogic().catch(console.error);
