// supabase/functions/medical-governance-watchdog/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { analyzeGovernancePatterns, persistGovernanceResults } from "../_shared/medical-governance.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req: Request) => {
    // 1. Auth check (Service Role only for Cron)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Stage 12: Check operator_freeze kill-switch before running watchdog
        // If governance/operator actions are frozen, skip analysis (but don't error).
        const { data: freezeActive } = await supabase.rpc('is_kill_switch_active', {
            p_switch_type: 'operator_freeze',
            p_scope_id:    null,
        });
        if (freezeActive === true) {
            console.warn('[WATCHDOG] operator_freeze kill-switch is active — skipping governance analysis');
            return new Response(JSON.stringify({
                status:  'skipped',
                reason:  'KILL_SWITCH_ACTIVE: operator_freeze',
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Definir Janela de Análise (últimos 30 min por padrão se rodar freq)
        const now = new Date();
        const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

        // 3. Coleta de Dados: Auditorias com intervenção
        const { data: audits, error: aError } = await supabase
            .from('medical_safety_audits')
            .select('id, office_id, user_id, blocked, downgraded, channel')
            .gte('created_at', thirtyMinAgo);

        if (aError) throw aError;

        // 4. Coleta de Dados: Logs operacionais com erro
        const { data: logs, error: lError } = await supabase
            .from('audit_logs')
            .select('id, office_id, status, details')
            .eq('status', 'ERROR')
            .gte('timestamp', thirtyMinAgo);

        if (lError) throw lError;

        // 5. Motor de Governança V4
        const thresholds = {
            bypass_high: 5,
            bypass_critical: 10
        };

        const findings = analyzeGovernancePatterns(audits || [], logs || [], thresholds);

        // 6. Persistência e Ações Automáticas
        if (findings.length > 0) {
            await persistGovernanceResults(supabase, findings);
        }

        // Stage 12: Log housekeeping run for watchdog pass
        console.log(`[WATCHDOG] Pass complete: ${findings.length} findings in ${audits?.length || 0} audits, ${logs?.length || 0} logs`);

        return new Response(JSON.stringify({ 
            status: 'success', 
            processed_audits: audits?.length || 0,
            processed_logs: logs?.length || 0,
            findings_detected: findings.length,
            window_start: thirtyMinAgo
        }), { 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (err: unknown) {
        const errMsg = (err as Error).message;
        console.error('[WATCHDOG-EXCEPTION]:', errMsg);
        return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
    }
});
