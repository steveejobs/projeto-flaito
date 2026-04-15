import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    FileText, Download, Printer, Eye, Sparkles, ChevronDown, ChevronUp,
    User, History, Signature, FileCheck, Loader2, LayoutPanelLeft, Share2
} from "lucide-react";
import { useInstitutionalConfig } from '@/hooks/useInstitutionalConfig';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { useDocumentEngine } from '@/hooks/useDocumentEngine';
import { DocumentPreviewFrame } from '@/components/documents/DocumentPreviewFrame';
import { DocumentTemplateSelector } from '@/components/documents/DocumentTemplateSelector';
import { DocumentTemplateId } from '@/types/institutional';
import { PartyBlock } from '@/lib/document-engine/sections/PartyBlock';
import { SignatureBlock } from '@/lib/document-engine/sections/SignatureBlock';
import { supabase } from '@/integrations/supabase/client';

interface ReportSection {
    id: string;
    title: string;
    content: string;
    visible: boolean;
}

const DEFAULT_SECTIONS: ReportSection[] = [
    { id: 'patient', title: 'Identificação do Paciente', content: '', visible: true },
    { id: 'history', title: 'Histórico Clínico Relevante', content: '', visible: true },
    { id: 'methodology', title: 'Metodologia', content: 'Análise iridológica bilateral (olhos direito e esquerdo) com auxílio de magnificação digital e sobreposição do mapa de Jensen.', visible: true },
    { id: 'right_eye', title: 'Achados — Olho Direito (OD)', content: '', visible: true },
    { id: 'left_eye', title: 'Achados — Olho Esquerdo (OE)', content: '', visible: true },
    { id: 'conclusion', title: 'Conclusão e Recomendações', content: '', visible: true },
];

