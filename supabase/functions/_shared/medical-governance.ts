// supabase/functions/_shared/medical-governance.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type GovernanceSeverity = "info" | "warning" | "high" | "critical" | "operational";
export type IncidentCategory = "clinical_behavioral" | "operational_engine";

export interface GovernanceFinding {
    category: IncidentCategory;
    severity: GovernanceSeverity;
    title: string;
    description: string;
    office_id: string;
    user_id?: string;
    scope_type: 'user' | 'office' | 'channel';
    scope_id: string;
    duration_minutes?: number;
    evidence_refs: string[];
    occurrence_count: number;
}

export interface GovernanceAction {
    type: 'alert' | 'restrict_capability' | 'suspend_channel' | 'force_review';
    capability?: string;
    channel?: string;
    expires_in_minutes?: number;
    reason: string;
}

interface AuditRecord {
    id: string;
    office_id: string;
    user_id: string;
    blocked: boolean;
    downgraded: boolean;
    channel: string;
}

interface LogRecord {
    id: string;
    office_id?: string;
    status: string;
    details?: {
        error_source?: string;
    };
}

/**
 * 1. Análise de Padrões de Risco (Motor de Detecção)
 */
export function analyzeGovernancePatterns(
    audits: AuditRecord[], 
    logs: LogRecord[], 
    thresholds: any
): GovernanceFinding[] {
    const findings: GovernanceFinding[] = [];

    // Agrupamento por Office
    const officeGroups = audits.reduce((acc, audit) => {
        (acc[audit.office_id] = acc[audit.office_id] || []).push(audit);
        return acc;
    }, {} as Record<string, AuditRecord[]>);

    for (const [officeId, officeAudits] of Object.entries(officeGroups)) {
        // REGRA 1: Bypass repetido (Clinical Behavioral)
        const blockedEvents = officeAudits.filter((a: AuditRecord) => a.blocked || a.downgraded);
        if (blockedEvents.length >= (thresholds.bypass_critical || 10)) {
            findings.push({
                category: 'clinical_behavioral',
                severity: 'critical',
                title: 'Tentativas Críticas de Bypass Detectadas',
                description: `O consultório ${officeId} atingiu limite crítico de bloqueios/downgrades (${blockedEvents.length} eventos).`,
                office_id: officeId,
                scope_type: 'office',
                scope_id: officeId,
                evidence_refs: blockedEvents.map((e: AuditRecord) => e.id),
                occurrence_count: blockedEvents.length
            });
        } else if (blockedEvents.length >= (thresholds.bypass_high || 5)) {
             findings.push({
                category: 'clinical_behavioral',
                severity: 'high',
                title: 'Frequência Elevada de Intervenções de Segurança',
                description: `Padrão de uso desalinhado com authorized_capability detectado (${blockedEvents.length} eventos).`,
                office_id: officeId,
                scope_type: 'office',
                scope_id: officeId,
                evidence_refs: blockedEvents.map((e: AuditRecord) => e.id),
                occurrence_count: blockedEvents.length
            });
        }

        // REGRA 3: Risco de Canal (Voz/WA)
        const voiceEvents = officeAudits.filter((a: AuditRecord) => a.channel === 'voice' && a.downgraded);
        if (voiceEvents.length >= 5) {
            findings.push({
                category: 'clinical_behavioral',
                severity: 'high',
                title: 'Incompatibilidade Crítica em Canal de Voz',
                description: 'Alto volume de downgrades automáticos em IA de voz.',
                office_id: officeId,
                scope_type: 'channel',
                scope_id: 'voice',
                evidence_refs: voiceEvents.map((e: AuditRecord) => e.id),
                occurrence_count: voiceEvents.length
            });
        }
    }

    // REGRA 5: Falhas do Motor (Operational Engine)
    const engineErrors = logs.filter((l: LogRecord) => l.status === 'ERROR' && l.details?.error_source === 'safety_engine');
    if (engineErrors.length > 0) {
        findings.push({
            category: 'operational_engine',
            severity: 'operational',
            title: 'Falha Técnica no Safety Engine detectada',
            description: `${engineErrors.length} erros detectados no motor de segurança clínica.`,
            office_id: engineErrors[0].office_id || 'system',
            scope_type: 'office',
            scope_id: 'system',
            evidence_refs: engineErrors.map((e: LogRecord) => e.id),
            occurrence_count: engineErrors.length
        });
    }

    return findings;
}

