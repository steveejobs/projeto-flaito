import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeSession } from "@/hooks/useOfficeSession";
import { useMedicalPatient } from "@/contexts/MedicalPatientContext";
import {
    ArrowLeft, Activity, User, Clock, CheckCircle2,
    Mic, Play, FileText, Pill, AlertTriangle, Search,
    Plus, History, ClipboardList, ScanLine, X, Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import PrescricaoCta from "../atendimento/PrescricaoCta";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// Removemos a constante SNIPPETS fixa para usar dinamicamente do banco de dados

export default function AtendimentoMedicoPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState("anamnese");
    const [anamnese, setAnamnese] = useState("");
    const [exameFisico, setExameFisico] = useState("");
    const [hipoteses, setHipoteses] = useState("");
    const [conduta, setConduta] = useState("");
    const [prescricoes, setPrescricoes] = useState<any[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [showShortcutHint, setShowShortcutHint] = useState(false);

    // Supabase Integration
    const { user } = useAuth();
    const { officeId } = useOfficeSession(user?.id);
    const { setActivePatient, clearActivePatient } = useMedicalPatient();
    const [isLoading, setIsLoading] = useState(true);
    const [agendaItem, setAgendaItem] = useState<any>(null);
    const [medicalSettings, setMedicalSettings] = useState<any>(null);
    const [userSnippets, setUserSnippets] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!id || !officeId || !user) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Atendimento
                const { data: agendaData, error: agendaError } = await supabase
                    .from('agenda_medica' as any)
                    .select('*, pacientes(*)')
                    .eq('id', id)
                    .eq('office_id', officeId)
                    .single() as any;

                if (agendaError) throw agendaError;
                setAgendaItem(agendaData);

                // Fetch Configurações Médicas (Cabeçalho/Rodapé)
                const { data: settingsData } = await supabase
                    .from('user_medical_settings' as any)
                    .select('*')
                    .eq('user_id', user.id)
                    .single() as any;
                
                if (settingsData) setMedicalSettings(settingsData);

                // Fetch Snippets
                const { data: snippetsData } = await supabase
                    .from('user_medical_snippets' as any)
                    .select('*')
                    .eq('user_id', user.id);
                
                if (snippetsData && snippetsData.length > 0) {
                    const snippetsMap: Record<string, string> = {};
                    snippetsData.forEach((s: any) => {
                        snippetsMap[s.shortcut] = s.content;
                    });
                    setUserSnippets(snippetsMap);
                }

            } catch (error: any) {
                console.error("Erro ao carregar dados:", error);
                toast.error("Erro ao carregar os dados do atendimento.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id, officeId, user]);

    useEffect(() => {
        if (agendaItem?.pacientes) {
            const pac = agendaItem.pacientes;
            setActivePatient({
                id: pac.id,
                nome: pac.nome,
                cpf: pac.cpf,
                telefone: pac.telefone
            });
        }
    }, [agendaItem, setActivePatient]);

    // Manipulador de atalhos textuais
    const handleTextChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>,
        setter: React.Dispatch<React.SetStateAction<string>>
    ) => {
        const text = e.target.value;

        // Detecta se a última palavra digitada começa com "/"
        const words = text.split(" ");
        const lastWord = words[words.length - 1];

        if (lastWord.startsWith("/")) {
            setShowShortcutHint(true);
            if (userSnippets[lastWord]) {
                // Substitui o snippet e atualiza o estado
                const newText = text.replace(lastWord, userSnippets[lastWord]);
                setter(newText);
                setShowShortcutHint(false);
                toast.success(`Atalho ${lastWord} inserido com sucesso.`);
                return;
            }
        } else {
            setShowShortcutHint(false);
        }

        setter(text);
    };

    const handleFinalizar = async () => {
        if (!agendaItem || !officeId || !user) {
            toast.error("Erro ao processar. Faltam dados.");
            return;
        }

        try {
            // 1. Criar a consulta (prontuário)
            const { data: consultaData, error: consultaError } = await supabase
                .from('consultas' as any)
                .insert({
                    office_id: officeId,
                    paciente_id: agendaItem.paciente_id,
                    profissional_id: user.id,
                    historico: anamnese,
                    exame_fisico: exameFisico,
                    observacoes: hipoteses,
                    status: 'realizada'
                })
                .select()
                .single() as any;

            if (consultaError) throw consultaError;

            // 1.5. Salvar prescrições médicas se houver items
            if (prescricoes.length > 0) {
                const { error: prescricoesError } = await supabase
                    .from('prescricoes_medicas' as any)
                    .insert({
                        office_id: officeId,
                        paciente_id: agendaItem.paciente_id,
                        profissional_id: user.id,
                        consulta_id: (consultaData as any).id,
                        medicamentos: prescricoes
                    });

                if (prescricoesError) throw prescricoesError;
            }

            // 2. Atualizar o status da agenda para 'finalizado'
            const { error: agendaError } = await supabase
                .from('agenda_medica' as any)
                .update({ status: 'finalizado' })
                .eq('id', agendaItem.id);

            if (agendaError) throw agendaError;

            toast.success("Atendimento salvo com sucesso!");
            clearActivePatient();
            navigate("/medical/agenda");
        } catch (error: any) {
            console.error("Erro ao finalizar:", error);
            toast.error("Não foi possível salvar a consulta. " + error.message);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen bg-background items-center justify-center">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <p className="text-muted-foreground font-medium">Carregando dados do paciente...</p>
                </div>
            </div>
        );
    }

    const paciente = agendaItem?.pacientes;
    const pnome = paciente?.nome || agendaItem?.paciente_nome || "Paciente não identificado";
    const iniciais = pnome.substring(0, 2).toUpperCase();
    const isPrimeiraConsulta = agendaItem?.tipo_consulta === 'primeira_vez';

    return (
        <div className="flex h-screen bg-background overflow-hidden">

            {/* 1. LEFTSIDEBAR - Informações Clínicas Cruciais (Nunca é ocultada) */}
            <div className="w-[320px] lg:w-[380px] bg-card border-r border-border flex flex-col z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                {/* Paciente Header */}
                <div className="p-5 border-b border-border/50 bg-muted/30">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/medical/agenda')}
                        className="mb-4 text-xs font-semibold h-7 text-muted-foreground hover:text-foreground pl-2 bg-muted/50"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar à Agenda
                    </Button>

                    <div className="flex gap-4 items-center">
                        <div className="h-16 w-16 bg-gradient-to-br from-teal-500 to-emerald-400 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-sm p-1">
                            <div className="bg-white/20 w-full h-full rounded-full flex items-center justify-center border-2 border-white/30 backdrop-blur-sm">
                                {iniciais}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-foreground tracking-tight leading-none mb-1">
                                {pnome}
                            </h2>
                            <p className="text-sm font-medium text-muted-foreground">
                                {paciente?.sexo === 'M' ? 'Masc.' : paciente?.sexo === 'F' ? 'Fem.' : ''}
                            </p>
                            {isPrimeiraConsulta && (
                                <Badge className="mt-2 bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 shadow-none font-bold">
                                    1ª Consulta
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Alertas Críticos (Topo visual) */}
                {(paciente?.alergias || paciente?.alertas_criticos) && (
                    <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/50 dark:bg-rose-950/20">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                            <h3 className="text-xs font-black uppercase text-rose-600 tracking-widest">Informações Vitais</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {paciente?.alergias?.map((alergia: string, idx: number) => (
                                <TooltipProvider key={idx} delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="destructive" className="bg-rose-500 hover:bg-rose-600 cursor-help font-bold shadow-sm">
                                                Alergia: {alergia}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="bg-rose-600 border-none font-medium">Registrado no prontuário</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                            {paciente?.condicoes_cronicas?.map((condicao: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-rose-600 border-rose-200 bg-white font-bold shadow-sm">
                                    {condicao}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                <ScrollArea className="flex-1 p-5">
                    <div className="space-y-6">
                        {/* Uso Contínuo */}
                        <div>
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                <Pill className="w-3.5 h-3.5" />
                                Uso Contínuo
                            </h3>
                            <div className="space-y-2">
                                {paciente?.medicamentos_uso_continuo?.length > 0 ? (
                                    paciente.medicamentos_uso_continuo.map((m: any, idx: number) => (
                                        <div key={idx} className="text-sm font-semibold flex justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <span>{m.nome}</span>
                                            <span className="text-slate-400">{m.posologia}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">Nenhum medicamento registrado.</p>
                                )}
                            </div>
                        </div>

                        {/* Timeline Histórico Rápido */}
                        <div>
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                <History className="w-3.5 h-3.5" />
                                Histórico Rápido
                            </h3>
                            <div className="relative pl-3 border-l-2 border-border space-y-4">
                                {paciente?.historico_resumo?.length > 0 ? (
                                    paciente.historico_resumo.map((h: any, idx: number) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute w-2.5 h-2.5 bg-muted-foreground/30 rounded-full -left-[18px] top-1 border-2 border-background"></div>
                                            <p className="text-xs font-bold text-muted-foreground">{h.periodo}</p>
                                            <p className="text-sm font-medium text-foreground/80 mt-0.5">{h.evento}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">Sem registros históricos anteriores.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>

            {/* 2. ÁREA CENTRAL - PEP SINGLE-SCREEN (Foco e Escrita Rápida) */}
            <div className="flex-1 flex flex-col relative bg-muted/20">

                {/* Topbar Flutuante */}
                <div className="h-16 px-6 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        <h1 className="text-sm font-bold tracking-widest text-emerald-700 uppercase">Em Atendimento</h1>
                        <span className="text-sm font-medium text-muted-foreground ml-2 border-l border-border pl-3">Iniciado às {format(new Date(), "HH:mm")}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 h-9 font-bold transition-all bg-white hover:bg-slate-50 text-teal-700 border-teal-200 hover:border-teal-300"
                            onClick={() => navigate('/medical/transcricao')}
                        >
                            <Mic className="w-4 h-4" />
                            Preencher com IA (Transcrição)
                        </Button>
                        <Button
                            size="sm"
                            className="gap-2 h-9 font-bold bg-slate-800 text-white hover:bg-slate-900 ml-2"
                            onClick={handleFinalizar}
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Finalizar e Salvar Consulta
                        </Button>
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="max-w-[800px] mx-auto p-6 md:p-8 space-y-6">

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 shadow-sm mb-6">
                            <Activity className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-800">Dica de Produtividade: Atalhos de Texto</p>
                                <p className="text-xs font-medium text-amber-700 mt-0.5">Digite <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">/normal</code> no Exame Físico e veja a mágica acontecer. Tente também <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">/neuro</code> e <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">/cardio</code>.</p>
                            </div>
                        </div>

                        {/* Abas Superiores para organizar, mas com layout de documento contínuo */}
                        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                            <div className="p-1 bg-muted/30 border-b border-border/50">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="w-full justify-start h-auto p-1 bg-transparent gap-1">
                                        <TabsTrigger value="anamnese" className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-bold tracking-tight rounded-xl px-4 py-2">HDA / Anamnese</TabsTrigger>
                                        <TabsTrigger value="exame" className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-bold tracking-tight rounded-xl px-4 py-2">Exame Físico</TabsTrigger>
                                        <TabsTrigger value="diagnostico" className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-bold tracking-tight rounded-xl px-4 py-2">Hipóteses / CID</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            <div className="p-6">
                                <div className={`space-y-3 ${activeTab !== 'anamnese' && 'hidden'}`}>
                                    <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                                        <span>História da Doença Atual (Queixa e Duração)</span>
                                        <Button variant="ghost" size="sm" className="h-6 text-xs text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-md">
                                            <ScanLine className="w-3 h-3 mr-1" /> IA Otimizar
                                        </Button>
                                    </label>
                                    <Textarea
                                        placeholder="Descreva a queixa do paciente..."
                                        className="min-h-[250px] resize-none text-base p-4 leading-relaxed font-medium bg-slate-50/50 border-slate-200 focus:bg-white transition-colors placeholder:text-slate-400"
                                        value={anamnese}
                                        onChange={(e) => handleTextChange(e, setAnamnese)}
                                    />
                                    {showShortcutHint && anamnese.includes("/") && (
                                        <p className="text-xs text-teal-600 font-bold animate-pulse">
                                            Aguardando finalização do atalho...
                                        </p>
                                    )}
                                </div>

                                <div className={`space-y-3 ${activeTab !== 'exame' && 'hidden'}`}>
                                    <label className="text-sm font-bold text-slate-700">Exame Físico Direcionado</label>
                                    <Textarea
                                        placeholder="Sinais vitais, inspeção, palpação, ausculta... Digite / para inserir modelos."
                                        className="min-h-[250px] resize-none text-base p-4 leading-relaxed font-medium bg-slate-50/50 border-slate-200 focus:bg-white transition-colors placeholder:text-slate-400"
                                        value={exameFisico}
                                        onChange={(e) => handleTextChange(e, setExameFisico)}
                                    />
                                    {showShortcutHint && exameFisico.includes("/") && (
                                        <div className="bg-slate-800 text-white text-xs font-bold p-2 flex items-center gap-2 rounded-md shadow-lg animate-in fade-in slide-in-from-bottom-2">
                                            <Sparkles className="w-3 h-3" /> Sugestões disponíveis: {Object.keys(userSnippets).length > 0 ? Object.keys(userSnippets).join(", ") : "Nenhum atalho configurado"}
                                        </div>
                                    )}
                                </div>

                                <div className={`space-y-3 ${activeTab !== 'diagnostico' && 'hidden'}`}>
                                    <label className="text-sm font-bold text-slate-700">Raciocínio Clínico e Hipóteses</label>
                                    <Textarea
                                        placeholder="Descreva a linha de raciocínio, diagnósticos diferenciais e CID (opcional)..."
                                        className="min-h-[250px] resize-none text-base p-4 leading-relaxed font-medium bg-slate-50/50 border-slate-200 focus:bg-white transition-colors"
                                        value={hipoteses}
                                        onChange={(e) => handleTextChange(e, setHipoteses)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Prescrição Direta Acoplada Abaixo */}
                        <h2 className="text-lg font-black text-slate-800 pt-4 flex items-center gap-2 print:hidden">
                            <FileText className="w-5 h-5 text-teal-600" />
                            Conduta e Prescrição Inteligente
                        </h2>
                        <div className="bg-white rounded-2xl shadow-[0_4px_24px_-12px_rgba(0,0,0,0.1)] border border-slate-200 p-6 print:hidden">
                            <PrescricaoCta 
                                prescricoes={prescricoes} 
                                setPrescricoes={setPrescricoes} 
                                pacienteNome={pnome}
                                medicalSettings={medicalSettings}
                                profissionalNome={user?.user_metadata?.name || 'Médico'}
                            />
                        </div>

                        <div className="h-12" /> {/* Extra padding at bottom */}
                    </div>
                </ScrollArea>
            </div>

        </div>
    );
}
