import React, { useState, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
    Square,
    Volume2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { useToast } from "@/hooks/use-toast";
import { clientService } from "@/services/domain/clientService";

const TranscricaoPage = () => {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');
    const [inputMode, setInputMode] = useState<'upload' | 'record' | 'manual'>('upload');

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const { officeId } = useOfficeRole();
    const { toast } = useToast();
    const [pacientes, setPacientes] = useState<any[]>([]);
    const [selectedPacienteId, setSelectedPacienteId] = useState<string>('');
    const [resultado, setResultado] = useState<any>(null);
    const [transcricaoManual, setTranscricaoManual] = useState('');

    useEffect(() => {
        if (!officeId) return;
        const fetchPacientes = async () => {
            const data = await clientService.listMedicalPatients(officeId);
            if (data) setPacientes(data);
        };
        fetchPacientes();
    }, [officeId]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, []);

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

    const handleProcessar = async () => {
        if (!officeId) {
            toast({ title: "Erro", description: "Escritório não identificado.", variant: "destructive" });
            return;
        }

        setStatus('processing');

        // Simular chamada via delay (Aqui entraria a integração de IA)
        await new Promise(r => setTimeout(r, 3000));

        const generatedResult = {
            queixa: 'Cefaleia tensional persistente há 3 semanas, com piora no período vespertino. Dor holocraniana, intensidade 6/10, sem aura.',
            sintomas: 'Cefaleia tensional, tensão muscular cervical, fadiga vespertina, dificuldade de concentração, bruxismo noturno relatado.',
            historico: 'Paciente jovem adulta. Sem antecedentes neurológicos aparentes. Uso prévio de ibuprofeno.',
            conduta: 'Solicitação de exames, orientação ergonômica, retorno em 15 dias.',
        };
        setResultado(generatedResult);

        // Salvar no BD
        try {
            const { error } = await supabase.from('transcricoes').insert([{
                office_id: officeId,
                paciente_id: selectedPacienteId || null,
                transcricao_bruta: inputMode === 'manual' ? transcricaoManual : 'Áudio capturado em anexo.',
                queixa_extraida: generatedResult.queixa,
                sintomas_extraidos: generatedResult.sintomas,
                historico_extraido: generatedResult.historico,
                conduta_extraida: generatedResult.conduta,
                status: 'concluida'
            }]);

            if (error) throw error;
            toast({ title: "Sucesso", description: "Transcrição salva com sucesso no banco de dados." });
            setStatus('done');
        } catch (error) {
            console.error("Erro ao salvar transcrição:", error);
            toast({ title: "Erro", description: "Falha ao salvar a transcrição.", variant: "destructive" });
            setStatus('idle');
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const file = new File([audioBlob], `Gravacao_${new Date().toLocaleTimeString().replace(/:/g, '')}.webm`, { type: 'audio/webm' });
                setAudioFile(file);
                stream.getTracks().forEach(track => track.stop());
                setRecordingTime(0);
            };

            mediaRecorder.start(1000); // chunk every second
            setIsRecording(true);
            setAudioFile(null); // clear previous file when starting new recording

            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Erro ao acessar o microfone", err);
            alert("Não foi possível acessar o microfone. Verifique as permissões de áudio do seu navegador.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
    };

    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <header className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                    Transcrição Clínica
                </h1>
                <p className="text-muted-foreground">
                    Grave a consulta diretamente ou faça upload do áudio para transcrição estruturada e extração clínica.
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
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={inputMode === 'upload' ? "default" : "outline"}
                            onClick={() => setInputMode('upload')}
                            className={`gap-2 ${inputMode === 'upload' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : ''}`}
                            size="sm"
                        >
                            <Upload className="h-4 w-4" /> Upload de Áudio
                        </Button>
                        <Button
                            variant={inputMode === 'record' ? "default" : "outline"}
                            onClick={() => setInputMode('record')}
                            className={`gap-2 ${inputMode === 'record' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : ''}`}
                            size="sm"
                        >
                            <Mic className="h-4 w-4" /> Gravar Consulta
                        </Button>
                        <Button
                            variant={inputMode === 'manual' ? "default" : "outline"}
                            onClick={() => setInputMode('manual')}
                            className={`gap-2 ${inputMode === 'manual' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : ''}`}
                            size="sm"
                        >
                            <PenTool className="h-4 w-4" /> Digitação Manual
                        </Button>
                    </div>

                    {inputMode === 'upload' && (
                        /* Audio Upload Zone */
                        <Card
                            className={`bento-card p-8 border-2 border-dashed transition-all cursor-pointer ${isDragging
                                ? 'border-violet-400 bg-violet-500/5'
                                : 'border-white/10 hover:border-violet-400/50'
                                }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => !audioFile && document.getElementById('audio-input')?.click()}
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
                    )}

                    {inputMode === 'record' && (
                        /* Voice Recording Zone */
                        <Card className="bento-card p-8 border-2 border-white/10 text-center space-y-6">

                            {!isRecording && !audioFile && (
                                <>
                                    <div className="mx-auto p-4 bg-rose-500/10 rounded-full inline-flex">
                                        <Mic className="h-12 w-12 text-rose-400" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">Iniciar Gravação da Consulta</p>
                                        <p className="text-sm text-muted-foreground mt-1">Clique abaixo para capturar o áudio diretamente do seu microfone.</p>
                                    </div>
                                    <div className="flex justify-center">
                                        <Button
                                            onClick={startRecording}
                                            className="h-14 px-8 rounded-full gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 shadow-lg shadow-rose-500/20 text-base"
                                        >
                                            <Mic className="h-5 w-5" /> Iniciar Gravação
                                        </Button>
                                    </div>
                                </>
                            )}

                            {isRecording && (
                                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                                    <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full border-4 border-rose-500/30 animate-ping" style={{ animationDuration: '2s' }} />
                                        <div className="absolute inset-2 rounded-full border-4 border-rose-500/50 animate-pulse" />
                                        <div className="relative z-10 w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/50">
                                            <Volume2 className="h-8 w-8 text-white animate-pulse" />
                                        </div>
                                    </div>

                                    <div>
                                        <p className="font-bold text-3xl text-foreground font-mono">{formatTime(recordingTime)}</p>
                                        <p className="text-sm text-rose-400 font-medium animate-pulse mt-1">Gravando agora...</p>
                                    </div>

                                    <div className="flex justify-center">
                                        <Button
                                            variant="destructive"
                                            onClick={stopRecording}
                                            className="h-14 px-8 rounded-full gap-2 bg-white text-rose-600 hover:bg-rose-50 border-2 border-rose-100 shadow-lg text-base"
                                        >
                                            <Square className="h-5 w-5 fill-current" /> Parar e Salvar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {!isRecording && audioFile && inputMode === 'record' && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <div className="p-4 bg-emerald-500/10 rounded-2xl inline-flex">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">Gravação Finalizada com Sucesso</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Áudio pronto: {formatTime(recordingTime)} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                                        </p>
                                    </div>
                                    <div className="flex justify-center gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => setAudioFile(null)}
                                            className="h-10"
                                        >
                                            Descartar
                                        </Button>
                                        <Button
                                            onClick={handleProcessar}
                                            className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                                        >
                                            <Sparkles className="h-4 w-4" /> Processar Agora
                                        </Button>
                                    </div>
                                </div>
                            )}

                        </Card>
                    )}

                    {inputMode === 'manual' && (
                        /* Manual Transcription */
                        <Card className="bento-card p-6 space-y-4">
                            <Label className="text-sm font-semibold">Transcrição Manual da Consulta</Label>
                            <Textarea
                                value={transcricaoManual}
                                onChange={(e) => setTranscricaoManual(e.target.value)}
                                placeholder="Cole ou digite a transcrição da consulta aqui. O sistema irá extrair automaticamente as informações clínicas estruturadas..."
                                className="min-h-[300px] text-sm"
                            />
                        </Card>
                    )}

                    {/* Patient selection */}
                    <Card className="bento-card p-5 space-y-4">
                        <Label className="text-sm font-semibold">Vincular a Paciente (opcional)</Label>
                        <Select value={selectedPacienteId} onValueChange={setSelectedPacienteId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecionar paciente..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {pacientes.map((p) => (
                                    <SelectItem key={p.paciente_id || p.id} value={p.paciente_id || p.id}>{p.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Card>

                    {/* Process button (hide if still recording or if recording success screen has its own button) */}
                    {!(inputMode === 'record' && (isRecording || audioFile)) && (
                        <Button
                            onClick={handleProcessar}
                            disabled={status === 'processing' || (!audioFile && inputMode !== 'manual') || (inputMode === 'manual' && transcricaoManual.trim() === '')}
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
                    )}
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
                                Faça upload de um áudio, grave a consulta ou transcreva manualmente para ver a extração estruturada aqui.
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
                                        <p className="text-sm text-foreground leading-relaxed">{resultado?.queixa}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="bento-card p-5 border-l-4 border-l-amber-500">
                                <div className="flex items-start gap-3">
                                    <Activity className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Sintomas Identificados</p>
                                        <p className="text-sm text-foreground leading-relaxed">{resultado?.sintomas}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="bento-card p-5 border-l-4 border-l-cyan-500">
                                <div className="flex items-start gap-3">
                                    <ClipboardList className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Histórico Relevante</p>
                                        <p className="text-sm text-foreground leading-relaxed">{resultado?.historico}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="bento-card p-5 border-l-4 border-l-emerald-500">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Conduta</p>
                                        <p className="text-sm text-foreground leading-relaxed">{resultado?.conduta}</p>
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
