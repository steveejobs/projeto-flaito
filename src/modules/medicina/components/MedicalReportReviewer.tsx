import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Clock, Eye, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MedicalReportReviewerProps {
    isOpen: boolean;
    onClose: () => void;
    reportId: string;
    patientId: string;
    content: any; // O JSON do laudo
    onFinalized?: (reportId: string) => void;
}

export function MedicalReportReviewer({
    isOpen,
    onClose,
    reportId,
    patientId,
    content,
    onFinalized
}: MedicalReportReviewerProps) {
    const [sectionsRead, setSectionsRead] = useState<Set<string>>(new Set());
    const [startTime] = useState<number>(Date.now());
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [reviewStatus, setReviewStatus] = useState<'reviewing' | 'completed'>('reviewing');
    
    // Lista de seções para rastreio
    const sections = [
        { id: 'summary', title: 'Resumo Clínico' },
        { id: 'vitality', title: 'Índice de Vitalidade' },
        { id: 'alerts', title: 'Alertas Críticos' },
        { id: 'findings', title: 'Achados Iridológicos' },
        { id: 'systems', title: 'Análise por Sistemas' },
        { id: 'questions', title: 'Sugestões de Anamnese' },
        { id: 'references', title: 'Referências Bibliográficas' }
    ];

    const observerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    useEffect(() => {
        if (!isOpen) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.getAttribute('data-section-id');
                    if (sectionId) {
                        setSectionsRead(prev => {
                            const newSet = new Set(prev);
                            newSet.add(sectionId);
                            return newSet;
                        });
                    }
                }
            });
        }, { threshold: 0.5 });

        Object.values(observerRefs.current).forEach(ref => {
            if (ref) observer.observe(ref);
        });

        return () => observer.disconnect();
    }, [isOpen]);

    const allRead = sectionsRead.size >= sections.length;

    const handleFinalize = async () => {
        if (!allRead) {
            toast.error("Para oficializar, você deve revisar todas as seções do laudo.");
            return;
        }

        setIsFinalizing(true);
        const reviewTime = Math.floor((Date.now() - startTime) / 1000);

        try {
            const { data, error } = await supabase.functions.invoke('medical-finalize-report', {
                body: {
                    reportId,
                    patientId,
                    reviewData: {
                        review_time_seconds: reviewTime,
                        sections_viewed: Array.from(sectionsRead),
                        total_sections: sections.length
                    }
                }
            });

            if (error) throw error;

            toast.success("Laudo oficializado e assinado com sucesso!");
            if (onFinalized) onFinalized(reportId);
            onClose();
        } catch (err: any) {
            console.error("Erro ao oficializar laudo:", err);
            toast.error("Falha ao oficializar laudo: " + (err.message || "Erro desconhecido"));
        } finally {
            setIsFinalizing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <DialogHeader className="p-6 pb-2 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                                <ShieldCheck className="h-6 w-6 text-emerald-500" />
                                Revisão Ativa de Laudo IA
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                Verifique as informações geradas pela IA. Documentos assinados possuem valor clínico e legal oficial.
                            </DialogDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Badge variant={allRead ? "default" : "secondary"} className={allRead ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                                {allRead ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                                {sectionsRead.size}/{sections.length} Leituras
                            </Badge>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-mono tracking-widest">
                                <Clock className="h-3 w-3" />
                                Tempo de Revisão: {Math.floor((Date.now() - startTime) / 1000)}s
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6 space-y-8">
                    {/* Resumo Clínico */}
                    <div 
                        ref={el => observerRefs.current['summary'] = el} 
                        data-section-id="summary"
                        className={`p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border transition-all duration-500 ${sectionsRead.has('summary') ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-800'}`}
                    >
                        <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <FileText className="h-5 w-5 text-indigo-500" />
                            Resumo Clínico da Análise
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            {content?.summary || "Não disponível"}
                        </p>
                    </div>

                    {/* Vitalidade */}
                    <div 
                        ref={el => observerRefs.current['vitality'] = el} 
                        data-section-id="vitality"
                        className={`p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border transition-all duration-500 ${sectionsRead.has('vitality') ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-800'}`}
                    >
                        <h3 className="text-lg font-bold mb-3 text-slate-800 dark:text-slate-100">Índice de Vitalidade</h3>
                        <div className="flex items-center gap-4">
                            <div className="text-4xl font-black text-emerald-500">{content?.vitalityIndex || 0}%</div>
                            <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${content?.vitalityIndex || 0}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Alertas */}
                    <div 
                        ref={el => observerRefs.current['alerts'] = el} 
                        data-section-id="alerts"
                        className={`p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border transition-all duration-500 ${sectionsRead.has('alerts') ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-800'}`}
                    >
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <AlertCircle className="h-5 w-5 text-rose-500" />
                            Alertas de Atenção
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {content?.criticalAlerts?.map((alert: any, i: number) => (
                                <div key={i} className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50">
                                    <span className="font-bold text-rose-700 dark:text-rose-400 block text-sm">{alert.title}</span>
                                    <span className="text-xs text-rose-600 dark:text-rose-300">{alert.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Achados */}
                    <div 
                        ref={el => observerRefs.current['findings'] = el} 
                        data-section-id="findings"
                        className={`p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border transition-all duration-500 ${sectionsRead.has('findings') ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-800'}`}
                    >
                        <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100">Achados Topográficos</h3>
                        <div className="space-y-4">
                            {content?.findings?.map((f: any, i: number) => (
                                <div key={i} className="flex gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                    <Badge variant="outline" className="h-fit py-1">{f.eye === 'right' ? 'OD' : 'OE'}</Badge>
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{f.name} - Zona {f.zone}</p>
                                        <p className="text-xs text-slate-500 mt-1">{f.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sistemas */}
                    <div 
                        ref={el => observerRefs.current['systems'] = el} 
                        data-section-id="systems"
                        className={`p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border transition-all duration-500 ${sectionsRead.has('systems') ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-800'}`}
                    >
                        <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100">Avaliação Sistêmica</h3>
                        <div className="space-y-3">
                            {content?.systems?.map((s: any, i: number) => (
                                <div key={i} className="flex justify-between items-center p-2 border-b dark:border-slate-800">
                                    <span className="text-sm font-medium">{s.name}</span>
                                    <Badge variant={s.status === 'good' ? 'outline' : 'destructive'} className="text-[10px] uppercase">
                                        {s.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Perguntas Anamnese */}
                    <div 
                        ref={el => observerRefs.current['questions'] = el} 
                        data-section-id="questions"
                        className={`p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border transition-all duration-500 ${sectionsRead.has('questions') ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-800'}`}
                    >
                        <h3 className="text-lg font-bold mb-3 text-slate-800 dark:text-slate-100">Sugestões de Anamnese</h3>
                        <ul className="space-y-2">
                            {content?.anamnesisQuestions?.map((q: string, i: number) => (
                                <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex gap-2">
                                    <span className="text-indigo-400 font-bold">Q{i+1}:</span> {q}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Referências */}
                    <div 
                        ref={el => observerRefs.current['references'] = el} 
                        data-section-id="references"
                        className={`p-6 mb-10 bg-white dark:bg-slate-900 rounded-xl shadow-sm border transition-all duration-500 ${sectionsRead.has('references') ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-800'}`}
                    >
                        <h3 className="text-sm font-bold mb-2 text-slate-400 uppercase tracking-widest">Referências Bibliográficas</h3>
                        <div className="text-xs text-slate-400 italic">
                            {content?.references?.join(', ') || "IA Engine Proprietary Dataset"}
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800 shrink-0 flex items-center justify-between sm:justify-between">
                    <div className="flex items-center gap-4">
                        {!allRead && (
                            <p className="text-xs text-amber-600 font-medium flex items-center gap-1 animate-pulse">
                                <AlertCircle className="h-3 w-3" />
                                Role o laudo até o final para habilitar a assinatura.
                            </p>
                        )}
                        {allRead && (
                            <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Revisão Ativa Concluída. Pronto para assinar.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={onClose} disabled={isFinalizing}>
                            Cancelar e Manter Rascunho
                        </Button>
                        <Button 
                            disabled={!allRead || isFinalizing}
                            onClick={handleFinalize}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 px-8"
                        >
                            {isFinalizing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Processando Assinatura...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    Assinar e Oficializar
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