/**
 * 2. Derivação de Ações de Governança (Respostas Progressivas)
 */
export function deriveGovernanceActions(finding: GovernanceFinding): GovernanceAction[] {
    const actions: GovernanceAction[] = [];

    if (finding.category === 'operational_engine') {
        // Falhas do motor geram apenas alertas, sem punição/restrição ao usuário
        actions.push({ type: 'alert', reason: finding.description });
        return actions;
    }

    if (finding.severity === 'warning') {
        actions.push({ type: 'alert', reason: finding.title });
    } else if (finding.severity === 'high') {
        actions.push({ type: 'alert', reason: finding.title });
        actions.push({ 
            type: 'force_review', 
            capability: 'clinical_hypothesis', 
            reason: 'High risk behavioral pattern' 
        });
    } else if (finding.severity === 'critical') {
        actions.push({ type: 'alert', reason: finding.title });
        
        // Suspensão Temporária (Ajuste obrigatório V4)
        if (finding.scope_type === 'channel') {
            actions.push({ 
                type: 'suspend_channel', 
                channel: finding.scope_id, 
                expires_in_minutes: 60, 
                reason: 'Excessive channel-specific safety bypass attempts' 
            });
        } else {
            actions.push({ 
                type: 'restrict_capability', 
                capability: 'diagnostic_opinion', 
                expires_in_minutes: 120, 
                reason: 'Critical behavioral risk threshold met' 
            });
        }
    }

    return actions;
}

/**
 * 3. Persistência de Incidentes e Risk States
 */
export async function persistGovernanceResults(
    supabase: SupabaseClient,
    findings: GovernanceFinding[]
) {
    for (const finding of findings) {
        const { data: incident, error: iError } = await supabase
            .from('medical_governance_incidents')
            .upsert({
                office_id: finding.office_id,
                user_id: finding.user_id,
                incident_category: finding.category,
                severity: finding.severity,
                title: finding.title,
                description: finding.description,
                evidence: finding.evidence_refs,
                occurrence_count: finding.occurrence_count,
                last_seen_at: new Date().toISOString()
            }, { onConflict: 'office_id,incident_category,title', ignoreDuplicates: false })
            .select()
            .single();

        if (iError) console.error('Governance Incident Error:', iError);

        // Alerta para o dashboard
        await supabase.from('medical_governance_alerts').insert({
            incident_id: incident?.id,
            office_id: finding.office_id,
            user_id: finding.user_id,
            severity: finding.severity,
            message: finding.title
        });

        // Aplicar Ações
        const actions = deriveGovernanceActions(finding);
        for (const action of actions) {
            if (action.type === 'restrict_capability' || action.type === 'suspend_channel') {
                await supabase.from('medical_risk_states').insert({
                    scope_type: finding.scope_type,
                    scope_id: finding.scope_id,
                    risk_level: finding.severity,
                    applied_reason: action.reason,
                    applied_at: new Date().toISOString(),
                    expires_at: action.expires_in_minutes ? new Date(Date.now() + action.expires_in_minutes * 60000).toISOString() : null,
                    temporary_restrictions: [action]
                });
            }
        }
    }
}

/**
 * 4. Busca de Restrições Ativas (Runtime Enforcement)
 */
