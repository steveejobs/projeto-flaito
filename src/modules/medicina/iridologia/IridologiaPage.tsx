import React, { useState, useCallback, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    Eye, Camera, Upload, Brain, Sparkles, Loader2,
    ZoomIn, PenTool, Layers, ArrowLeftRight, Clock,
    AlertTriangle, FileText, Shield, ChevronDown, ChevronUp,
    BookOpen, HelpCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { clientService } from "@/services/domain/clientService";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import IrisCameraCapture from "./components/IrisCameraCapture";
import IrisImageAdjust from "./components/IrisImageAdjust";
import IrisZoomViewer from "./components/IrisZoomViewer";
import IrisAnnotationCanvas from "./components/IrisAnnotationCanvas";
import IridologyMapOverlay from "./components/IridologyMapOverlay";
import IrisComparisonDE from "./components/IrisComparisonDE";
import IrisEvolutionSlider from "./components/IrisEvolutionSlider";
import ImageQualityFeedback from "./components/ImageQualityFeedback";
import { MedicalReportReviewer } from "../components/MedicalReportReviewer";

type ViewTab = 'capture' | 'analyze' | 'compare' | 'tools' | 'history';

const IridologiaPage: React.FC = () => {
    const { user } = useAuth();
    const { officeId } = useOfficeRole();
    const [patients, setPatients] = useState<any[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<ViewTab>('capture');
    const [showCamera, setShowCamera] = useState(false);
    const [rightEyeImage, setRightEyeImage] = useState<string | null>(null);
    const [leftEyeImage, setLeftEyeImage] = useState<string | null>(null);
    const [activeEye, setActiveEye] = useState<'right' | 'left'>('right');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [clinicalNotes, setClinicalNotes] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);
    const [anamnesisQuestions, setAnamnesisQuestions] = useState<string[]>([]);
    const [signedRightUrl, setSignedRightUrl] = useState<string | null>(null);
    const [signedLeftUrl, setSignedLeftUrl] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        findings: true, alerts: true, questions: true, references: true
    });
    
    // V5 Review States
    const [isReviewerOpen, setIsReviewerOpen] = useState(false);
    const [currentReportId, setCurrentReportId] = useState<string | null>(null);

    const getSignedUrl = async (path: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('client-files')
                .createSignedUrl(path, 3600); // 1 hour
            if (error) throw error;
            return data.signedUrl;
        } catch (err) {
            console.error("Error getting signed URL:", err);
            return null;
        }
    };

    const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

    useEffect(() => {
        if (rightEyeImage && rightEyeImage.startsWith('iridology/')) {
            getSignedUrl(rightEyeImage).then(setSignedRightUrl);
        } else {
            setSignedRightUrl(rightEyeImage);
        }
    }, [rightEyeImage]);

    useEffect(() => {
        if (leftEyeImage && leftEyeImage.startsWith('iridology/')) {
            getSignedUrl(leftEyeImage).then(setSignedLeftUrl);
        } else {
            setSignedLeftUrl(leftEyeImage);
        }
    }, [leftEyeImage]);

    useEffect(() => {
        if (!officeId) return;
        const fetchPatients = async () => {
            const data = await clientService.listMedicalPatients(officeId);
            if (data) setPatients(data);
        };
        fetchPatients();
    }, [officeId]);

    const handleSaveAnalysis = async () => {
        if (!selectedPatientId) {
            toast.error("Por favor, selecione um paciente no topo da tela para salvar a análise.");
            return;
        }
        if (!analysisResult) {
            toast.error("Nenhuma análise para salvar.");
            return;
        }

        setSaving(true);
        try {
            let rightUrl = null;
            let leftUrl = null;

            const uploadImage = async (base64Data: string, eye: string) => {
                if (base64Data.startsWith('iridology/')) return base64Data; // Already a path

                const response = await fetch(base64Data);
                const blob = await response.blob();
                const fileName = `${selectedPatientId}/${Date.now()}_${eye}.jpg`;
                const fullPath = `iridology/${fileName}`;
                
                const { data, error } = await supabase.storage
                    .from('client-files')
                    .upload(fullPath, blob);

                if (error) throw error;
                // SECURITY: Storing path only, not public URL
                return data.path; 
            };

            if (rightEyeImage) rightUrl = await uploadImage(rightEyeImage, 'right');
            if (leftEyeImage) leftUrl = await uploadImage(leftEyeImage, 'left');

            let rightImageId = null;
            let leftImageId = null;

            if (rightUrl) {
                const { data: imgOD, error: errImgOD } = await supabase.from('iris_images').insert({
                    office_id: officeId,
                    patient_id: selectedPatientId,
                    eye: 'right',
                    image_url: rightUrl,
                    created_by: user?.id
                }).select().single();
                if (errImgOD) throw errImgOD;
                rightImageId = (imgOD as any).id;
            }

            if (leftUrl) {
                const { data: imgOE, error: errImgOE } = await supabase.from('iris_images').insert({
                    office_id: officeId,
                    patient_id: selectedPatientId,
                    eye: 'left',
                    image_url: leftUrl,
                    created_by: user?.id
                }).select().single();
                if (errImgOE) throw errImgOE;
                leftImageId = (imgOE as any).id;
            }

            // Converter para objeto limpo se for array, previne erros de tipagem no JSONB
            const cleanAiResponse = typeof analysisResult === 'object' && analysisResult !== null ? analysisResult : { raw: analysisResult };

            let avaliacao = null;
            let errAv = null;

            if (analysisResult._backend_analysis_id) {
                // Atualiza a análise já pré-salva no backend pelas edge-functions
                const { data: updatedData, error: updatedErr } = await supabase.from('iris_analyses').update({
                    right_image_id: rightImageId,
                    left_image_id: leftImageId,
                    clinical_data: clinicalNotes
                }).eq('id', analysisResult._backend_analysis_id).select().single() as any;
                
                avaliacao = updatedData;
                errAv = updatedErr;
            } else {
                // Fallback legado caso não tenha o backend_id
                const { data: insertedData, error: insertedErr } = await supabase.from('iris_analyses').insert({
                    office_id: officeId,
                    patient_id: selectedPatientId,
                    right_image_id: rightImageId,
                    left_image_id: leftImageId,
                    analysis_type: 'complete',
                    status: 'completed',
                    clinical_data: clinicalNotes,
                    ai_response: cleanAiResponse,
                    findings: analysisResult.findings || [],
                    critical_alerts: analysisResult.criticalAlerts || [],
                    anamnesis_questions: analysisResult.anamnesisQuestions || [],
                    created_by: user?.id
                }).select().single();

                avaliacao = insertedData;
                errAv = insertedErr;
            }

            if (errAv) throw errAv;

            const { data: reportData, error: errLd } = await supabase.from('medical_reports').insert({
                office_id: officeId,
                patient_id: selectedPatientId,
                analysis_id: avaliacao.id,
                report_type: 'full',
                title: 'Laudo Iridológico Assistido por IA',
                content: cleanAiResponse,
                status: 'ai_draft', // V5: Inicia como rascunho
                created_by: user?.id
            }).select().single();

            if (errLd) throw errLd;
            
            setCurrentReportId((reportData as any).id);
            toast.success("Análise salva como rascunho. Iniciando revisão médica...");
            setIsReviewerOpen(true);
        } catch (error: any) {
            console.error("Error saving analysis:", error);
            toast.error("Erro ao salvar a análise: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCapture = (imageData: string) => {
        if (activeEye === 'right') {
            setRightEyeImage(imageData);
        } else {
            setLeftEyeImage(imageData);
        }
        setSelectedImage(imageData);
        setShowCamera(false);
        toast.success(`Imagem do olho ${activeEye === 'right' ? 'direito' : 'esquerdo'} capturada!`);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, eye: 'right' | 'left') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const data = ev.target?.result as string;
            if (eye === 'right') setRightEyeImage(data);
            else setLeftEyeImage(data);
            setSelectedImage(data);
            toast.success(`Imagem do olho ${eye === 'right' ? 'direito' : 'esquerdo'} carregada!`);
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyze = async () => {
        if (!rightEyeImage && !leftEyeImage) {
            toast.error('Carregue pelo menos uma imagem para análise.');
            return;
        }

        setAnalyzing(true);
        setAnalysisResult(null);

        try {
            const { data, error } = await supabase.functions.invoke('medical-iris-analysis', {
                body: {
                    officeId,
                    pacienteId: selectedPatientId,
                    rightEyeImage,
                    leftEyeImage,
                    clinicalNotes,
                    analysisType: 'complete',
                    patientHistory: ''
                },
            });

            if (error) {
                // Extract error message from edge function response if available, otherwise generic
                console.error('Edge Function Error:', error);
                throw new Error(error.message || 'Falha de comunicação ou limite de cota excedido.');
            }

            if (data?.error) {
                toast.error(data.error);
                return;
            }

            if (data && data.summary) {
                setAnalysisResult(data);
                setCriticalAlerts(data.criticalAlerts || []);
                setAnamnesisQuestions(data.anamnesisQuestions || []);
                toast.success('Análise Ocular IA concluída com sucesso!');
                setActiveTab('analyze');
            } else {
                 throw new Error('A IA não retornou um laudo bem-formado.');
            }
        } catch (err: any) {
            console.error('Analysis error:', err);
            const errorMsg = err?.message || 'Erro ao executar a análise iridológica na IA.';
            toast.error(errorMsg);
        } finally {
            setAnalyzing(false);
        }
    };

    const severityColor = (s: string) => {
        const colors: Record<string, string> = {
            low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            moderate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            high: 'bg-red-500/20 text-red-400 border-red-500/30',
            critical: 'bg-red-600/20 text-red-300 border-red-600/30',
        };
        return colors[s] || colors.moderate;
    };

    const systemStatusColor = (s: string) => {
        const colors: Record<string, string> = {
            ok: 'text-emerald-400',
            monitoring: 'text-amber-400',
            attention: 'text-red-400',
        };
        return colors[s] || 'text-gray-400';
    };

    const currentImage = selectedImage || rightEyeImage || leftEyeImage;

    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col md:flex-row gap-4 md:items-start justify-between">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Análise Iridológica
                    </h1>
                    <p className="text-muted-foreground">
                        Captura, análise de imagem e mapeamento iridológico com suporte de IA.
                    </p>
                </div>
                <div className="w-full md:w-[300px]">
                    <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                        <SelectTrigger className="w-full bg-white/5 border-white/10">
                            <SelectValue placeholder="Selecione o paciente..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10">
                            {patients.map(p => (
                                <SelectItem key={p.paciente_id || p.id} value={p.paciente_id || p.id} className="focus:bg-white/10">{p.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </header>

            {/* P0 SECURITY DISCLAIMER - Mandatory & Unavoidable */}
            <Card className="p-5 border-rose-500/30 bg-rose-500/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Shield className="h-24 w-24 text-rose-500" />
                </div>
                <div className="flex gap-4 relative z-10">
                    <div className="h-10 w-10 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-6 w-6 text-rose-500 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-rose-500 uppercase tracking-widest mb-1">
                            Aviso de Segurança e Conformidade Médica (P0)
                        </h3>
                        <p className="text-sm text-foreground font-medium max-w-4xl leading-relaxed">
                            Esta ferramenta baseia-se em processamento de imagem por IA para identificação de padrões iridológicos.
                            Os resultados gerados são estritamente **REFERENCIAIS** e não constituem diagnóstico clínico, indicação terapêutica ou prescrição médica.
                        </p>
                        <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> LGPD Secure Storage</span>
                            <span className="flex items-center gap-1"><Brain className="h-3 w-3" /> IA de Suporte à Decisão</span>
                            <span className="flex items-center gap-1"><PenTool className="h-3 w-3" /> Requer Validação Humana</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Camera modal */}
            {showCamera && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="w-full max-w-xl">
                        <IrisCameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} />
                    </div>
                </div>
            )}

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewTab)}>
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="capture" className="gap-1.5"><Camera className="h-4 w-4" /> Captura</TabsTrigger>
                    <TabsTrigger value="analyze" className="gap-1.5"><Brain className="h-4 w-4" /> Análise IA</TabsTrigger>
                    <TabsTrigger value="compare" className="gap-1.5"><ArrowLeftRight className="h-4 w-4" /> Comparação</TabsTrigger>
                    <TabsTrigger value="tools" className="gap-1.5"><PenTool className="h-4 w-4" /> Ferramentas</TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5"><Clock className="h-4 w-4" /> Evolução</TabsTrigger>
                </TabsList>

                {/* ======== CAPTURA ======== */}
                <TabsContent value="capture" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Right Eye */}
                        <Card className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="border-emerald-400 text-emerald-400"><Eye className="h-3 w-3 mr-1" /> OD</Badge>
                                    <span className="text-sm font-medium">Olho Direito</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => { setActiveEye('right'); setShowCamera(true); }} className="gap-1 text-xs">
                                        <Camera className="h-3 w-3" /> Câmera
                                    </Button>
                                    <label>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'right')} />
                                        <Button size="sm" variant="outline" className="gap-1 text-xs" asChild><span><Upload className="h-3 w-3" /> Upload</span></Button>
                                    </label>
                                </div>
                            </div>
                            {rightEyeImage ? (
                                <div className="space-y-3">
                                    <div className="rounded-xl overflow-hidden bg-black aspect-square">
                                        <img src={signedRightUrl || undefined} alt="OD" className="w-full h-full object-cover" />
                                    </div>
                                    <ImageQualityFeedback imageData={signedRightUrl || ''} />
                                </div>
                            ) : (
                                <div className="rounded-xl border-2 border-dashed border-white/10 aspect-square flex items-center justify-center">
                                    <div className="text-center text-muted-foreground">
                                        <Eye className="h-12 w-12 mx-auto opacity-20 mb-3" />
                                        <p className="text-sm">Nenhuma imagem capturada</p>
                                        <p className="text-xs mt-1">Use a câmera ou faça upload</p>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Left Eye */}
                        <Card className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="border-blue-400 text-blue-400"><Eye className="h-3 w-3 mr-1" /> OE</Badge>
                                    <span className="text-sm font-medium">Olho Esquerdo</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => { setActiveEye('left'); setShowCamera(true); }} className="gap-1 text-xs">
                                        <Camera className="h-3 w-3" /> Câmera
                                    </Button>
                                    <label>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'left')} />
                                        <Button size="sm" variant="outline" className="gap-1 text-xs" asChild><span><Upload className="h-3 w-3" /> Upload</span></Button>
                                    </label>
                                </div>
                            </div>
                            {leftEyeImage ? (
                                <div className="space-y-3">
                                    <div className="rounded-xl overflow-hidden bg-black aspect-square">
                                        <img src={signedLeftUrl || undefined} alt="OE" className="w-full h-full object-cover" />
                                    </div>
                                    <ImageQualityFeedback imageData={signedLeftUrl || ''} />
                                </div>
                            ) : (
                                <div className="rounded-xl border-2 border-dashed border-white/10 aspect-square flex items-center justify-center">
                                    <div className="text-center text-muted-foreground">
                                        <Eye className="h-12 w-12 mx-auto opacity-20 mb-3" />
                                        <p className="text-sm">Nenhuma imagem capturada</p>
                                        <p className="text-xs mt-1">Use a câmera ou faça upload</p>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Clinical notes + Analyze */}
                    <Card className="p-5 space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4 text-teal-400" /> Dados Clínicos (opcional)
                        </h3>
                        <Textarea
                            value={clinicalNotes}
                            onChange={(e) => setClinicalNotes(e.target.value)}
                            placeholder="Queixa principal, histórico relevante, medicamentos em uso, achados de exames..."
                            className="min-h-[100px]"
                        />
                        <Button
                            onClick={handleAnalyze}
                            disabled={analyzing || (!rightEyeImage && !leftEyeImage)}
                            className="w-full gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white h-12 text-base"
                        >
                            {analyzing ? <><Loader2 className="h-5 w-5 animate-spin" /> Analisando...</> : <><Sparkles className="h-5 w-5" /> Analisar com IA</>}
                        </Button>
                    </Card>
                </TabsContent>

                {/* ======== ANÁLISE IA ======== */}
                <TabsContent value="analyze" className="space-y-6 mt-6">
                    {!analysisResult ? (
                        <Card className="p-16 text-center">
                            <Brain className="h-20 w-20 mx-auto text-muted-foreground/15 mb-4" />
                            <p className="text-lg font-medium text-muted-foreground">Nenhuma análise realizada</p>
                            <p className="text-sm text-muted-foreground/70 mt-2">Capture as imagens da íris e clique em "Analisar com IA".</p>
                        </Card>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Vitality Index */}
                            {analysisResult.vitalityIndex && (
                                <Card className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                                            <Sparkles className="h-4 w-4" /> Índice de Vitalidade Iridológica
                                        </h3>
                                        <span className="text-3xl font-bold text-teal-400">{analysisResult.vitalityIndex}<span className="text-sm text-muted-foreground">/100</span></span>
                                    </div>
                                    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${analysisResult.vitalityIndex}%` }} />
                                    </div>
                                </Card>
                            )}

                            {/* Summary */}
                            <Card className="p-5">
                                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Brain className="h-4 w-4" /> Resumo da Análise
                                </h3>
                                <p className="text-sm text-foreground leading-relaxed">{analysisResult.summary}</p>
                            </Card>

                            {/* Critical Alerts */}
                            {criticalAlerts.length > 0 && (
                                <Card className="p-5 border-red-500/20">
                                    <button onClick={() => toggleSection('alerts')} className="w-full flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4" /> ⚠️ Alertas de Padrões Críticos ({criticalAlerts.length})
                                        </h3>
                                        {expandedSections.alerts ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    {expandedSections.alerts && (
                                        <div className="mt-3 space-y-3">
                                            {criticalAlerts.map((alert, i) => (
                                                <div key={i} className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className={severityColor(alert.severity)}>{alert.severity}</Badge>
                                                        <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            )}

                            {/* Findings */}
                            <Card className="p-5">
                                <button onClick={() => toggleSection('findings')} className="w-full flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                                        <Eye className="h-4 w-4" /> Achados por Zona ({analysisResult.findings?.length || 0})
                                    </h3>
                                    {expandedSections.findings ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </button>
                                {expandedSections.findings && analysisResult.findings && (
                                    <div className="mt-3 space-y-3">
                                        {analysisResult.findings.map((f: any, i: number) => (
                                            <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className={severityColor(f.severity)}>{f.type}</Badge>
                                                    <span className="text-sm font-semibold text-foreground">Zona {f.zone}: {f.name}</span>
                                                    <Badge variant="outline" className="text-xs">{f.eye === 'right' ? 'OD' : 'OE'}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{f.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>

                            {/* Systems */}
                            {analysisResult.systems && (
                                <Card className="p-5">
                                    <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Layers className="h-4 w-4" /> Sugestão Diagnóstica por Sistema
                                    </h3>
                                    <div className="space-y-3">
                                        {analysisResult.systems.map((s: any, i: number) => (
                                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                                <div className={`mt-0.5 ${systemStatusColor(s.status)}`}>●</div>
                                                <div>
                                                    <span className="text-sm font-semibold text-foreground">{s.name}</span>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{s.details}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {/* Anamnesis Questions */}
                            {anamnesisQuestions.length > 0 && (
                                <Card className="p-5">
                                    <button onClick={() => toggleSection('questions')} className="w-full flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                                            <HelpCircle className="h-4 w-4" /> Perguntas Anamnéticas Sugeridas ({anamnesisQuestions.length})
                                        </h3>
                                        {expandedSections.questions ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    {expandedSections.questions && (
                                        <div className="mt-3 space-y-2">
                                            {anamnesisQuestions.map((q, i) => (
                                                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/5">
                                                    <span className="text-xs text-purple-400 font-mono mt-0.5">{i + 1}.</span>
                                                    <p className="text-sm text-foreground">{q}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            )}

                            {/* References */}
                            {analysisResult.references && (
                                <Card className="p-5">
                                    <button onClick={() => toggleSection('references')} className="w-full flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <BookOpen className="h-4 w-4" /> Referências
                                        </h3>
                                        {expandedSections.references ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    {expandedSections.references && (
                                        <div className="mt-3 space-y-1">
                                            {analysisResult.references.map((r: string, i: number) => (
                                                <p key={i} className="text-xs text-muted-foreground italic">{r}</p>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button className="flex-1 gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                                    <FileText className="h-4 w-4" /> Gerar Laudo
                                </Button>
                                <Button variant="outline" className="gap-2">Exportar PDF</Button>
                                <Button onClick={handleSaveAnalysis} disabled={saving} variant="outline" className="gap-2">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> Salvar Análise</>}
                                </Button>
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* ======== COMPARAÇÃO D/E ======== */}
                <TabsContent value="compare" className="space-y-6 mt-6">
                    <IrisComparisonDE leftImageUrl={leftEyeImage || undefined} rightImageUrl={rightEyeImage || undefined} />

                    {/* Map overlay */}
                    {currentImage && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {rightEyeImage && (
                                <IridologyMapOverlay imageUrl={rightEyeImage} eye="right" onZoneClick={(z) => toast.info(`Zona ${z.number}: ${z.name} (${z.system})`)} />
                            )}
                            {leftEyeImage && (
                                <IridologyMapOverlay imageUrl={leftEyeImage} eye="left" onZoneClick={(z) => toast.info(`Zona ${z.number}: ${z.name} (${z.system})`)} />
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* ======== FERRAMENTAS ======== */}
                <TabsContent value="tools" className="space-y-6 mt-6">
                    {currentImage ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Zoom */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <ZoomIn className="h-4 w-4 text-teal-400" /> Zoom de Alta Resolução
                                </h3>
                                <IrisZoomViewer imageUrl={currentImage} />
                            </div>

                            {/* Image adjustments */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-teal-400" /> Ajustes de Imagem
                                </h3>
                                <IrisImageAdjust imageUrl={currentImage} />
                            </div>

                            {/* Annotations */}
                            <div className="lg:col-span-2 space-y-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <PenTool className="h-4 w-4 text-teal-400" /> Marcação Manual
                                </h3>
                                <IrisAnnotationCanvas imageUrl={currentImage} />
                            </div>
                        </div>
                    ) : (
                        <Card className="p-16 text-center">
                            <PenTool className="h-16 w-16 mx-auto text-muted-foreground/15 mb-4" />
                            <p className="text-muted-foreground">Capture uma imagem primeiro para usar as ferramentas.</p>
                        </Card>
                    )}
                </TabsContent>

                {/* ======== EVOLUÇÃO ======== */}
                <TabsContent value="history" className="space-y-6 mt-6">
                    {rightEyeImage && leftEyeImage ? (
                        <IrisEvolutionSlider
                            beforeImage={rightEyeImage}
                            afterImage={leftEyeImage}
                            beforeDate="Sessão anterior"
                            afterDate="Sessão atual"
                            zoneName="Todas as zonas"
                        />
                    ) : (
                        <Card className="p-16 text-center">
                            <Clock className="h-16 w-16 mx-auto text-muted-foreground/15 mb-4" />
                            <p className="text-muted-foreground">Carregue duas imagens ou selecione sessões anteriores para comparar evolução.</p>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* V5: Medical Report Reviewer Modal */}
            {isReviewerOpen && currentReportId && (
                <MedicalReportReviewer
                    isOpen={isReviewerOpen}
                    onClose={() => setIsReviewerOpen(false)}
                    reportId={currentReportId}
                    patientId={selectedPatientId}
                    content={analysisResult}
                    onFinalized={() => {
                        toast.success("Documento oficializado!");
                        setActiveTab('history');
                    }}
                />
            )}
        </div>
    );
};

export default IridologiaPage;
