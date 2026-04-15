import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft,
    User,
    Calendar,
    Phone,
    Mail,
    MapPin,
    Heart,
    Pill,
    AlertTriangle,
    FileText,
    Upload,
    Plus,
    Clock,
    Stethoscope,
    ClipboardList,
    ChevronRight,
    Eye,
    Leaf,
    Apple,
    Activity,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { GlobalTimeline } from '@/components/GlobalTimeline';
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from '@/contexts/ActiveClientContext';
import { identityService } from '@/services/identityService';
import { Gavel, MessageSquare as WhatsAppIcon } from "lucide-react";
import { WhatsAppTab } from './components/WhatsAppTab';

const PacienteDetalhe = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [novaAnotacao, setNovaAnotacao] = useState('');
    useEffect(() => {
        if (!id) return;
        const fetchBioData = async () => {
            try {
                const [av, ld, prot, diet] = await Promise.all([
                    supabase.from('iris_analyses').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
                    supabase.from('medical_reports').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
                    supabase.from('protocolos_terapeuticos').select('*').eq('paciente_id', id).order('created_at', { ascending: false }),
                    supabase.from('receitas_dietas').select('*').eq('paciente_id', id).order('created_at', { ascending: false })
                ]);
                
                setIridologiaData({ avaliacoes: av.data || [], laudos: ld.data || [] });
                setProtocolos(prot.data || []);
                setDietas(diet.data || []);
            } catch (e) {}
        };
        fetchBioData();
    }, [id]);

    const { activeProfile, setActiveClientId, isLoading: isProfileLoading } = useActiveClient();
    const [consultas, setConsultas] = useState<any[]>([]);
    const [prescricoes, setPrescricoes] = useState<any[]>([]);
    const [iridologiaData, setIridologiaData] = useState<{avaliacoes: any[], laudos: any[]}>({avaliacoes: [], laudos: []});
    const [protocolos, setProtocolos] = useState<any[]>([]);
    const [dietas, setDietas] = useState<any[]>([]);
    const [fieldAudit, setFieldAudit] = useState<any[]>([]);
    const [hasLegalCases, setHasLegalCases] = useState(false);
    const [isDataLoading, setIsDataLoading] = useState(true);

    // 1. Resolve Identity and Set Active Client
    useEffect(() => {
        if (!id) return;
        
        async function resolveIdentity() {
            // Se o ID for de um paciente, buscamos o perfil completo via service
            const profile = await identityService.getProfileByPatientId(id);
            if (profile) {
                setActiveClientId(profile.id);
            }
        }
        
        resolveIdentity();
    }, [id, setActiveClientId]);

    // 2. Fetch Module-Specific Data (Clinical)
    useEffect(() => {
        if (!id || !activeProfile) return;
        
        const fetchData = async () => {
            setIsDataLoading(true);
            try {
                const [av, ld, prot, diet, cons, pres, cases, audit] = await Promise.all([
                    supabase.from('iris_analyses').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
                    supabase.from('medical_reports').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
                    supabase.from('protocolos_terapeuticos').select('*').eq('paciente_id', id).order('created_at', { ascending: false }),
                    supabase.from('receitas_dietas').select('*').eq('paciente_id', id).order('created_at', { ascending: false }),
                    supabase.from('consultas').select('*, profissional:auth.users(name, email)').eq('paciente_id', id).order('created_at', { ascending: false }),
                    supabase.from('prescricoes_medicas').select('*').eq('paciente_id', id).order('created_at', { ascending: false }),
                    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('client_id', activeProfile.id),
                    supabase.from('patient_field_audit_log').select('*, author:auth.users(name)').eq('patient_id', id).order('created_at', { ascending: false })
                ]);
                
                setIridologiaData({ avaliacoes: av.data || [], laudos: ld.data || [] });
                setProtocolos(prot.data || []);
                setDietas(diet.data || []);
                setConsultas(cons.data || []);
                setPrescricoes(pres.data || []);
                setHasLegalCases((cases.count || 0) > 0);
                setFieldAudit(audit.data || []);
            } catch (e) {
                console.error("Erro ao carregar dados clínicos", e);
            } finally {
                setIsDataLoading(false);
            }
        };
        fetchData();
    }, [id, activeProfile]);

    const paciente = activeProfile;

    const anotacoes = consultas
        .filter(c => c.observacoes)
        .map(c => ({
            id: c.id,
            data: c.created_at,
            texto: c.observacoes,
            autor: c.profissional?.name || 'Profissional'
        }));

    const exames = [
        // This is still mocked as we don't have an exams table described in the plan yet
    ];

    if (isProfileLoading || (isDataLoading && !activeProfile)) {
        return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>;
    }

    if (!activeProfile) {
        return <div className="p-10 text-center text-muted-foreground">Paciente não encontrado ou erro de identidade.</div>;
    }

    const idade = paciente.data_nascimento ? new Date().getFullYear() - new Date(paciente.data_nascimento).getFullYear() : 'N/I';

    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-6 animate-in fade-in duration-700">
            {/* Back button */}
            <Button
                variant="ghost"
                className="gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/medical/patients')}
            >
                <ArrowLeft className="h-4 w-4" /> Voltar para Pacientes
            </Button>

            {/* Patient Header */}
            <Card className="bento-card p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Avatar */}
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-blue-400 font-bold text-2xl shrink-0">
                        {paciente.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>

                    {/* Info */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">{paciente.full_name}</h1>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {paciente.medical_data?.status === 'inativo' ? 'Inativo' : 'Ativo'} • CPF: {paciente.cpf}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {hasLegalCases && (
                                    <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1 cursor-pointer hover:bg-amber-500/30" onClick={() => navigate('/dashboard')}>
                                        <Gavel className="h-3 w-3" /> Processos Ativos
                                    </Badge>
                                )}
                                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                    Cadastro RCP OK
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4 text-blue-400" />
                                {paciente.data_nascimento ? new Date(paciente.data_nascimento).toLocaleDateString('pt-BR') : 'Sem data'}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4 text-blue-400" />
                                {paciente.phone || 'Sem telefone'}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4 text-blue-400" />
                                {paciente.email || 'Sem email'}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground md:col-span-3">
                                <MapPin className="h-4 w-4 text-blue-400" />
                                {paciente.address_line || 'Endereço não informado'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick info cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/5">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                        <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Alergias</p>
                            <p className="text-sm text-foreground mt-1">{paciente.medical_data?.alergias || 'Nenhuma registrada'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                        <Pill className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Medicamentos em Uso</p>
                            <p className="text-sm text-foreground mt-1">{paciente.medical_data?.medicamentos_em_uso || 'Nenhum registrado'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                        <Heart className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Histórico</p>
                            <p className="text-sm text-foreground mt-1 line-clamp-2">{paciente.medical_data?.historico_medico || 'S/ relato'}</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="timeline" className="space-y-4">
                <TabsList className="bg-white/5 border border-white/10 p-1">
                    <TabsTrigger value="timeline" className="gap-2 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        <Activity className="h-4 w-4" /> Life Log
                    </TabsTrigger>
                    <TabsTrigger value="consultas" className="gap-2 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        <Stethoscope className="h-4 w-4" /> Consultas
                    </TabsTrigger>
                    <TabsTrigger value="anotacoes" className="gap-2 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        <ClipboardList className="h-4 w-4" /> Anotações
                    </TabsTrigger>
                    <TabsTrigger value="exames" className="gap-2 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                        <FileText className="h-4 w-4" /> Exames
                    </TabsTrigger>
                    <TabsTrigger value="bio-saude" className="gap-2 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                        <Leaf className="h-4 w-4" /> Bio-Saúde
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp" className="gap-2 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                        <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="auditoria" className="gap-2 data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
                        <ShieldCheck className="h-4 w-4" /> Auditoria
                    </TabsTrigger>
                </TabsList>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="space-y-4">
                    <GlobalTimeline />
                </TabsContent>

                {/* Consultas Tab */}
                <TabsContent value="consultas" className="space-y-4">
                    <div className="flex justify-end">
                        <Button
                            className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                            onClick={() => navigate(`/medical/atendimento/${paciente.id}`)}
                        >
                            <Plus className="h-4 w-4" /> Nova Consulta Single-Screen
                        </Button>
                    </div>
                    {consultas.map((c) => (
                        <Card key={c.id} className="bento-card p-5 hover:border-blue-500/20 transition-colors cursor-pointer group">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 bg-blue-500/10 rounded-xl shrink-0">
                                        <Stethoscope className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <p className="font-semibold text-foreground">{c.historico ? c.historico.substring(0, 50) + '...' : 'Consulta sem HDA'}</p>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(c.created_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{c.exame_fisico || 'S/ exame físico'}</p>
                                        <p className="text-xs text-muted-foreground/60">{c.profissional?.name || 'Profissional'}</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Card>
                    ))}
                </TabsContent>

                {/* Anotações Tab */}
                <TabsContent value="anotacoes" className="space-y-4">
                    <Card className="bento-card p-5">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Nova Anotação</h3>
                        <Textarea
                            placeholder="Escreva uma anotação clínica..."
                            value={novaAnotacao}
                            onChange={(e) => setNovaAnotacao(e.target.value)}
                            className="min-h-[80px] mb-3"
                        />
                        <div className="flex justify-end">
                            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white" size="sm">
                                <Plus className="h-4 w-4" /> Adicionar Anotação
                            </Button>
                        </div>
                    </Card>
                    {anotacoes.map((a) => (
                        <Card key={a.id} className="bento-card p-5">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-amber-500/10 rounded-xl shrink-0">
                                    <ClipboardList className="h-5 w-5 text-amber-400" />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">{a.autor}</p>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {new Date(a.data).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-foreground">{a.texto}</p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </TabsContent>

                {/* Exames Tab */}
                <TabsContent value="exames" className="space-y-4">
                    <div className="flex justify-end">
                        <Button className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                            <Upload className="h-4 w-4" /> Upload de Exame
                        </Button>
                    </div>
                    <Card className="bento-card overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exame</th>
                                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                                    <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exames.map((ex) => (
                                    <tr key={ex.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-4 w-4 text-blue-400" />
                                                <span className="font-medium text-sm">{ex.nome}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className="text-xs bg-white/5">
                                                {ex.tipo}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-sm text-muted-foreground">
                                            {new Date(ex.data).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button variant="ghost" size="sm" className="gap-1 text-xs">
                                                <FileText className="h-3 w-3" /> Visualizar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {iridologiaData.avaliacoes.map((ex) => (
                                    <tr key={ex.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <Eye className="h-4 w-4 text-emerald-400" />
                                                <span className="font-medium text-sm">Análise Iridológica ({ex.ai_response?.vitalityIndex || 0}% Vitalidade)</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                Bio-Saúde IA
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-sm text-muted-foreground">
                                            {new Date(ex.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate(`/medical/iridologia/resultado/${ex.id}`)}>
                                                <Activity className="h-3 w-3" /> Ver Laudo
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
                {/* Bio-Saúde Tab */}
                <TabsContent value="bio-saude" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="bento-card p-5 border-emerald-500/10 bg-emerald-500/5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold flex items-center gap-2 text-emerald-400">
                                    <Eye className="h-5 w-5" /> Iridologia
                                </h3>
                                <Button size="sm" variant="outline" className="text-xs h-8 border-emerald-500/30 text-emerald-400" onClick={() => navigate('/medical/iridologia')}>Nova Análise</Button>
                            </div>
                            <div className="space-y-3">
                                {iridologiaData.avaliacoes.length > 0 ? iridologiaData.avaliacoes.map((av) => (
                                    <div key={av.id} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                                        <div>
                                            <p className="text-sm font-medium">{new Date(av.created_at).toLocaleDateString('pt-BR')}</p>
                                            <p className="text-xs text-muted-foreground">Vitalidade: {av.ai_response?.vitalityIndex || 0}%</p>
                                        </div>
                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 text-[10px]">{av.ai_response?.constitution || 'N/I'}</Badge>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center py-4">Nenhuma avaliação realizada.</p>}
                            </div>
                        </Card>

                        <Card className="bento-card p-5 border-blue-500/10 bg-blue-500/5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold flex items-center gap-2 text-blue-400">
                                    <ClipboardList className="h-5 w-5" /> Protocolos & Dietas
                                </h3>
                                <Button size="sm" variant="outline" className="text-xs h-8 border-blue-500/30 text-blue-400">Novo Plano</Button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Protocolos Ativos</p>
                                    <div className="space-y-2">
                                        {protocolos.length > 0 ? protocolos.map(p => (
                                            <div key={p.id} className="text-sm p-2 rounded bg-black/10 border-l-2 border-blue-500">
                                                {p.titulo}
                                            </div>
                                        )) : <p className="text-xs text-muted-foreground italic">Sem protocolos</p>}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Recomendações Alimentares</p>
                                    <div className="space-y-2">
                                        {dietas.length > 0 ? dietas.map(d => (
                                            <div key={d.id} className="text-sm p-2 rounded bg-black/10 border-l-2 border-emerald-500 flex items-center gap-2">
                                                <Apple className="h-3 w-3 text-emerald-400" /> {d.titulo}
                                            </div>
                                        )) : <p className="text-xs text-muted-foreground italic">Sem dietas</p>}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                {/* WhatsApp Tab */}
                <TabsContent value="whatsapp" className="space-y-4">
                    <WhatsAppTab 
                        clientId={paciente.id} 
                        patientPhone={paciente.phone || ''} 
                        patientName={paciente.full_name} 
                    />
                </TabsContent>

                {/* Auditoria Tab (Stage 6) */}
                <TabsContent value="auditoria" className="space-y-6">
                    <Card className="bento-card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-teal-500/10 rounded-xl">
                                <ShieldCheck className="h-5 w-5 text-teal-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-foreground">Trilha de Auditoria do Prontuário</h3>
                                <p className="text-xs text-muted-foreground">Histórico granular de alterações em campos sensíveis e origem dos dados.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {fieldAudit.length > 0 ? fieldAudit.map((log) => (
                                <div key={log.id} className="relative pl-6 pb-6 border-l border-white/10 last:pb-0">
                                    <div className="absolute left-[-5px] top-1 h-2.5 w-2.5 rounded-full bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
                                    
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] font-bold uppercase bg-white/5 border-white/10 uppercase">
                                                {log.field_name.replace(/_/g, ' ')}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">• {new Date(log.created_at).toLocaleString('pt-BR')}</span>
                                        </div>
                                        <Badge variant="secondary" className={`text-[9px] font-black uppercase ${log.provenance === 'ocr_extraction' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                            {log.provenance === 'ocr_extraction' ? 'Origem: AI/OCR' : 'Origem: Manual'}
                                        </Badge>
                                    </div>

                                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 text-sm">
                                        <div className="flex-1 text-muted-foreground line-through opacity-50 decoration-red-500/50">
                                            {log.old_value || <span className="italic text-[10px]">vazio</span>}
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-teal-500 shrink-0 rotate-90 md:rotate-0" />
                                        <div className="flex-1 font-bold text-foreground">
                                            {log.new_value || <span className="italic text-[10px]">vazio</span>}
                                        </div>
                                    </div>

                                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                        <User className="h-3 w-3" /> Alterado por: <span className="text-foreground">{log.author?.name || 'Sistema'}</span>
                                        {log.change_reason && <span className="opacity-50">• Motivo: {log.change_reason}</span>}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
                                    <Clock className="h-10 w-10 text-white/10 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">Nenhuma alteração auditável registrada ainda.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default PacienteDetalhe;
