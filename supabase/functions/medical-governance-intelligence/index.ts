// supabase/functions/medical-governance-intelligence/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { 
    analyzeHistoricalGovernancePatterns, 
    computeRiskSnapshot, 
    persistIntelligenceResults,
    computeStrategicInsights,
    persistStrategicInsights
} from "../_shared/medical-intelligence.ts";

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

        // 2. INSIGHT DECAY: Limpeza de insights expirados
        const { data: deletedCount, error: cleanupError } = await supabase.rpc('cleanup_strategic_intelligence');
        if (cleanupError) console.error('[CLEANUP-ERROR]:', cleanupError.message);
        else console.log(`[CLEANUP]: Removed ${deletedCount} expired insights.`);

        // 3. Identificar Offices Ativos (últimas 24h)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: activeOffices } = await supabase
            .from('medical_safety_audits')
            .select('office_id')
            .gte('created_at', twentyFourHoursAgo);

        const uniqueOfficeIds = [...new Set(activeOffices?.map((a: any) => a.office_id) || [])];
        
        console.log(`[INTELLIGENCE-V5]: Processing ${uniqueOfficeIds.length} active offices.`);

        const results = [];

        // 4. Inteligência Global (opcional)
        const globalInsights = await computeStrategicInsights(supabase);
        await persistStrategicInsights(supabase, globalInsights);

        // 5. Processamento por Office
        for (const officeId of uniqueOfficeIds) {
            // A. Análise de Padrões Históricos (Recomendações Clínicas)
            const insights = await analyzeHistoricalGovernancePatterns(supabase, officeId as string, 7);
            if (insights.length > 0) {
                await persistIntelligenceResults(supabase, insights);
            }

            // B. Snapshot de Risco e Tendência
            const { metrics, trend } = await computeRiskSnapshot(supabase, officeId as string);
            
            await supabase.from('medical_governance_snapshots').insert({
                office_id: officeId,
                period_type: 'daily',
                period_start: twentyFourHoursAgo,
                period_end: new Date().toISOString(),
                metrics,
                risk_trend: trend
            });

            // C. Insights Estratégicos por Office
            const officeStrategicInsights = await computeStrategicInsights(supabase, officeId as string);
            await persistStrategicInsights(supabase, officeStrategicInsights);

            results.push({ 
                office_id: officeId, 
                insights_found: insights.length + officeStrategicInsights.length, 
                trend 
            });
        }

        return new Response(JSON.stringify({ 
            status: 'success', 
            processed_offices: uniqueOfficeIds.length,
            details: results
        }), { 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (err) {
        const error = err as Error;
        console.error('[INTELLIGENCE-EXCEPTION]:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
