import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Brain,
    Sparkles,
    Loader2,
    AlertCircle,
    Apple,
    Leaf,
    Activity,
    BookOpen,
    Shield,
    ChevronDown,
    ChevronUp,
    Eye,
    Upload,
    FileImage,
    Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { useToast } from "@/hooks/use-toast";
import { clientService } from "@/services/domain/clientService";

const AnaliseClinicaPage = () => {
    const [inputText, setInputText] = useState('');
    const [tipoAnalise, setTipoAnalise] = useState('completa');
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        nutricao: true,
        integrativa: true,
        neurologia: true,
    });

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const { officeId } = useOfficeRole();
    const { toast } = useToast();
    const [pacientes, setPacientes] = useState<any[]>([]);
    const [selectedPacienteId, setSelectedPacienteId] = useState<string>('');
    const [resultado, setResultado] = useState<any>(null);

    useEffect(() => {
        if (!officeId) return;
        const fetchPacientes = async () => {
            const data = await clientService.listMedicalPatients(officeId);
            if (data) setPacientes(data);
        };
        fetchPacientes();
    }, [officeId]);

    const handleAnalisar = async () => {
        setStatus('processing');
        
        try {
            // Real AI Edge Function Call
            const { data, error: functionError } = await supabase.functions.invoke('medical-agent-analysis', {
                body: {
                    officeId,
                    pacienteId: selectedPacienteId === 'none' ? null : selectedPacienteId,
                    inputText,
                    tipoAnalise,
                    agentType: 'clinical' // Avisa a edge function qual prompt puxar do ai_config
                }
            });

            if (functionError) throw new Error(functionError.message || "Erro na análise da IA");
            if (!data || !data.resultado) throw new Error("A IA não retornou um formato válido.");

            const generatedResult = data.resultado;
            setResultado(generatedResult);

            // Tenta salvar no BD o histórico (opcional/log)
            try {
                const { error: dbError } = await supabase.from('analises_clinicas').insert([{
                    office_id: officeId,
                    paciente_id: selectedPacienteId === 'none' ? null : selectedPacienteId,
                    tipo: tipoAnalise,
                    dados_entrada: { texto: inputText },
                    resultado: generatedResult,
                    hipoteses: generatedResult.hipoteses?.join('\n') || '',
                    abordagens_nutricionais: generatedResult.nutricao?.protocolos?.join('\n') || '',
                    abordagens_integrativas: generatedResult.integrativa?.terapias?.map((t:any) => t.nome).join('\n') || '',
                    sugestoes_investigacao: generatedResult.neurologia?.investigacao?.join('\n') || '',
                    referencias: [
                        ...(generatedResult.nutricao?.referencias || []), 
                        ...(generatedResult.integrativa?.referencias || []), 
                        ...(generatedResult.neurologia?.referencias || [])
                    ].join('\n')
                }]);
                if (dbError) console.error("Aviso: Falha não crítica salvando histórico:", dbError);
            } catch (e) {}

            toast({ title: "Sucesso", description: "Análise processada pela IA com sucesso!" });
            setStatus('done');
        } catch (error: any) {
            console.error("Erro na análise:", error);
            toast({ title: "Erro na IA", description: error.message || "Falha na comunicação com a IA.", variant: "destructive" });
            setStatus('idle');
        }
    };

    const evidenceColors: Record<string, string> = {
        A: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        C: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        D: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <header className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                    Análise Clínica Integrativa
                </h1>
                <p className="text-muted-foreground">
                    Motor de Apoio Multidisciplinar — Nutrição, Medicina Integrativa e Neurologia/Neuropsicologia.
                </p>
            </header>

            {/* Disclaimer  */}
            <Card className="p-4 border-amber-500/20 bg-amber-500/5">
                <div className="flex gap-3">
                    <Shield className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-400">⚕️ Suporte à Decisão Clínica — Não é Diagnóstico</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Este sistema é uma ferramenta assistiva multidisciplinar. Todas as hipóteses apresentadas são possibilidades a serem consideradas pelo profissional de saúde e <strong>não constituem diagnóstico definitivo</strong>. Sempre baseie suas decisões em avaliação clínica completa e exames complementares.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Input Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="bento-card p-5 space-y-4">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <Brain className="h-5 w-5 text-emerald-400" />
                            Dados para Análise
                        </h3>

                        <div>
                            <label className="text-sm text-muted-foreground">Tipo de Análise</label>
                            <Select value={tipoAnalise} onValueChange={setTipoAnalise}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="completa">Análise Completa (Multidisciplinar)</SelectItem>
                                    <SelectItem value="nutricao">Apenas Nutrição</SelectItem>
                                    <SelectItem value="integrativa">Apenas Medicina Integrativa</SelectItem>
                                    <SelectItem value="neurologia">Apenas Neurologia/Neuropsicologia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground">Paciente (opcional)</label>
                            <Select value={selectedPacienteId} onValueChange={setSelectedPacienteId}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Vincular paciente..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Nenhum</SelectItem>
                                    {pacientes.map((p) => (
                                        <SelectItem key={p.paciente_id || p.id} value={p.paciente_id || p.id}>{p.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground">Informações Clínicas</label>
                            <Textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Descreva o quadro clínico: queixa principal, sintomas, histórico relevante, exames disponíveis, medicamentos em uso..."
                                className="mt-1 min-h-[200px] text-sm"
                            />
                        </div>

                        {/* Iris Upload (optional) */}
                        <Card className="p-4 border-dashed border-2 border-white/10 hover:border-teal-400/30 transition-colors cursor-pointer text-center">
                            <FileImage className="h-8 w-8 mx-auto text-teal-400/60 mb-2" />
                            <p className="text-xs font-medium text-foreground">Upload de Imagem (Iridologia)</p>
                            <p className="text-xs text-muted-foreground mt-1">Análise descritiva — relatório interpretativo</p>
                            <div className="flex gap-1 items-center justify-center mt-2">
                                <Info className="h-3 w-3 text-amber-400" />
                                <span className="text-[10px] text-amber-400">Abordagem iridológica — não diagnóstica</span>
                            </div>
                        </Card>

                        <Button
                            onClick={handleAnalisar}
                            disabled={status === 'processing' || !inputText.trim()}
                            className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 h-12 text-base"
                        >
                            {status === 'processing' ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Analisando...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5" />
                                    Gerar Análise
                                </>
                            )}
                        </Button>
                    </Card>
                </div>

                {/* Results */}
                <div className="lg:col-span-2 space-y-4">
                    {status === 'idle' && (
                        <Card className="bento-card p-16 text-center">
                            <Brain className="h-20 w-20 mx-auto text-muted-foreground/15 mb-4" />
                            <p className="text-lg font-medium text-muted-foreground">Motor de Apoio Multidisciplinar</p>
                            <p className="text-sm text-muted-foreground/70 mt-2 max-w-md mx-auto">
                                Insira as informações clínicas do paciente para gerar uma análise integrativa com hipóteses, abordagens e referências científicas.
                            </p>
                        </Card>
                    )}

                    {status === 'processing' && (
                        <Card className="bento-card p-16 text-center">
                            <Loader2 className="h-14 w-14 mx-auto text-emerald-400 animate-spin mb-4" />
                            <p className="text-foreground font-semibold text-lg">Processando análise multidisciplinar...</p>
                            <p className="text-sm text-muted-foreground mt-2">Consultando bases de Nutrição, Medicina Integrativa e Neurologia.</p>
                        </Card>
                    )}

                    {status === 'done' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Estrutura Clínica */}
                            <Card className="bento-card p-5">
                                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Activity className="h-4 w-4" /> Estrutura Clínica
                                </h3>
                                <p className="text-sm text-foreground leading-relaxed">{resultado?.estrutura}</p>
                            </Card>

                            {/* Hipóteses */}
                            <Card className="bento-card p-5">
                                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Brain className="h-4 w-4" /> Hipóteses Possíveis
                                </h3>
                                <div className="space-y-2">
                                    {resultado?.hipoteses?.map((h: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <span className="text-xs text-blue-400 font-mono mt-0.5">{i + 1}.</span>
                                            <p className="text-sm text-foreground">{h}</p>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* NUTRIÇÃO */}
                            <Card className="bento-card overflow-hidden">
                                <button
                                    onClick={() => toggleSection('nutricao')}
                                    className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                                >
                                    <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-orange-400">
                                        <Apple className="h-5 w-5" /> 🔹 Nutrição
                                    </h3>
                                    {expandedSections.nutricao ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </button>
                                {expandedSections.nutricao && (
                                    <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Avaliação</p>
                                            <p className="text-sm text-foreground leading-relaxed">{resultado?.nutricao?.avaliacao}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Hipóteses Nutricionais</p>
                                            <ul className="space-y-1">
                                                {resultado?.nutricao?.hipoteses?.map((h: string, i: number) => (
                                                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                                        <span className="text-orange-400">•</span> {h}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Protocolos Sugeridos</p>
                                            <ul className="space-y-1">
                                                {resultado?.nutricao?.protocolos?.map((p: string, i: number) => (
                                                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                                        <span className="text-emerald-400">→</span> {p}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                                                <BookOpen className="h-3 w-3" /> Referências Científicas
                                            </p>
                                            {resultado?.nutricao?.referencias?.map((r: string, i: number) => (
                                                <p key={i} className="text-xs text-muted-foreground italic">{r}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card>

                            {/* MEDICINA INTEGRATIVA */}
                            <Card className="bento-card overflow-hidden">
                                <button
                                    onClick={() => toggleSection('integrativa')}
                                    className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                                >
                                    <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-green-400">
                                        <Leaf className="h-5 w-5" /> 🔹 Medicina Integrativa
                                    </h3>
                                    {expandedSections.integrativa ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </button>
                                {expandedSections.integrativa && (
                                    <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Terapias Complementares & Fitoterapia</p>
                                            <div className="space-y-3">
                                                {resultado?.integrativa?.terapias?.map((t: any, i: number) => (
                                                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-semibold text-sm text-foreground">{t.nome}</span>
                                                            <Badge variant="outline" className={evidenceColors[t.evidencia]}>
                                                                Nível {t.evidencia}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{t.descricao}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                                                <BookOpen className="h-3 w-3" /> Referências
                                            </p>
                                            {resultado?.integrativa?.referencias?.map((r: string, i: number) => (
                                                <p key={i} className="text-xs text-muted-foreground italic">{r}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card>

                            {/* NEUROLOGIA / NEUROPSICOLOGIA */}
                            <Card className="bento-card overflow-hidden">
                                <button
                                    onClick={() => toggleSection('neurologia')}
                                    className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                                >
                                    <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-purple-400">
                                        <Activity className="h-5 w-5" /> 🔹 Neurologia / Neuropsicologia
                                    </h3>
                                    {expandedSections.neurologia ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </button>
                                {expandedSections.neurologia && (
                                    <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Avaliação Cognitiva Descritiva</p>
                                            <p className="text-sm text-foreground leading-relaxed">{resultado?.neurologia?.avaliacao}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Correlações Sintoma-Condição</p>
                                            <ul className="space-y-1">
                                                {resultado?.neurologia?.correlacoes?.map((c: string, i: number) => (
                                                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                                        <span className="text-purple-400">⟶</span> {c}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Investigação Complementar Sugerida</p>
                                            <ul className="space-y-1">
                                                {resultado?.neurologia?.investigacao?.map((inv: string, i: number) => (
                                                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                                        <span className="text-cyan-400">→</span> {inv}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                                                <BookOpen className="h-3 w-3" /> Referências
                                            </p>
                                            {resultado?.neurologia?.referencias?.map((r: string, i: number) => (
                                                <p key={i} className="text-xs text-muted-foreground italic">{r}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                                    Salvar Análise
                                </Button>
                                <Button variant="outline" className="gap-2">
                                    Exportar PDF
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnaliseClinicaPage;
