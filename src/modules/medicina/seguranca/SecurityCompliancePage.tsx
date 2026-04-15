import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    Shield, FileCheck, Eye, Clock, User, Search,
    Download, AlertTriangle, CheckCircle2, Lock,
    ShieldAlert, History, Activity, AlertCircle, Loader2, XCircle
} from "lucide-react";

// Mock access logs
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const CONSENT_TEMPLATE = `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO
PARA USO DE IMAGENS EM ANÁLISE IRIDOLÓGICA (Versão 1.0)

Eu declaro que:
1. Fui informado(a) sobre o procedimento de captura de imagens da íris para fins de análise iridológica complementar;
2. Compreendo que a análise iridológica é uma abordagem complementar e NÃO substitui diagnóstico médico convencional;
3. Autorizo o armazenamento seguro das imagens capturadas para fins de avaliação clínica e comparação evolutiva;
4. Estou ciente de que meus dados são protegidos conforme a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018);
5. Posso revogar este consentimento a qualquer momento.`;

const SecurityCompliancePage: React.FC = () => {
    const { user } = useAuth();
    const { officeId } = useOfficeRole();
    const [activeTab, setActiveTab] = useState('logs');
    const [searchLogs, setSearchLogs] = useState('');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [patientIdConsent, setPatientIdConsent] = useState('');
    const [savingConsent, setSavingConsent] = useState(false);
    const [governanceAlerts, setGovernanceAlerts] = useState<any[]>([]);
    const [riskStates, setRiskStates] = useState<any[]>([]);

    useEffect(() => {
        if (officeId) {
            if (activeTab === 'logs') fetchLogs();
            if (activeTab === 'governance') fetchGovernanceData();
        }
    }, [activeTab, officeId]);

    const fetchGovernanceData = async () => {
        setLoading(true);
        try {
            // Busca Alertas Recentes
            const { data: alerts, error: aErr } = await supabase
                .from('medical_governance_alerts')
                .select('*, medical_governance_incidents(*)')
                .eq('office_id', officeId)
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (aErr) throw aErr;

            // Busca Estados de Risco Ativos (Não revogados e não expirados)
            const now = new Date().toISOString();
            const { data: states, error: sErr } = await supabase
                .from('medical_risk_states')
                .select('*')
                .or(`scope_id.eq.${officeId},scope_type.eq.office`) // Simplificado para este office
                .gt('expires_at', now)
                .is('lifted_at', null);

            if (sErr) throw sErr;

            setGovernanceAlerts(alerts || []);
            setRiskStates(states || []);
        } catch (err) {
            console.error("Error fetching governance data:", err);
            toast.error("Erro ao carregar dados de governança clínica.");
        } finally {
            setLoading(false);
        }
    };

    const handleLiftRestriction = async (stateId: string) => {
        if (!user) return;
        
        try {
            const { error } = await supabase
                .from('medical_risk_states')
                .update({ 
                    lifted_at: new Date().toISOString(),
                    lifted_by: user.id,
                    applied_reason: 'Revogado manualmente pelo administrador'
                })
                .eq('id', stateId);

            if (error) throw error;
            
            toast.success("Restrição revogada com sucesso.");
            fetchGovernanceData();
            
            // Log de auditoria da revogação
            await supabase.from('audit_logs').insert({
                event_type: 'GOVERNANCE_RESTRICTION_LIFTED',
                actor_user_id: user.id,
                resource_type: 'medical_risk_states',
                action: 'update',
                office_id: officeId,
                metadata: { state_id: stateId }
            });
        } catch (err) {
            console.error("Error lifting restriction:", err);
            toast.error("Erro ao revogar restrição.");
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('office_id', officeId)
                .order('timestamp', { ascending: false })
                .limit(100);
            
            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error("Error fetching logs:", err);
            toast.error("Erro ao carregar logs de auditoria.");
        } finally {
            setLoading(false);
        }
    };

    const actionColor = (action: string) => {
        const colors: Record<string, string> = {
            view: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            create: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            update: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            delete: 'bg-red-500/20 text-red-400 border-red-500/30',
            export: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            print: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        };
        return colors[action] || colors.view;
    };

    const handleSaveConsent = async () => {
        if (!patientIdConsent || !officeId || !user) {
            toast.error('Paciente não selecionado ou sessão inválida.');
            return;
        }
        
        setSavingConsent(true);
        try {
            const { error } = await supabase.from('medical_consents').insert({
                patient_id: patientIdConsent,
                office_id: officeId,
                consent_type: 'iridology_analysis',
                consent_version: '1.0',
                consent_text_snapshot: CONSENT_TEMPLATE,
                metadata: {
                    ip: 'detected_at_edge', // Backend will fill or we can try to fetch
                    user_agent: navigator.userAgent
                },
                accepted_at: new Date().toISOString()
            });

            if (error) throw error;
            
            toast.success("Consentimento registrado com sucesso!");
            setPatientIdConsent('');
            setConsentAccepted(false);
            
            // Audit log the consent
            await supabase.from('audit_logs').insert({
                event_type: 'CONSENT_GRANTED',
                actor_user_id: user.id,
                patient_id: patientIdConsent,
                resource_type: 'medical_consents',
                action: 'create',
                office_id: officeId
            });

        } catch (err: any) {
            console.error("Error saving consent:", err);
            toast.error("Erro ao registrar consentimento: " + err.message);
        } finally {
            setSavingConsent(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        (log.actor_user_id || '').toLowerCase().includes(searchLogs.toLowerCase()) ||
        (log.patient_id || '').toLowerCase().includes(searchLogs.toLowerCase()) ||
        (log.resource_type || '').toLowerCase().includes(searchLogs.toLowerCase())
    );

    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-6 animate-in fade-in duration-700">
            <header className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    Segurança & Compliance
                </h1>
                <p className="text-muted-foreground">Log de acessos e consentimento digital do paciente (LGPD).</p>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-white/5 border border-white/10 p-1">
                    <TabsTrigger value="logs" className="gap-1.5"><Eye className="h-4 w-4" /> Log de Acesso</TabsTrigger>
                    <TabsTrigger value="governance" className="gap-1.5"><ShieldAlert className="h-4 w-4" /> Governança IA</TabsTrigger>
                    <TabsTrigger value="consent" className="gap-1.5"><FileCheck className="h-4 w-4" /> Consentimento</TabsTrigger>
                    <TabsTrigger value="lgpd" className="gap-1.5"><Shield className="h-4 w-4" /> LGPD</TabsTrigger>
                </TabsList>

                {/* ACCESS LOGS */}
                <TabsContent value="logs" className="space-y-4 mt-6">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={searchLogs}
                                onChange={e => setSearchLogs(e.target.value)}
                                placeholder="Buscar por usuário, paciente ou recurso..."
                                className="pl-9"
                            />
                        </div>
                        <Button variant="outline" className="gap-1.5" onClick={() => toast.info('Exportação de logs em breve.')}>
                            <Download className="h-4 w-4" /> Exportar
                        </Button>
                    </div>

                    <Card className="overflow-hidden border-white/10 bg-black/40 backdrop-blur-md">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5">
                                        <th className="text-left text-xs font-medium text-muted-foreground p-4">Data/Hora</th>
                                        <th className="text-left text-xs font-medium text-muted-foreground p-4">Usuário</th>
                                        <th className="text-left text-xs font-medium text-muted-foreground p-4">Ação</th>
                                        <th className="text-left text-xs font-medium text-muted-foreground p-4">Recurso</th>
                                        <th className="text-left text-xs font-medium text-muted-foreground p-4">Paciente</th>
                                        <th className="text-left text-xs font-medium text-muted-foreground p-4">IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-teal-500 mb-2" />
                                                <p className="text-sm text-muted-foreground">Carregando registros de segurança...</p>
                                            </td>
                                        </tr>
                                    ) : filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-muted-foreground">
                                                Nenhum registro de auditoria encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLogs.map(log => (
                                            <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                <td className="p-4 text-xs text-muted-foreground font-mono">
                                                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                                                </td>
                                                <td className="p-4 text-sm text-foreground">{log.actor_user_id}</td>
                                                <td className="p-4">
                                                    <Badge variant="outline" className={`text-[10px] ${actionColor(log.action)}`}>
                                                        {log.action}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 text-sm text-foreground">{log.resource_type}</td>
                                                <td className="p-4 text-sm text-foreground">{log.patient_id || '-'}</td>
                                                <td className="p-4 text-xs text-muted-foreground font-mono">{log.ip || 'Edge/System'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>

                {/* GOVERNANCE & WATCHDOG (V4) */}
                <TabsContent value="governance" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Status Card */}
                        <Card className="p-5 bg-teal-500/5 border-teal-500/20 backdrop-blur-sm space-y-2">
                            <div className="flex items-center gap-2 text-teal-400">
                                <Activity className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Status do Watchdog</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-bold">Ativo</h3>
                                <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">V4.2 Secure</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">Vigilância contínua de logs e comportamentos suspeitos ativa.</p>
                        </Card>

                        {/* Stats Cards - Mocked or calculated */}
                        <Card className="p-5 bg-amber-500/5 border-amber-500/20 backdrop-blur-sm space-y-2">
                            <div className="flex items-center gap-2 text-amber-400">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Alertas Pendentes</span>
                            </div>
                            <h3 className="text-2xl font-bold">{governanceAlerts.filter(a => !a.is_read).length}</h3>
                            <p className="text-xs text-muted-foreground">Incidentes clínicos aguardando reconhecimento.</p>
                        </Card>

                        <Card className="p-5 bg-red-500/5 border-red-500/20 backdrop-blur-sm space-y-2">
                            <div className="flex items-center gap-2 text-red-400">
                                <Shield className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Restrições Ativas</span>
                            </div>
                            <h3 className="text-2xl font-bold">{riskStates.length}</h3>
                            <p className="text-xs text-muted-foreground">Canal ou capacidade clínica sob bloqueio preventivo.</p>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Recent Alerts Feed */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <History className="h-5 w-5 text-teal-400" /> Alertas de Governança
                                </h2>
                                <Button variant="ghost" size="sm" onClick={fetchGovernanceData} className="text-xs text-muted-foreground">
                                    {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Recarregar
                                </Button>
                            </div>
                            
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {governanceAlerts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground p-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                                        Nenhum alerta de governança registrado.
                                    </p>
                                ) : (
                                    governanceAlerts.map(alert => (
                                        <Card key={alert.id} className="p-4 border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-2 rounded-lg ${
                                                    alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                    alert.severity === 'high' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                    <AlertTriangle className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-muted-foreground font-mono">
                                                            {new Date(alert.created_at).toLocaleString('pt-BR')}
                                                        </span>
                                                        <Badge variant="outline" className="text-[9px] uppercase">
                                                            {alert.severity}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm font-medium">{alert.message}</p>
                                                    <p className="text-xs text-muted-foreground">{alert.medical_governance_incidents?.title}</p>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Active Restrictions Table */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Lock className="h-5 w-5 text-red-500" /> Restrições Ativas
                            </h2>
                            <Card className="border-white/10 bg-black/20 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 border-b border-white/10">
                                        <tr>
                                            <th className="p-3 text-xs font-medium text-muted-foreground">Escopo</th>
                                            <th className="p-3 text-xs font-medium text-muted-foreground">Nível</th>
                                            <th className="p-3 text-xs font-medium text-muted-foreground">Expiração</th>
                                            <th className="p-3 text-xs font-medium text-muted-foreground text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {riskStates.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                                                    Nenhuma restrição preventiva ativa no momento.
                                                </td>
                                            </tr>
                                        ) : (
                                            riskStates.map(state => (
                                                <tr key={state.id} className="hover:bg-white/[0.02]">
                                                    <td className="p-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium capitalize">{state.scope_id}</span>
                                                            <span className="text-[10px] text-muted-foreground uppercase">{state.scope_type}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-xs">
                                                        <Badge className={
                                                            state.risk_level === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                                                        }>{state.risk_level}</Badge>
                                                    </td>
                                                    <td className="p-3 text-xs font-mono text-muted-foreground">
                                                        {new Date(state.expires_at).toLocaleTimeString('pt-BR')}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                            onClick={() => handleLiftRestriction(state.id)}
                                                            title="Revogar Restrição"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* CONSENT */}
                <TabsContent value="consent" className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <Card className="p-6">
                                <h3 className="text-sm font-semibold text-teal-400 mb-4 flex items-center gap-2">
                                    <FileCheck className="h-4 w-4" /> Termo de Consentimento — Análise Iridológica
                                </h3>
                                <pre className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-white/[0.02] p-4 rounded-xl border border-white/5 font-sans">
                                    {CONSENT_TEMPLATE}
                                </pre>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <Card className="p-5 space-y-4">
                                <h4 className="text-sm font-semibold">Vincular para Paciente</h4>
                                <Input 
                                    value={patientIdConsent} 
                                    onChange={e => setPatientIdConsent(e.target.value)} 
                                    placeholder="ID do Paciente (UUID)" 
                                />
                                <p className="text-[10px] text-muted-foreground">Certifique-se de selecionar o paciente correto para o registro do TCLE.</p>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="checkbox" checked={consentAccepted} onChange={e => setConsentAccepted(e.target.checked)} className="mt-1 rounded" />
                                    <span className="text-xs text-muted-foreground font-medium">O paciente declarou aceitação plena do termo acima.</span>
                                </label>
                                <Button 
                                    onClick={handleSaveConsent} 
                                    disabled={!consentAccepted || !patientIdConsent || savingConsent} 
                                    className="w-full gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold"
                                >
                                    {savingConsent ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Registrar TCLE Digital</>}
                                </Button>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* LGPD */}
                <TabsContent value="lgpd" className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Lock className="h-5 w-5 text-emerald-400" />
                                <h3 className="text-sm font-semibold text-foreground">Status de Conformidade LGPD</h3>
                            </div>
                            {[
                                { item: 'Criptografia em trânsito (HTTPS)', status: true },
                                { item: 'Criptografia em repouso (Supabase)', status: true },
                                { item: 'Log de acesso a prontuários', status: true },
                                { item: 'Consentimento digital (TCLE)', status: true },
                                { item: 'RLS (Row Level Security) ativo', status: true },
                                { item: 'Direito ao esquecimento', status: false },
                                { item: 'Portabilidade de dados', status: false },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    {item.status ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                                    <span className="text-sm text-foreground">{item.item}</span>
                                </div>
                            ))}
                        </Card>

                        <Card className="p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-blue-400" />
                                <h3 className="text-sm font-semibold text-foreground">Política de Retenção de Dados</h3>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                    <p className="font-medium text-foreground">Imagens de Íris</p>
                                    <p className="text-xs text-muted-foreground mt-1">Armazenadas por até 5 anos ou até revogação do consentimento.</p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                    <p className="font-medium text-foreground">Laudos e Análises</p>
                                    <p className="text-xs text-muted-foreground mt-1">Armazenados por 20 anos conforme norma CFM.</p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                    <p className="font-medium text-foreground">Logs de Acesso</p>
                                    <p className="text-xs text-muted-foreground mt-1">Retidos por 5 anos para fins de auditoria.</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default SecurityCompliancePage;
