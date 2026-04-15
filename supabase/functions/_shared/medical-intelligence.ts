// supabase/functions/_shared/medical-intelligence.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type IntelligenceRecommendationType = 'policy_adjustment' | 'training_needed' | 'high_friction' | 'false_positive_risk';
export type RiskTrend = 'improving' | 'stable' | 'worsening';

export interface IntelligenceInsight {
    office_id: string;
    type: IntelligenceRecommendationType;
    title: string;
    description: string;
    evidence_refs: string[];
    suggested_action: any;
    confidence: number;
}

/**
 * 1. Análise de Padrões Históricos (V5)
 */
export async function analyzeHistoricalGovernancePatterns(
    supabase: SupabaseClient,
    officeId: string,
    lookbackDays: number = 30
): Promise<IntelligenceInsight[]> {
    const insights: IntelligenceInsight[] = [];
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    // Buscar auditorias do período
    const { data: audits } = await supabase
        .from('medical_safety_audits')
        .select('*')
        .eq('office_id', officeId)
        .gte('created_at', since.toISOString());

    if (!audits || audits.length === 0) return [];

    // Buscar revogações manuais (Falsos Positivos)
    const { data: revocations } = await supabase
        .from('medical_risk_states')
        .select('*')
        .eq('scope_id', officeId)
        .not('lifted_at', 'is', null)
        .gte('created_at', since.toISOString());

    const totalAudits = audits.length;
    const totalBlocks = audits.filter((a: any) => a.blocked).length;
    const totalDowngrades = audits.filter((a: any) => a.downgraded).length;
    const totalRevocations = revocations?.length || 0;

    // INSIGHT 1: Fricção Elevada (Muitas revogações manuais rápidas)
    if (totalRevocations > (totalBlocks + totalDowngrades) * 0.3 && totalBlocks > 5) {
        insights.push({
            office_id: officeId,
            type: 'high_friction',
            title: 'Alta Fricção Detectada',
            description: `Cerca de ${Math.round((totalRevocations / (totalBlocks + totalDowngrades)) * 100)}% das intervenções de segurança foram revogadas manualmente. Considere flexibilizar thresholds de confiança.`,
            evidence_refs: revocations?.map((r: any) => r.id) || [],
            suggested_action: {
                target: 'confidence_threshold',
                suggested_adjustment: -0.1,
                reason: 'High manual revocation rate suggests over-conservative filters.'
            },
            confidence: 0.85
        });
    }

    // INSIGHT 2: Risco Comportamental Persistente
    if (totalBlocks > totalAudits * 0.2 && totalAudits > 20) {
        insights.push({
            office_id: officeId,
            type: 'policy_adjustment',
            title: 'Padrão de Uso Reincidente',
            description: 'Volume persistente de bloqueios por tentativa de uso clínico sem dados suficientes. Sugerido treinamento de equipe.',
            evidence_refs: audits.filter((a: any) => a.blocked).slice(0, 5).map((a: any) => a.id),
            suggested_action: {
                target: 'user_training',
                details: 'Review clinical data completeness requirements with providers.'
            },
            confidence: 0.9
        });
    }

    return insights;
}

/**
 * 2. Cálculo de Snapshot e Tendência de Risco (V5)
 */
export async function computeRiskSnapshot(
    supabase: SupabaseClient,
    officeId: string
): Promise<{ metrics: any; trend: RiskTrend }> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Últimas 24h

    // Atual (24h)
    const { count: currentIncidents } = await supabase
        .from('medical_governance_incidents')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .gte('last_seen_at', periodStart.toISOString());

    // Anterior (24h-48h)
    const { count: previousIncidents } = await supabase
        .from('medical_governance_incidents')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .lt('last_seen_at', periodStart.toISOString())
        .gte('last_seen_at', new Date(periodStart.getTime() - 24 * 60 * 60 * 1000).toISOString());

    const cCount = currentIncidents || 0;
    const pCount = previousIncidents || 0;

    let trend: RiskTrend = 'stable';
    if (cCount > pCount + 2) trend = 'worsening';
    else if (cCount < pCount && pCount > 0) trend = 'improving';

    return {
        metrics: {
            incident_count: cCount,
            delta: cCount - pCount,
            timestamp: now.toISOString()
        },
        trend
    };
}

/**
 * 3. Persistência de Recomendações Assistidas
 */
export async function persistIntelligenceResults(
    supabase: SupabaseClient,
    insights: IntelligenceInsight[]
) {
    for (const insight of insights) {
        await supabase.from('medical_governance_recommendations').upsert({
            office_id: insight.office_id,
            recommendation_type: insight.type,
            title: insight.title,
            description: insight.description,
            evidence_refs: insight.evidence_refs,
            suggested_policy_snapshot: insight.suggested_action,
            risk_level: insight.confidence > 0.8 ? 'medium' : 'low',
            status: 'open'
        }, { onConflict: 'office_id,recommendation_type,title' });
    }
}
/**
 * 4. Geração de Insights Estratégicos (Stage 18)
 */
export async function computeStrategicInsights(
    supabase: SupabaseClient,
    officeId: string | null = null
): Promise<any[]> {
    const strategicInsights: any[] = [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias de validade

    // 1. Monitoramento de Custos (Exemplo: Alerta de Desvio)
    // Aqui buscaríamos dados de faturamento/uso de tokens
    // Por enquanto, simulamos baseado em volumetria de auditorias
    const { count: totalAudits } = await supabase
        .from('medical_safety_audits')
        .select('*', { count: 'exact', head: true })
        .eq(officeId ? 'office_id' : '', officeId || '');

    if (totalAudits && totalAudits > 100) {
        strategicInsights.push({
            insight_type: 'COST',
            scope: officeId ? 'office' : 'global',
            scope_id: officeId,
            summary: 'Volume de Auditoria Elevado',
            recommended_action: 'Avaliar consolidação de logs ou ajuste de sampling.',
            priority_level: 'medium',
            decision_type: 'ops',
            confidence_score: 0.95,
            time_window_start: now.toISOString(),
            time_window_end: now.toISOString(),
            signals_used: ['audit_count'],
            explainability: {
                summary: 'Volume acima do baseline histórico.',
                because: 'O número de auditorias nas últimas 24h excedeu o threshold de 100 eventos.'
            },
            expires_at: expiresAt.toISOString()
        });
    }

    return strategicInsights;
}

/**
 * 5. Persistência de Insights Estratégicos
 */
export async function persistStrategicInsights(
    supabase: SupabaseClient,
    insights: any[]
) {
    if (insights.length === 0) return;
    
    const { error } = await supabase
        .from('strategic_intelligence_insights')
        .upsert(insights, { 
            onConflict: 'insight_type,scope,scope_id,feature,time_window_start' 
        });

    if (error) {
        console.error('[STRATEGIC-PERSIST-ERROR]:', error.message);
    }
}