const MedicalReportPage: React.FC = () => {
    const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
    const [reportTitle, setReportTitle] = useState('Laudo de Análise Iridológica');
    const [visualTemplateId, setVisualTemplateId] = useState<DocumentTemplateId>('modern_executive');
    const [patientName, setPatientName] = useState('');
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [generatingPatientSummary, setGeneratingPatientSummary] = useState(false);
    const [patientSummary, setPatientSummary] = useState('');
    const [signed, setSigned] = useState(false);
    
    // UI Local State
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
        Object.fromEntries(DEFAULT_SECTIONS.map(s => [s.id, true]))
    );
    const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'split'>('split');

    const { officeId } = useOfficeRole();
    const { data: instConfig } = useInstitutionalConfig(officeId || '');
    const { generateDocument, renderedHtml, isRenderLoading } = useDocumentEngine();

    const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    const updateSectionContent = (id: string, content: string) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s));
    };
    const toggleSectionVisibility = (id: string) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
    };

    // Debounced Preview Generation
    useEffect(() => {
        if (!instConfig?.resolvedContext) return;

        const timer = setTimeout(async () => {
            const context = {
                ...instConfig.resolvedContext,
                templateMetadata: {
                    ...instConfig.resolvedContext.templateMetadata!,
                    id: visualTemplateId
                }
            };

            const bodyContent = `
                <h1 style="text-align: center;">${reportTitle}</h1>
                <div style="text-align: center; margin-bottom: 30px; font-size: 10pt; color: #666;">
                    Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}
                </div>
                
                ${PartyBlock("Identificação", {
                    paciente: patientName || 'Não informado',
                    data: new Date().toLocaleDateString('pt-BR')
                })}

                ${sections.filter(s => s.visible && s.content).map(s => `
                    <div class="modern-section">
                        <h3 style="color: ${context.office.branding.colors.primary};">${s.title}</h3>
                        <p style="text-align: justify; line-height: 1.6;">${s.content.replace(/\n/g, '<br/>')}</p>
                    </div>
                `).join('')}
            `;

            const sigBlock = signed ? SignatureBlock(context.professional) : '';
            await generateDocument(context, bodyContent, { addSignatureBlock: sigBlock });
        }, 800);

        return () => clearTimeout(timer);
    }, [instConfig, reportTitle, patientName, sections, visualTemplateId, signed, generateDocument]);

    const handleExportPdf = useCallback(async () => {
        if (!renderedHtml) return;
        setGeneratingPdf(true);
        try {
            const { data, error } = await supabase.functions.invoke('lexos-html-to-pdf', {
                body: { html: renderedHtml }
            });
            if (error) throw new Error(error.message || 'Erro ao gerar PDF');
            const base64 = data?.pdf_base64;
            if (!base64) throw new Error('PDF não retornado pelo servidor');
            const byteCharacters = atob(base64);
            const byteArray = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteArray[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `laudo-${patientName || 'sem-nome'}-${Date.now()}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('PDF gerado com sucesso!');
        } catch (err: any) {
            toast.error(err.message || 'Erro ao exportar PDF');
        } finally {
            setGeneratingPdf(false);
        }
    }, [renderedHtml, patientName]);

    const handleSign = () => {
        setSigned(true);
        toast.success('Documento validado e assinado!');
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
            {/* Action Bar */}
            <header className="px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">
                        Construtor de Laudos
                    </h1>
                    <div className="h-6 w-px bg-border mx-2" />
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-auto">
                        <TabsList className="bg-muted/50 border h-9">
                            <TabsTrigger value="editor" className="text-xs px-3">Editor</TabsTrigger>
                            <TabsTrigger value="split" className="text-xs px-3 hidden lg:flex">Split</TabsTrigger>
                            <TabsTrigger value="preview" className="text-xs px-3">Preview</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => toast.info('Link de visualização copiado!')}>
                        <Share2 className="h-4 w-4 mr-2" /> Compartilhar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSign} disabled={signed} className={signed ? 'text-green-500' : ''}>
                        <Signature className="h-4 w-4 mr-2" /> {signed ? 'Assinado ✓' : 'Assinar'}
                    </Button>
                    <Button onClick={handleExportPdf} disabled={generatingPdf || !renderedHtml} className="bg-teal-600 hover:bg-teal-700 h-9">
                        {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                        Imprimir / PDF
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden flex divide-x">
                {/* 1. Sidebar Config */}
                {(viewMode === 'editor' || viewMode === 'split') && (
                    <aside className="w-80 overflow-y-auto p-4 space-y-6 bg-muted/20">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                    <User className="h-3 w-3" /> Paciente
                                </label>
                                <Input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Nome completo" className="h-9" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                    <LayoutPanelLeft className="h-3 w-3" /> Estresse Visual
                                </label>
                                <DocumentTemplateSelector 
                                    value={visualTemplateId} 
                                    onChange={setVisualTemplateId} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground">Estrutura do Documento</label>
                                <div className="space-y-1">
                                    {sections.map(s => (
                                        <div key={s.id} className="flex items-center justify-between p-2 rounded-md hover:bg-black/5 text-sm transition-colors">
                                            <span className={s.visible ? 'text-foreground font-medium' : 'text-muted-foreground line-through'}>{s.title}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSectionVisibility(s.id)}>
                                                <Eye className={s.visible ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 text-muted-foreground opacity-50'} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>
                )}

                {/* 2. Main Editor Content */}
                {(viewMode === 'editor' || viewMode === 'split') && (
                    <main className="flex-1 overflow-y-auto bg-background p-8">
                        <div className="max-w-3xl mx-auto space-y-8">
                            <Input
                                value={reportTitle}
                                onChange={e => setReportTitle(e.target.value)}
                                className="text-3xl font-bold border-none shadow-none p-0 focus-visible:ring-0 h-auto bg-transparent placeholder:opacity-50"
                                placeholder="Título do Laudo"
                            />

                            <div className="space-y-4">
                                {sections.filter(s => s.visible).map(section => (
                                    <div key={section.id} className="group space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-teal-600/80 uppercase tracking-tight">{section.title}</h3>
                                        </div>
                                        <Textarea
                                            value={section.content}
                                            onChange={e => updateSectionContent(section.id, e.target.value)}
                                            placeholder={`Escreva os achados de ${section.title}...`}
                                            className="min-h-[120px] resize-none border-none shadow-none bg-muted/30 focus-visible:bg-transparent transition-all p-4 rounded-xl leading-relaxed"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </main>
                )}

                {/* 3. Real-time Preview */}
                {(viewMode === 'preview' || viewMode === 'split') && (
                    <section className={cn(
                        "bg-muted/30 overflow-y-auto p-12 transition-all flex justify-center",
                        viewMode === 'split' ? "w-[45%]" : "flex-1"
                    )}>
                        <div className="w-full max-w-[800px]">
                            <DocumentPreviewFrame 
                                htmlContent={renderedHtml} 
                                loading={isRenderLoading} 
                                className="shadow-2xl border-0"
                            />
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default MedicalReportPage;
