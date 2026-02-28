import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Mic,
    Upload,
    FileAudio,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    ClipboardList,
    Stethoscope,
    MessageSquare,
    Activity,
    PenTool,
} from "lucide-react";

const TranscricaoPage = () => {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');
    const [manualMode, setManualMode] = useState(false);

    // Mock de resultado estruturado
    const mockResult = {
        queixa: 'Cefaleia tensional persistente há 3 semanas, com piora no período vespertino. Dor holocraniana, intensidade 6/10, sem aura.',
        sintomas: 'Cefaleia tensional, tensão muscular cervical, fadiga vespertina, dificuldade de concentração, bruxismo noturno relatado pela paciente.',
        historico: 'Paciente feminina, 38 anos. Sem antecedentes neurológicos. Uso prévio de ibuprofeno com alívio parcial. Trabalha 10h/dia em escritório com uso prolongado de computador.',
        conduta: 'Solicitação de hemograma completo, perfil tireoidiano e vitamina D. Orientação ergonômica. Avaliação de magnésio sérico. Retorno em 15 dias com exames.',
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.type.includes('audio') || file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i))) {
            setAudioFile(file);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setAudioFile(file);
    };

    const handleProcessar = () => {
        setStatus('processing');
        setTimeout(() => setStatus('done'), 3000);
    };

    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <header className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                    Transcrição Clínica
                </h1>
                <p className="text-muted-foreground">
                    Upload de áudio de consulta com transcrição estruturada e extração automática de informações clínicas.
                </p>
            </header>

            {/* Disclaimer */}
            <Card className="p-4 border-amber-500/20 bg-amber-500/5">
                <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-400">Suporte à Decisão Clínica</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            A transcrição e extração automática são ferramentas de apoio. Revise e valide todas as informações antes de registrar no prontuário do paciente.
                        </p>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload / Input Column */}
                <div className="space-y-6">
                    {/* Toggle Mode */}
                    <div className="flex gap-2">
                        <Button
                            variant={!manualMode ? "default" : "outline"}
                            onClick={() => setManualMode(false)}
                            className={`gap-2 ${!manualMode ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : ''}`}
                            size="sm"
                        >
                            <Mic className="h-4 w-4" /> Upload de Áudio
                        </Button>
                        <Button
                            variant={manualMode ? "default" : "outline"}
                            onClick={() => setManualMode(true)}
                            className={`gap-2 ${manualMode ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : ''}`}
                            size="sm"
                        >
                            <PenTool className="h-4 w-4" /> Transcrição Manual
                        </Button>
                    </div>

                    {!manualMode ? (
                        /* Audio Upload Zone */
                        <Card
                            className={`bento-card p-8 border-2 border-dashed transition-all cursor-pointer ${isDragging
                                    ? 'border-violet-400 bg-violet-500/5'
                                    : 'border-white/10 hover:border-violet-400/50'
                                }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('audio-input')?.click()}
                        >
                            <input
                                id="audio-input"
                                type="file"
                                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <div className="text-center space-y-4">
                                {audioFile ? (
                                    <>
                                        <div className="p-4 bg-violet-500/10 rounded-2xl inline-flex">
                                            <FileAudio className="h-10 w-10 text-violet-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-foreground">{audioFile.name}</p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); setAudioFile(null); }}
                                        >
                                            Trocar arquivo
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-4 bg-violet-500/10 rounded-2xl inline-flex">
                                            <Upload className="h-10 w-10 text-violet-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-foreground">
                                                Arraste o áudio da consulta aqui
                                            </p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                ou clique para selecionar — MP3, WAV, M4A, OGG
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>
                    ) : (
                        /* Manual Transcription */
                        <Card className="bento-card p-6 space-y-4">
                            <Label className="text-sm font-semibold">Transcrição Manual da Consulta</Label>
                            <Textarea
                                placeholder="Cole ou digite a transcrição da consulta aqui. O sistema irá extrair automaticamente as informações clínicas estruturadas..."
                                className="min-h-[300px] text-sm"
                            />
                        </Card>
                    )}

                    {/* Patient selection */}
                    <Card className="bento-card p-5 space-y-4">
                        <Label className="text-sm font-semibold">Vincular a Paciente (opcional)</Label>
                        <Select>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecionar paciente..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">Maria Silva Santos</SelectItem>
                                <SelectItem value="2">João Pedro Oliveira</SelectItem>
                                <SelectItem value="3">Ana Beatriz Costa</SelectItem>
                            </SelectContent>
                        </Select>
                    </Card>

                    {/* Process button */}
                    <Button
                        onClick={handleProcessar}
                        disabled={status === 'processing' || (!audioFile && !manualMode)}
                        className="w-full gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20 h-12 text-base"
                    >
                        {status === 'processing' ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Processando transcrição...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-5 w-5" />
                                Processar Transcrição
                            </>
                        )}
                    </Button>
                </div>

                {/* Results Column */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-violet-400" />
                        Extração Clínica Estruturada
                    </h2>

                    {status === 'idle' && (
                        <Card className="bento-card p-12 text-center">
                            <Stethoscope className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
                            <p className="text-muted-foreground">
                                Faça upload de um áudio ou transcreva manualmente para ver a extração estruturada aqui.
                            </p>
                        </Card>
                    )}

                    {status === 'processing' && (
                        <Card className="bento-card p-12 text-center">
                            <Loader2 className="h-12 w-12 mx-auto text-violet-400 animate-spin mb-4" />
                            <p className="text-foreground font-medium">Analisando transcrição...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Extraindo queixa principal, sintomas, histórico e conduta.
                            </p>
                        </Card>
                    )}

                    {status === 'done' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card className="bento-card p-5 border-l-4 border-l-blue-500">
                                <div className="flex items-start gap-3">
                                    <MessageSquare className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Queixa Principal</p>
                                        <p className="text-sm text-foreground leading-relaxed">{mockResult.queixa}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="bento-card p-5 border-l-4 border-l-amber-500">
                                <div className="flex items-start gap-3">
                                    <Activity className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Sintomas Identificados</p>
                                        <p className="text-sm text-foreground leading-relaxed">{mockResult.sintomas}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="bento-card p-5 border-l-4 border-l-cyan-500">
                                <div className="flex items-start gap-3">
                                    <ClipboardList className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Histórico Relevante</p>
                                        <p className="text-sm text-foreground leading-relaxed">{mockResult.historico}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="bento-card p-5 border-l-4 border-l-emerald-500">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Conduta</p>
                                        <p className="text-sm text-foreground leading-relaxed">{mockResult.conduta}</p>
                                    </div>
                                </div>
                            </Card>

                            <div className="flex gap-3 pt-2">
                                <Button className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                                    <CheckCircle2 className="h-4 w-4" /> Salvar no Prontuário
                                </Button>
                                <Button variant="outline" className="gap-2">
                                    <PenTool className="h-4 w-4" /> Editar Resultado
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TranscricaoPage;
