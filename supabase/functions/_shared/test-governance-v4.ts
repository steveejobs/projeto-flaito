// supabase/functions/_shared/test-governance-v4.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

async function runGovernanceTest() {
    console.log("🚀 Iniciando Teste de Governança V4...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const testOfficeId = "00000000-0000-0000-0000-000000000000"; // Mock ID
    const testUserId = "00000000-0000-0000-0000-000000000001";

    // 1. Limpeza de estados anteriores
    await supabase.from('medical_risk_states').delete().eq('scope_id', testOfficeId);
    await supabase.from('medical_governance_incidents').delete().eq('office_id', testOfficeId);

    console.log("Step 1: Inserindo 12 auditorias bloqueadas (Ataque Comportamental)");
    const auditMocks = Array.from({ length: 12 }).map(() => ({
        office_id: testOfficeId,
        user_id: testUserId,
        function_slug: 'test-agent',
        requested_capability: 'treatment_suggestion',
        effective_capability: 'blocked',
        blocked: true,
        channel: 'voice',
        confidence_score: 0.3,
        created_at: new Date().toISOString()
    }));

    await supabase.from('medical_safety_audits').insert(auditMocks);

    console.log("Step 2: Inserindo log de erro operacional");
    await supabase.from('audit_logs').insert({
        office_id: testOfficeId,
        user_id: testUserId,
        status: 'ERROR',
        details: { error_source: 'safety_engine', message: 'Timeout in V3 engine' },
        event_type: 'SYSTEM_ERROR',
        action: 'ENFORCE_SAFETY'
    });

    console.log("Step 3: Invocando Watchdog (Simulado)");
    // Aqui invocamos o endpoint do watchdog ou rodamos a lógica diretamente
    // Para simplificar no script, vamos assumir que o watchdog roda via HTTP
    const watchdogResponse = await fetch(`${SUPABASE_URL}/functions/v1/medical-governance-watchdog`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });

    const watchdogResult = await watchdogResponse.json();
    console.log("Watchdog Result:", watchdogResult);

    console.log("Step 4: Validando Incidentes");
    const { data: incidents } = await supabase
        .from('medical_governance_incidents')
        .select('*')
        .eq('office_id', testOfficeId);
    
    console.log(`Encontrados ${incidents?.length} incidentes.`);
    incidents?.forEach(i => console.log(` - [${i.severity}] ${i.title} (${i.incident_category})`));

    console.log("Step 5: Validando Estados de Risco (Block Temporário)");
    const { data: riskStates } = await supabase
        .from('medical_risk_states')
        .select('*')
        .eq('scope_id', 'voice'); // Verificando bloqueio de canal
    
    if (riskStates && riskStates.length > 0) {
        const rs = riskStates[0];
        console.log(`✅ Estado de Risco Ativo: ${rs.risk_level}`);
        console.log(`   Expira em: ${rs.expires_at}`);
        console.log(`   Motivo: ${rs.applied_reason}`);
    } else {
        console.log("❌ Falha: Estado de risco não encontrado.");
    }

    console.log("🏁 Teste concluído.");
}

runGovernanceTest();
