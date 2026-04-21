import React, { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    ShieldAlert, Activity, AlertCircle, Lock, History, 
    Search, Filter, XCircle, CheckCircle2, Loader2, 
    ChevronLeft, ChevronRight, AlertTriangle, Info, ShieldCheck,
    BrainCircuit, TrendingUp, TrendingDown, Zap, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StrategicDecisionBoard } from "./components/StrategicDecisionBoard";
import { type Database } from "@/types/supabase";
import { 
    type StrategicInsight, 
    type GovernanceAlert, 
    type RiskSnapshot, 
    type GovernanceRecommendation, 
    type RiskState,
    type GovernanceIncident,
    type SafetyAudit
} from "@/types/governance";

const calculateSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    
    // Simple Jaccard Similarity for performance
    const set1 = new Set(s1.split(/\s+/));
    const set2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
};

const getEditClassification = (similarity: number): 'approved_no_edit' | 'approved_light_edit' | 'approved_heavy_edit' => {
    if (similarity >= 0.98) return 'approved_no_edit';
    if (similarity >= 0.85) return 'approved_light_edit';
    return 'approved_heavy_edit';
};

interface PendingAudit extends SafetyAudit {
    // Adicione campos extras se necessário para a UI
}

interface IncidentHistory extends GovernanceIncident {
    medical_governance_incidents?: {
        title: string;
        incident_category: string;
    }
}

