import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft, Activity, User, Clock, CheckCircle2,
    Mic, Play, FileText, Pill, AlertTriangle, Search,
    Plus, History, ClipboardList, ScanLine, X
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard } from "@/components/ui/glass-card";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import PrescricaoCta from "../atendimento/PrescricaoCta";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// Simulação de Snippets (Atalhos expansíveis)
const SNIPPETS: Record<string, string> = {
    "/normal": "Murmúrio vesicular presente e simétrico bilateralmente, sem ruídos adventícios. Bulhas normofonéticas rítmicas em 2 tempos, sem sopros. Abdome flácido, indolor à palpação, sem visceromegalias. Extremidades bem perfundidas, sem edema.",
    "/cardio": "Ritmo cardíaco regular, em 2 tempos, bulhas normofonéticas, sem sopros audíveis. PA aferida em decúbito e ortostase sem alterações significativas. Estase jugular 45º ausente. Pulsos periféricos amplos e simétricos.",
    "/pulmao": "Expansibilidade preservada. Som claro pulmonar à percussão. Murmúrio vesicular presente bilateralmente, sem ruídos adventícios.",
    "/neuro": "Paciente lúcido, orientado em tempo e espaço. Pupilas isocóricas e fotorreagentes. Força motora preservada grau V global. Sensibilidade tátil e dolorosa preservadas. Reflexos profundos simétricos."
};

export default function AtendimentoMedicoPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState("anamnese");
    const [anamnese, setAnamnese] = useState("");
    const [exameFisico, setExameFisico] = useState("");
    const [hipoteses, setHipoteses] = useState("");
    const [conduta, setConduta] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [showShortcutHint, setShowShortcutHint] = useState(false);

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
            if (SNIPPETS[lastWord]) {
                // Substitui o snippet e atualiza o estado
                const newText = text.replace(lastWord, SNIPPETS[lastWord]);
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

    const handleFinalizar = () => {
        toast.success("Atendimento salvo com sucesso!");
        navigate("/medical/agenda");
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden dark:bg-slate-950">

            {/* 1. LEFTSIDEBAR - Informações Clínicas Cruciais (Nunca é ocultada) */}
            <div className="w-[320px] lg:w-[380px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                {/* Paciente Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/medical/agenda')}
                        className="mb-4 text-xs font-semibold h-7 text-slate-500 hover:text-slate-800 pl-2 bg-slate-200/50 hover:bg-slate-200"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar à Agenda
                    </Button>

                    <div className="flex gap-4 items-center">
                        <div className="h-16 w-16 bg-gradient-to-br from-teal-500 to-emerald-400 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-sm p-1">
                            <div className="bg-white/20 w-full h-full rounded-full flex items-center justify-center border-2 border-white/30 backdrop-blur-sm">
                                RO
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none mb-1">
                                Roberto Costa
                            </h2>
                            <p className="text-sm font-medium text-slate-500">42 anos • Masc.</p>
                            <Badge className="mt-2 bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 shadow-none font-bold">
                                1ª Consulta
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Alertas Críticos (Topo visual) */}
                <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/50 dark:bg-rose-950/20">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <h3 className="text-xs font-black uppercase text-rose-600 tracking-widest">Informações Vitais</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge variant="destructive" className="bg-rose-500 hover:bg-rose-600 cursor-help font-bold shadow-sm">
                                        Alergia: Penicilina
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="bg-rose-600 border-none font-medium">Reação anafilática severa (2018)</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Badge variant="outline" className="text-rose-600 border-rose-200 bg-white font-bold shadow-sm">
                            Hipertenso
                        </Badge>
                    </div>
                </div>

                <ScrollArea className="flex-1 p-5">
                    <div className="space-y-6">
                        {/* Uso Contínuo */}
                        <div>
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                <Pill className="w-3.5 h-3.5" />
                                Uso Contínuo
                            </h3>
                            <div className="space-y-2">
                                <div className="text-sm font-semibold flex justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span>Losartana 50mg</span>
                                    <span className="text-slate-400">1x/dia</span>
                                </div>
                                <div className="text-sm font-semibold flex justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span>Atenolol 25mg</span>
                                    <span className="text-slate-400">2x/dia</span>
                                </div>
                            </div>
                        </div>

                        {/* Timeline Histórico Rápido */}
                        <div>
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                <History className="w-3.5 h-3.5" />
                                Histórico Rápido
                            </h3>
                            <div className="relative pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-4">
                                <div className="relative">
                                    <div className="absolute w-2.5 h-2.5 bg-slate-300 rounded-full -left-[18px] top-1 border-2 border-white"></div>
                                    <p className="text-xs font-bold text-slate-500">Há 3 meses</p>
                                    <p className="text-sm font-medium text-slate-700 mt-0.5">Consulta de Rotina. Pressão controlada (12x8).</p>
                                </div>
                                <div className="relative">
                                    <div className="absolute w-2.5 h-2.5 bg-slate-300 rounded-full -left-[18px] top-1 border-2 border-white"></div>
                                    <p className="text-xs font-bold text-slate-500">Há 1 ano</p>
                                    <p className="text-sm font-medium text-slate-700 mt-0.5">Diagnóstico de Hipertensão Primária.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>

            {/* 2. ÁREA CENTRAL - PEP SINGLE-SCREEN (Foco e Escrita Rápida) */}
            <div className="flex-1 flex flex-col relative bg-slate-100 dark:bg-slate-950">

                {/* Topbar Flutuante */}
                <div className="h-16 px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        <h1 className="text-sm font-bold tracking-widest text-emerald-700 uppercase">Em Atendimento</h1>
                        <span className="text-sm font-medium text-slate-400 ml-2 border-l border-slate-200 pl-3">Iniciado às {format(new Date(), "HH:mm")}</span>
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
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-1 bg-slate-50 border-b border-slate-100">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="w-full justify-start h-auto p-1 bg-transparent gap-1">
                                        <TabsTrigger value="anamnese" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm font-bold tracking-tight rounded-xl px-4 py-2">HDA / Anamnese</TabsTrigger>
                                        <TabsTrigger value="exame" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm font-bold tracking-tight rounded-xl px-4 py-2">Exame Físico</TabsTrigger>
                                        <TabsTrigger value="diagnostico" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm font-bold tracking-tight rounded-xl px-4 py-2">Hipóteses / CID</TabsTrigger>
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
                                            <Sparkles className="w-3 h-3" /> Sugestões detectadas: /normal, /cardio, /pulmao, /neuro
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
                        <h2 className="text-lg font-black text-slate-800 pt-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-teal-600" />
                            Conduta e Prescrição Inteligente
                        </h2>
                        <div className="bg-white rounded-2xl shadow-[0_4px_24px_-12px_rgba(0,0,0,0.1)] border border-slate-200 p-6">
                            <PrescricaoCta />
                        </div>

                        <div className="h-12" /> {/* Extra padding at bottom */}
                    </div>
                </ScrollArea>
            </div>

        </div>
    );
}
