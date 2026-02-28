import React, { useState } from 'react';
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

    const handleAnalisar = () => {
        setStatus('processing');
        setTimeout(() => setStatus('done'), 3500);
    };

    // Mock results
    const mockResults = {
        estrutura: 'Paciente feminina, 42 anos. Queixa principal: fadiga crônica e dificuldade de concentração há 6 meses, com piora progressiva. Relata sono não reparador, irritabilidade e episódios de cefaleia tensional.',
        hipoteses: [
            'Deficiência de micronutrientes (vitamina D, magnésio, B12, ferro)',
            'Síndrome de fadiga crônica (CFS/ME)',
            'Hipotireoidismo subclínico',
            'Distúrbio do eixo HPA (cortisol)',
            'Disfunção mitocondrial',
        ],
        nutricao: {
            avaliacao: 'Padrão alimentar com baixa ingestão de vegetais crucíferos, proteínas de alto valor biológico e gorduras saudáveis. Relata consumo elevado de carboidratos refinados e café (4+ xícaras/dia).',
            hipoteses: [
                'Depleção de magnésio (consumo elevado de cafeína)',
                'Perfil inflamatório elevado (dieta pró-inflamatória)',
                'Deficiência de B12 e ferro (especialmente se vegetariana parcial)',
                'Disbiose intestinal provável',
            ],
            protocolos: [
                'Avaliar micronutrientes: Vitamina D 25(OH), B12, Ferro sérico + Ferritina, Magnésio eritrocitário',
                'Considerar dieta anti-inflamatória com aumento de ômega-3',
                'Suplementação de magnésio quelato 300mg/dia (evidência B)',
                'Redução gradual de cafeína a 2 xícaras/dia',
            ],
            referencias: ['Tardy et al. (2020) Nutrients. "Vitamins and Minerals for Energy, Fatigue and Cognition"', 'Boyle et al. (2017) Nutrients. "The Effects of Magnesium Supplementation"'],
        },
        integrativa: {
            terapias: [
                { nome: 'Acupuntura', descricao: 'Protocolos para fadiga crônica e cefaleia tensional. Evidência moderada (nível B).', evidencia: 'B' },
                { nome: 'Fitoterapia — Rhodiola rosea', descricao: 'Adaptógeno com evidência para fadiga mental e física. Dose sugerida: 200-400mg/dia extrato padronizado.', evidencia: 'B' },
                { nome: 'Fitoterapia — Ashwagandha', descricao: 'Withania somnifera — modulação do eixo HPA, ansiedade e fadiga. Dose: 300-600mg/dia.', evidencia: 'B' },
                { nome: 'Meditação Mindfulness', descricao: 'Protocolo MBSR 8 semanas para manejo de estresse e melhora cognitiva.', evidencia: 'A' },
            ],
            referencias: ['Anghelescu et al. (2018) Phytomedicine. "Stress management and the role of Rhodiola rosea"', 'Chandrasekhar et al. (2012) Indian J Psychol Med. "Ashwagandha root extract safety and efficacy"'],
        },
        neurologia: {
            avaliacao: 'Queixas cognitivas (atenção sustentada, memória de trabalho) compatíveis com padrão de fadiga mental. Sem sinais focais neurológicos descritos. Padrão sugere comprometimento atencional secundário a distúrbio metabólico ou de sono.',
            correlacoes: [
                'Fadiga + dificuldade de concentração → investigar perfil tireoidiano e ferro',
                'Sono não reparador → considerar polissonografia para apneia obstrutiva',
                'Cefaleia tensional + bruxismo → avaliação de ATM e estresse musculoesquelético',
            ],
            investigacao: [
                'Avaliação neuropsicológica breve (MoCA ou MEEM ampliado)',
                'Polissonografia ou actigrafia para avaliação objetiva do sono',
                'Dosagem de cortisol salivar (curva diurna)',
                'Considerar RNM de crânio se cefaleia atípica ou sinais focais',
            ],
            referencias: ['Cockshell & Mathias (2014) Neuropsychol Rev. "Cognitive functioning in CFS"'],
        },
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
                            <Select>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Vincular paciente..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Maria Silva Santos</SelectItem>
                                    <SelectItem value="2">João Pedro Oliveira</SelectItem>
                                    <SelectItem value="3">Ana Beatriz Costa</SelectItem>
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
                                <p className="text-sm text-foreground leading-relaxed">{mockResults.estrutura}</p>
                            </Card>

                            {/* Hipóteses */}
                            <Card className="bento-card p-5">
                                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Brain className="h-4 w-4" /> Hipóteses Possíveis
                                </h3>
                                <div className="space-y-2">
                                    {mockResults.hipoteses.map((h, i) => (
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
                                            <p className="text-sm text-foreground leading-relaxed">{mockResults.nutricao.avaliacao}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Hipóteses Nutricionais</p>
                                            <ul className="space-y-1">
                                                {mockResults.nutricao.hipoteses.map((h, i) => (
                                                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                                        <span className="text-orange-400">•</span> {h}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Protocolos Sugeridos</p>
                                            <ul className="space-y-1">
                                                {mockResults.nutricao.protocolos.map((p, i) => (
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
                                            {mockResults.nutricao.referencias.map((r, i) => (
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
                                                {mockResults.integrativa.terapias.map((t, i) => (
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
                                            {mockResults.integrativa.referencias.map((r, i) => (
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
                                            <p className="text-sm text-foreground leading-relaxed">{mockResults.neurologia.avaliacao}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Correlações Sintoma-Condição</p>
                                            <ul className="space-y-1">
                                                {mockResults.neurologia.correlacoes.map((c, i) => (
                                                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                                        <span className="text-purple-400">⟶</span> {c}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Investigação Complementar Sugerida</p>
                                            <ul className="space-y-1">
                                                {mockResults.neurologia.investigacao.map((inv, i) => (
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
                                            {mockResults.neurologia.referencias.map((r, i) => (
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