export async function fetchActiveGovernanceRestrictions(
    supabase: SupabaseClient,
    officeId: string,
    userId: string,
    channel: string
): Promise<{ severity: GovernanceSeverity; restrictions: any[] }> {
    const now = new Date().toISOString();
    
    // Filtro para buscar restrições que afetam este contexto específico
    const { data: riskStates, error } = await supabase
        .from('medical_risk_states')
        .select('*')
        .filter('expires_at', 'gt', now)
        .is('lifted_at', null);

    if (error || !riskStates) return { severity: 'info', restrictions: [] };

    // Filtragem em memória para lidar com o OR complexo (scope_id/type) em JS se o Supabase Filter for limitado
    const filteredStates = riskStates.filter(rs => 
        (rs.scope_type === 'office' && rs.scope_id === officeId) ||
        (rs.scope_type === 'user' && rs.scope_id === userId) ||
        (rs.scope_type === 'channel' && rs.scope_id === channel)
    );

    const restrictions = filteredStates.flatMap(rs => rs.temporary_restrictions || []);
    
    const severityHierarchy: Record<GovernanceSeverity, number> = {
        'critical': 5,
        'high': 4,
        'warning': 3,
        'info': 2,
        'operational': 1
    };

    let maxSeverity: GovernanceSeverity = 'info';
    let maxRank = 0;

    for (const rs of filteredStates) {
        const currentRank = severityHierarchy[rs.risk_level as GovernanceSeverity] || 0;
        if (currentRank > maxRank) {
            maxRank = currentRank;
            maxSeverity = rs.risk_level as GovernanceSeverity;
        }
    }

    return { severity: maxSeverity, restrictions };
}

/**
 * 5. Gerador de Recomendações de Política (V5 Expanded / V22)
 * Analisa as intervenções humanas para sugerir melhorias no sistema.
 */
export async function generateGovernanceRecommendations(
    supabase: SupabaseClient,
    officeId: string
) {
    // 1. Buscar os últimos audits revisados para este office
    const { data: recentReviews, error } = await supabase
        .from('medical_safety_audits')
        .select('*')
        .eq('office_id', officeId)
        .neq('review_status', 'pending')
        .order('reviewed_at', { ascending: false })
        .limit(100);

    if (error || !recentReviews?.length) return;

    const recommendations: any[] = [];

    // ANALISE A: Erros de IA Recorrentes (Heavy Edits)
    const heavyEdits = recentReviews.filter(r => r.review_classification === 'approved_heavy_edit');
    if (heavyEdits.length >= 3) {
        // Identificar tipo de intervenção comum
        const commonIntervention = heavyEdits.flatMap(r => r.intervention_types)
            .reduce((acc, curr) => { acc[curr] = (acc[curr] || 0) + 1; return acc; }, {} as Record<string, number>);
        
        const topIntervention = Object.entries(commonIntervention).sort((a,b) => b[1] - a[1])[0];

        if (topIntervention) {
            recommendations.push({
                office_id: officeId,
                recommendation_type: 'prompt_refinement',
                title: `Refinamento de Prompt: ${topIntervention[0].toUpperCase()}`,
                description: `Detectamos que ${Math.round(heavyEdits.length/recentReviews.length * 100)}% das gerações exigem edições pesadas em ${topIntervention[0]}. Recomenda-se ajustar o prompt de sistema.`,
                risk_level: 'medium',
                impact_score: (heavyEdits.length / 10) * 0.8, // Exemplo de cálculo: frequência com peso de severidade
                status: 'open',
                evidence_ids: heavyEdits.map(h => h.id).slice(0, 5)
            });
        }
    }

    // ANALISE B: Variação de Conduta Clínica
    const clinicalVariations = recentReviews.filter(r => r.root_cause === 'clinical_variation');
    if (clinicalVariations.length >= 5) {
        recommendations.push({
            office_id: officeId,
            recommendation_type: 'policy_adjustment',
            title: 'Ajuste de Política de Conduta',
            description: `${clinicalVariations.length} rascunhos foram alterados por variação de conduta. Considere flexibilizar ou tornar mais estrito o guardrail de conduta clínica para este office.`,
            risk_level: 'low',
            impact_score: 0.4,
            status: 'open'
        });
    }

    // Persistir recomendações novas (evitando duplicatas recentes)
    for (const rec of recommendations) {
        await supabase
            .from('medical_governance_recommendations')
            .upsert(rec, { onConflict: 'office_id,recommendation_type,title', ignoreDuplicates: true });
    }
}