const MedicalGovernanceDashboard: React.FC = () => {
    const { user } = useAuth();
    const { officeId, role } = useOfficeRole();
    
    // States
    const [alerts, setAlerts] = useState<GovernanceAlert[]>([]);
    const [activeRestrictions, setActiveRestrictions] = useState<RiskState[]>([]);
    const [incidents, setIncidents] = useState<IncidentHistory[]>([]);
    const [recommendations, setRecommendations] = useState<GovernanceRecommendation[]>([]);
    const [latestSnapshot, setLatestSnapshot] = useState<RiskSnapshot | null>(null);
    const [strategicInsights, setStrategicInsights] = useState<StrategicInsight[]>([]);
    const [pendingAudits, setPendingAudits] = useState<PendingAudit[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    
    // Pagination & Filters
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize] = useState(10);
    const [hasMore, setHasMore] = useState(false);
    const [filters, setFilters] = useState({
        severity: 'all',
        category: 'all',
        search: ''
    });

    // Revocation Modal
    const [revocationModal, setRevocationModal] = useState<{ open: boolean, stateId: string | null }>({ open: false, stateId: null });
    const [revocationReason, setRevocationReason] = useState('');
    const [isRevoking, setIsRevoking] = useState(false);

    // Review Modal (V6 + V22)
    const [reviewModal, setReviewModal] = useState<{ open: boolean, audit: PendingAudit | null }>({ open: false, audit: null });
    const [reviewContent, setReviewContent] = useState('');
    const [isReviewing, setIsReviewing] = useState(false);
    
    // V22 State
    const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
    const [auditRootCause, setAuditRootCause] = useState<string>('technical_ai_error');
    const [auditNotes, setAuditNotes] = useState('');

    const isAdmin = role === 'admin' || role === 'owner';

    const fetchRealtimeData = useCallback(async () => {
        if (!officeId) return;

        try {
            // 1. Alertas Ativos
            const { data: alertData } = await supabase
                .from('medical_governance_alerts')
                .select('*, medical_governance_incidents(title, incident_category)')
                .eq('office_id', officeId)
                .order('created_at', { ascending: false })
                .limit(10);
            setAlerts((alertData as unknown as GovernanceAlert[]) || []);

            // 2. Restrições Ativas
            const now = new Date().toISOString();
            const { data: riskData } = await supabase
                .from('medical_risk_states')
                .select('*')
                .or(`scope_id.eq.${officeId},scope_type.eq.office`)
                .gt('expires_at', now)
                .is('lifted_at', null);
            setActiveRestrictions(riskData || []);

            // 3. Inteligência V5: Recomendações
            const { data: recData } = await supabase
                .from('medical_governance_recommendations')
                .select('*')
                .eq('office_id', officeId)
                .eq('status', 'open')
                .limit(5);
            setRecommendations(recData || []);

            // 4. Inteligência V5: Último Snapshot
            const { data: snapData } = await supabase
                .from('medical_governance_snapshots')
                .select('*')
                .eq('office_id', officeId)
                .order('created_at', { ascending: false })
                .limit(1);
            if (snapData?.[0]) setLatestSnapshot(snapData[0] as RiskSnapshot);

            // 5. Copilot V6: Rascunhos Pendentes
            const { data: draftData } = await supabase
                .from('medical_safety_audits')
                .select('*')
                .eq('office_id', officeId)
                .eq('review_status', 'pending')
                .order('created_at', { ascending: false })
                .limit(10);
            setPendingAudits((draftData as unknown as PendingAudit[]) || []);

            // 6. Inteligência V18: Insights Estratégicos
            const { data: stratData } = await supabase
                .from('vw_strategic_decision_board')
                .select('*')
                .limit(5);
            setStrategicInsights((stratData as unknown as StrategicInsight[]) || []);

        } catch (err) {
            console.error("Governance fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [officeId]);

    const fetchIncidentHistory = useCallback(async () => {
        if (!officeId) return;
        setHistoryLoading(true);
        
        try {
            let query = supabase
                .from('medical_governance_incidents')
                .select('*', { count: 'exact' })
                .eq('office_id', officeId)
                .order('created_at', { ascending: false })
                .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

            if (filters.severity !== 'all') query = query.eq('severity', filters.severity);
            if (filters.category !== 'all') query = query.eq('incident_category', filters.category);
            if (filters.search) query = query.ilike('title', `%${filters.search}%`);

            const { data, count, error } = await query;
            if (error) throw error;

            setIncidents((data as unknown as IncidentHistory[]) || []);
            setHasMore(count ? count > (currentPage + 1) * pageSize : false);
        } catch (err) {
            console.error("History fetch error:", err);
            toast.error("Erro ao carregar histórico de incidentes.");
        } finally {
            setHistoryLoading(false);
        }
    }, [officeId, currentPage, pageSize, filters]);

    useEffect(() => {
        fetchRealtimeData();
        fetchIncidentHistory();

        // Realtime Subscription
        const channel = supabase.channel('governance-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_governance_alerts' }, fetchRealtimeData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_risk_states' }, fetchRealtimeData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchRealtimeData, fetchIncidentHistory]);

    const handleRevokeRestriction = async () => {
        if (!revocationReason.trim() || !revocationModal.stateId || !user) {
            toast.error("Motivo da revogação é obrigatório.");
            return;
        }

        setIsRevoking(true);
        try {
            const { error } = await supabase
                .from('medical_risk_states')
                .update({
                    lifted_at: new Date().toISOString(),
                    lifted_by: user.id,
                    lifted_reason: revocationReason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', revocationModal.stateId);

            if (error) throw error;

            toast.success("Restrição revogada com sucesso.");
            setRevocationModal({ open: false, stateId: null });
            setRevocationReason('');
            fetchRealtimeData();

            // Auditoria
            await supabase.from('audit_logs').insert({
                event_type: 'GOVERNANCE_RESTRICTION_LIFTED',
                actor_user_id: user.id,
                office_id: officeId,
                resource_type: 'medical_risk_states',
                action: 'update',
                metadata: { 
                    state_id: revocationModal.stateId,
                    reason: revocationReason
                }
            });
        } catch (err) {
            console.error("Revocation error:", err);
            toast.error("Falha ao revogar restrição.");
        } finally {
            setIsRevoking(false);
        }
    };

    const handleProcessReview = async (status: 'approved' | 'rejected' | 'edited') => {
        if (!reviewModal.audit || !user) return;
        setIsReviewing(true);

        try {
            const similarity = status === 'rejected' ? 0 : calculateSimilarity(reviewModal.audit.raw_content, reviewContent);
            const classification = status === 'rejected' ? 'rejected' : getEditClassification(similarity);

            const { error } = await supabase
                .from('medical_safety_audits')
                .update({
                    review_status: status === 'rejected' ? 'rejected' : (status === 'edited' ? 'edited' : 'approved'),
                    final_content: status === 'rejected' ? null : reviewContent,
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString(),
                    // V22 Fields
                    review_classification: classification,
                    edit_distance_score: 1 - similarity, // Divergence (distance)
                    intervention_types: selectedInterventions,
                    root_cause: (status === 'approved' && similarity >= 0.98) ? null : auditRootCause,
                    feedback_notes: auditNotes
                })
                .eq('id', reviewModal.audit.id);

            if (error) throw error;

            toast.success(status === 'rejected' ? "Rascunho rejeitado." : `Revisão concluída: ${classification.replace(/_/g, ' ')}`);
            setReviewModal({ open: false, audit: null });
            setSelectedInterventions([]);
            setAuditNotes('');
            fetchRealtimeData();
        } catch (err) {
            console.error("Review error:", err);
            toast.error("Falha ao processar revisão.");
        } finally {
            setIsReviewing(false);
        }
    };

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'warning': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'operational': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        }
    };

    return (
        <div className="min-h-screen bg-[#030712] text-slate-200 p-4 md:p-8 space-y-8 font-sans selection:bg-teal-500/30">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-teal-400 mb-1">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">IA Medical Governance</span>
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white">Watchdog Control Panel <span className="text-teal-500">V5</span></h1>
                    <p className="text-slate-400 max-w-2xl">Monitoramento avançado de comportamento clínico e <span className="text-teal-500/80 font-medium">Policy Advisor assistido por IA</span>.</p>
                </div>
                <div className="flex items-center gap-3">
                    {latestSnapshot && (
                        <Card className="flex items-center gap-4 px-4 py-3 bg-white/5 border-white/10 backdrop-blur-xl">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Tendência de Risco</span>
                                <div className="flex items-center gap-2">
                                    {latestSnapshot.risk_trend === 'improving' ? (
                                        <TrendingDown className="h-4 w-4 text-emerald-400" />
                                    ) : latestSnapshot.risk_trend === 'worsening' ? (
                                        <TrendingUp className="h-4 w-4 text-red-400" />
                                    ) : (
                                        <Activity className="h-4 w-4 text-blue-400" />
                                    )}
                                    <span className={`text-sm font-bold ${
                                        latestSnapshot.risk_trend === 'improving' ? 'text-emerald-400' : 
                                        latestSnapshot.risk_trend === 'worsening' ? 'text-red-400' : 'text-blue-400'
                                    }`}>
                                        {(latestSnapshot.risk_trend || 'stable').toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="h-8 w-px bg-white/10" />
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Incidentes (24h)</span>
                                <span className="text-sm font-mono font-bold text-white">
                                    {latestSnapshot.metrics?.incident_count || 0} 
                                    <span className="ml-1 text-[10px] text-slate-500">
                                        ({(latestSnapshot.metrics?.delta || 0) > 0 ? '+' : ''}{latestSnapshot.metrics?.delta || 0})
                                    </span>
                                </span>
                            </div>
                        </Card>
                    )}
                    <Card className="flex items-center gap-3 p-3 bg-white/5 border-white/10 backdrop-blur-xl">
                        <div className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                        <span className="text-xs font-medium text-slate-300">WATCHDOG ONLINE</span>
                    </Card>
                </div>
            </header>

            {/* BENTO GRID TOP: ALERTS & RESTRICTIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* BLOC 1: ACTIVE ALERTS (Real-time) */}
                <Card className="lg:col-span-12 xl:col-span-8 overflow-hidden bg-white/[0.02] border-white/5 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-700 delay-100">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-teal-500/10 rounded-lg text-teal-400">
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Alertas Prioritários</h2>
                                <p className="text-xs text-slate-500">Detecções recentes de padrões de risco</p>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-white/5 text-slate-400 border-white/10">Ao Vivo</Badge>
                    </div>
                    
                    <div className="p-0">
                        {loading ? (
                            <div className="h-64 flex flex-col items-center justify-center gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-teal-500/50" />
                                <span className="text-xs text-slate-500">Sincronizando com Watchdog...</span>
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-600 gap-2">
                                <CheckCircle2 className="h-10 w-10 opacity-20" />
                                <p className="text-sm">Nenhum alerta crítico ativo no momento.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5">
                                {alerts.map((alert) => (
                                    <div key={alert.id} className="p-5 bg-[#030712] hover:bg-white/[0.02] transition-colors flex gap-4 items-start border-white/5">
                                        <div className={`p-2 rounded-xl border ${getSeverityStyles(alert.severity || 'low')}`}>
                                            <AlertTriangle className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className={`text-[10px] uppercase font-bold py-0 h-4 ${getSeverityStyles(alert.severity || 'low')}`}>
                                                    {alert.severity}
                                                </Badge>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {format(new Date(alert.created_at || new Date()), 'HH:mm:ss')}
                                                </span>
                                            </div>
                                            <h3 className="text-sm font-semibold text-slate-200">{alert.message}</h3>
                                            <p className="text-xs text-slate-500 line-clamp-1">{alert.medical_governance_incidents?.title}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>

                {/* BLOC 2: ACTIVE RESTRICTIONS (Real-time) */}
                <Card className="lg:col-span-12 xl:col-span-4 bg-white/[0.02] border-white/5 backdrop-blur-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-700 delay-200">
                    <div className="p-6 border-b border-white/5 bg-red-500/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                                <Lock className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Suspensões Ativas</h2>
                                <p className="text-xs text-slate-500">Restrições preventivas de runtime</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[350px] p-4 space-y-3 custom-scrollbar">
                        {activeRestrictions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 p-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-2xl">
                                <ShieldCheck className="h-10 w-10 opacity-20" />
                                <p className="text-xs">Sistema operando sem restrições ativas.</p>
                            </div>
                        ) : (
                            activeRestrictions.map((restriction) => (
                                <div key={restriction.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-red-500/30 transition-all group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{restriction.scope_type}</span>
                                            <h3 className="text-sm font-bold text-white capitalize">{restriction.scope_id}</h3>
                                        </div>
                                        {isAdmin && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                onClick={() => setRevocationModal({ open: true, stateId: restriction.id })}
                                            >
                                                REVOGAR
                                            </Button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="text-slate-500">Expira em:</span>
                                            <span className="text-orange-400 font-mono">
                                                {restriction.expires_at ? format(new Date(restriction.expires_at), 'p', { locale: ptBR }) : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500/50 animate-progress-dash" style={{ width: '60%' }} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* BLOC 3: POLICY ADVISOR (V5) */}
                <Card className="lg:col-span-12 xl:col-span-4 bg-white/[0.02] border-white/5 backdrop-blur-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-700 delay-150">
                    <div className="p-6 border-b border-white/5 bg-teal-500/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-teal-500/10 rounded-lg text-teal-400">
                                <BrainCircuit className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Policy Advisor</h2>
                                <p className="text-xs text-slate-500">Insights Assistidos por IA</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[350px] p-4 space-y-3 custom-scrollbar">
                        {loading ? (
                             <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-teal-500/30" />
                            </div>
                        ) : recommendations.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 p-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-2xl">
                                <Zap className="h-8 w-8 opacity-20" />
                                <p className="text-[10px]">Nenhuma recomendação pendente.</p>
                            </div>
                        ) : (
                            recommendations.map((rec) => (
                                <div key={rec.id} className="p-4 rounded-xl bg-teal-500/[0.03] border border-teal-500/10 hover:border-teal-500/30 transition-all group">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="text-[9px] uppercase border-teal-500/20 text-teal-400 py-0 h-4">
                                            {(rec.recommendation_type || 'general').replace('_', ' ')}
                                        </Badge>
                                        <div className={`h-1.5 w-1.5 rounded-full ${rec.risk_level === 'high' ? 'bg-red-500' : rec.risk_level === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                                    </div>
                                    <h3 className="text-xs font-bold text-slate-200 mb-1">{rec.title}</h3>
                                    <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{rec.description}</p>
                                    
                                    {rec.impact_score !== undefined && (
                                        <div className="mb-3 p-2 bg-teal-500/5 rounded-lg border border-teal-500/10">
                                            <div className="flex items-center justify-between text-[9px] mb-1">
                                                <span className="text-slate-500 uppercase font-bold">Impacto Estimado</span>
                                                <span className="text-teal-400 font-mono font-bold">{Math.round((rec.impact_score || 0) * 100)}%</span>
                                            </div>
                                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-teal-500" style={{ width: `${Math.min(100, (rec.impact_score || 0) * 100)}%` }} />
                                            </div>
                                        </div>
                                    )}

                                    <Button variant="outline" className="w-full h-7 text-[9px] bg-white/5 border-white/10 hover:bg-teal-500 hover:text-white transition-all font-bold">
                                        REVISAR INSIGHT
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* BLOC 4: CLINICAL REVIEW QUEUE (V6) */}
                <Card className="lg:col-span-12 xl:col-span-4 bg-white/[0.02] border-white/5 backdrop-blur-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-700 delay-200">
                    <div className="p-6 border-b border-white/5 bg-blue-500/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Revisão Clínica</h2>
                                <p className="text-xs text-slate-500">Rascunhos da IA aguardando HITL</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[350px] p-4 space-y-3 custom-scrollbar">
                        {loading ? (
                             <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500/30" />
                            </div>
                        ) : pendingAudits.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 p-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-2xl">
                                <CheckCircle2 className="h-8 w-8 opacity-20 text-emerald-500" />
                                <p className="text-[10px]">Fila de revisão vazia. Bom trabalho!</p>
                            </div>
                        ) : (
                            pendingAudits.map((audit) => (
                                <div key={audit.id} className="p-4 rounded-xl bg-blue-500/[0.03] border border-blue-500/10 hover:border-blue-500/30 transition-all group">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="text-[9px] uppercase border-blue-500/20 text-blue-400 py-0 h-4">
                                            {(audit.requested_capability || 'general').replace('_', ' ')}
                                        </Badge>
                                        <span className="text-[9px] text-slate-500 font-mono">
                                            {audit.created_at ? format(new Date(audit.created_at), 'HH:mm') : 'N/A'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-300 leading-relaxed line-clamp-2 mb-3">
                                        {audit.raw_content}
                                    </p>
                                    
                                    <Button 
                                        variant="outline" 
                                        className="w-full h-7 text-[9px] bg-white/5 border-white/10 hover:bg-blue-500 hover:text-white transition-all font-bold"
                                        onClick={() => {
                                            setReviewModal({ open: true, audit });
                                            setReviewContent(audit.raw_content || '');
                                        }}
                                    >
                                        REVISAR RASCUNHO
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* BLOC 5: STRATEGIC INTELLIGENCE BOARD (V18) */}
                <Card className="lg:col-span-12 xl:col-span-4 bg-white/[0.02] border-white/5 backdrop-blur-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-700 delay-250">
                    <div className="p-6 border-b border-white/5 bg-amber-500/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Inteligência Estratégica</h2>
                                <p className="text-xs text-slate-500">Board de Decisão Baseada em Dados</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[350px] p-4 space-y-3 custom-scrollbar">
                        <StrategicDecisionBoard 
                            insights={strategicInsights} 
                            loading={loading} 
                        />
                    </div>
                </Card>

            </div>

            {/* BLOC 5: INCIDENT HISTORY */}
            <Card className="bg-white/[0.01] border-white/5 backdrop-blur-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-500/10 rounded-lg text-slate-400">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Histórico de Incidentes</h2>
                            <p className="text-xs text-slate-500">Registro histórico de eventos e decisões de governança</p>
                        </div>
                    </div>
                    
                    {/* FILTERS */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                            <Input 
                                placeholder="Buscar título..." 
                                className="h-9 w-48 pl-8 bg-white/5 border-white/10 text-xs text-white"
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            />
                        </div>
                        <Select value={filters.severity} onValueChange={(val) => setFilters(prev => ({ ...prev, severity: val }))}>
                            <SelectTrigger className="h-9 w-32 bg-white/5 border-white/10 text-xs">
                                <SelectValue placeholder="Severidade" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f172a] border-white/10 text-slate-200">
                                <SelectItem value="all">Severidades</SelectItem>
                                <SelectItem value="critical">Crítico</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                                <SelectItem value="warning">Aviso</SelectItem>
                                <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filters.category} onValueChange={(val) => setFilters(prev => ({ ...prev, category: val }))}>
                            <SelectTrigger className="h-9 w-40 bg-white/5 border-white/10 text-xs">
                                <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f172a] border-white/10 text-slate-200">
                                <SelectItem value="all">Categorias</SelectItem>
                                <SelectItem value="clinical_behavioral">Clínico/Comport.</SelectItem>
                                <SelectItem value="operational_engine">Operacional/IA</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentPage(0)} className="h-9 w-9 border-white/10 text-teal-400">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5">
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Incidente</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Severidade</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ocorrências</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {historyLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-4 bg-white/[0.01]">
                                            <div className="h-4 bg-white/5 rounded w-full" />
                                        </td>
                                    </tr>
                                ))
                            ) : incidents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-600">
                                        <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm">Nenhum registro histórico encontrado com esses filtros.</p>
                                    </td>
                                </tr>
                            ) : (
                                incidents.map((incident) => (
                                    <tr key={incident.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                                            {incident.created_at ? format(new Date(incident.created_at), 'dd/MM HH:mm') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-0.5">
                                                <h4 className="text-sm font-semibold text-slate-200 group-hover:text-teal-400 transition-colors">{incident.title}</h4>
                                                <p className="text-xs text-slate-500 line-clamp-1 italic">{incident.description}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className={`text-[10px] border ${getSeverityStyles(incident.severity || 'low')}`}>
                                                {incident.severity}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`h-1.5 w-1.5 rounded-full ${incident.status === 'open' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                                                <span className="text-[10px] text-slate-400 uppercase font-medium">{incident.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-400">
                                            {incident.occurrence_count}x
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/20">
                    <span className="text-xs text-slate-500">Página {currentPage + 1}</span>
                    <div className="flex gap-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-3 text-xs bg-white/5"
                            disabled={currentPage === 0 || historyLoading}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-3 text-xs bg-white/5"
                            disabled={!hasMore || historyLoading}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                            Próximo <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* REVOCATION MODAL */}
            <Dialog open={revocationModal.open} onOpenChange={(open) => setRevocationModal(prev => ({ ...prev, open }))}>
                <DialogContent className="bg-[#0f172a] border border-white/10 text-slate-200">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Lock className="h-5 w-5 text-red-500" /> Confirmar Revogação Manual
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            A revogação de uma restrição preventiva requer uma justificativa obrigatória para auditoria de compliance.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Motivo da Revogação</label>
                            <Textarea 
                                placeholder="Descreva por que esta restrição está sendo removida antecipadamente..." 
                                className="min-h-[100px] bg-black/40 border-white/10 text-slate-200 focus:border-teal-500/50"
                                value={revocationReason}
                                onChange={(e) => setRevocationReason(e.target.value)}
                            />
                        </div>
                        <Card className="p-3 bg-amber-500/5 border-amber-500/20 text-[11px] text-amber-200/80 leading-relaxed italic">
                            <AlertTriangle className="h-3 w-3 inline mr-1" /> Ação será registrada e atribuída ao seu perfil de administrador.
                        </Card>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRevocationModal({ open: false, stateId: null })} className="text-slate-400">
                            Voltar
                        </Button>
                        <Button 
                            disabled={!revocationReason.trim() || isRevoking} 
                            onClick={handleRevokeRestriction}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
                        >
                            {isRevoking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Revogação"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CLINICAL REVIEW MODAL (V6) */}
            <Dialog open={reviewModal.open} onOpenChange={(open) => setReviewModal(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-2xl bg-[#0f172a] border border-white/10 text-slate-200">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <BrainCircuit className="h-5 w-5 text-blue-400" /> Revisão de Rascunho Clínico (IA)
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Analise o conteúdo gerado pela IA. Você deve validar, editar ou rejeitar antes que ele se torne oficial.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Capacidade</span>
                                <Badge variant="outline" className="text-blue-400 border-blue-400/20">
                                    {reviewModal.audit?.requested_capability || 'N/A'}
                                </Badge>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">IA Mode</span>
                                <Badge variant="outline" className="text-teal-400 border-teal-400/20">
                                    {reviewModal.audit?.clinical_mode || 'N/A'}
                                </Badge>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Conteúdo Final (Editável)</label>
                                {reviewModal.audit && calculateSimilarity(reviewModal.audit.raw_content || '', reviewContent) < 0.98 && (
                                    <Badge variant="outline" className="text-[9px] bg-orange-500/10 text-orange-400 border-orange-500/20">
                                        Divergência Detectada: {Math.round((1 - calculateSimilarity(reviewModal.audit.raw_content || '', reviewContent)) * 100)}%
                                    </Badge>
                                )}
                            </div>
                            <Textarea 
                                className="min-h-[200px] bg-black/40 border-white/10 text-slate-200 focus:border-blue-500/50 font-sans text-sm leading-relaxed"
                                value={reviewContent}
                                onChange={(e) => setReviewContent(e.target.value)}
                            />
                        </div>

                        {/* V22: Feedback Loop Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo de Intervenção</label>
                                <div className="flex flex-wrap gap-2">
                                    {['diagnosis', 'dose', 'text', 'structure', 'conduct'].map((type) => (
                                        <Badge 
                                            key={type}
                                            variant={selectedInterventions.includes(type) ? 'default' : 'outline'}
                                            className={`cursor-pointer capitalize text-[10px] ${selectedInterventions.includes(type) ? 'bg-blue-600 hover:bg-blue-500' : 'hover:bg-white/5'}`}
                                            onClick={() => setSelectedInterventions(prev => 
                                                prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                                            )}
                                        >
                                            {type}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Causa Raiz (Se editado)</label>
                                <Select value={auditRootCause} onValueChange={setAuditRootCause}>
                                    <SelectTrigger className="h-8 bg-black/20 border-white/10 text-[10px]">
                                        <SelectValue placeholder="Selecione a causa" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0f172a] border-white/10 text-slate-200">
                                        <SelectItem value="technical_ai_error">Erro Técnico IA</SelectItem>
                                        <SelectItem value="clinical_variation">Variação de Conduta</SelectItem>
                                        <SelectItem value="data_missing">Dados Ausentes</SelectItem>
                                        <SelectItem value="prompt_misalignment">Desalinhamento de Prompt</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Notas de Feedback (Opcional)</label>
                                <Input 
                                    placeholder="Ex: IA sugeriu dose pediátrica para adulto..." 
                                    className="h-9 bg-black/20 border-white/10 text-xs"
                                    value={auditNotes}
                                    onChange={(e) => setAuditNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg flex items-start gap-3">
                            <Info className="h-4 w-4 text-blue-400 mt-0.5" />
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                <span className="text-blue-400 font-bold">Nota de Governança:</span> Ao aprovar, estas métricas serão usadas para o <span className="text-teal-500">aprendizado clínico assistido</span> e ajuste automático de políticas.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 flex-col sm:flex-row">
                        <Button 
                            variant="ghost" 
                            disabled={isReviewing}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 order-2 sm:order-1"
                            onClick={() => handleProcessReview('rejected')}
                        >
                            <XCircle className="h-4 w-4 mr-2" /> Rejeitar
                        </Button>
                        <div className="flex gap-2 order-1 sm:order-2">
                            <Button 
                                variant="outline" 
                                disabled={isReviewing}
                                className="bg-white/5 border-white/10 hover:bg-white/10"
                                onClick={() => handleProcessReview('approved')}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" /> Aprovar Sem Alteração
                            </Button>
                            <Button 
                                disabled={isReviewing || reviewContent === reviewModal.audit?.raw_content}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                onClick={() => handleProcessReview('edited')}
                            >
                                {isReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar com Edições"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* STYLES */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes progress-dash {
                    from { background-position: 0 0; }
                    to { background-position: 40px 0; }
                }
                .animate-progress-dash {
                    background-image: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent);
                    background-size: 40px 40px;
                    animation: progress-dash 2s linear infinite;
                }
            `}} />
        </div>
    );
};

export default MedicalGovernanceDashboard;
