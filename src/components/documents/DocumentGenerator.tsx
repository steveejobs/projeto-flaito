import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { documentService, DocumentVariable, TemplateVersion } from "@/services/documentService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  FileText, 
  Sparkles, 
  Loader2, 
  Check, 
  ArrowRight, 
  Wand2, 
  Download, 
  FileDown,
  ChevronLeft
} from 'lucide-react';
import html2pdf from 'html2pdf.js';

interface DocumentGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  caseId?: string;
  vertical: 'LEGAL' | 'MEDICAL';
  onComplete?: (docId: string) => void;
}

export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ 
  open, 
  onOpenChange, 
  clientId, 
  caseId, 
  vertical,
  onComplete 
}) => {
  const [step, setStep] = useState<'select' | 'resolve' | 'preview'>('select');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [requiredVars, setRequiredVars] = useState<DocumentVariable[]>([]);
  const [renderedHtml, setRenderedHtml] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  
  const officeId = sessionStorage.getItem('lexos_office_id');

  useEffect(() => {
    if (open && officeId) {
      fetchTemplates();
      setStep('select');
    }
  }, [open, officeId]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .or(`office_id.is.null,office_id.eq.${officeId}`)
        .eq('vertical', vertical)
        .eq('is_active', true);
      
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      toast.error("Erro ao carregar modelos.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template: any) => {
    setSelectedTemplate(template);
    setLoading(true);
    try {
      const catalog = await documentService.getVariableCatalog(officeId, vertical);
      const resolved = await documentService.resolveSystemVariables(officeId!, clientId, caseId);
      
      // Discovery: find what variables the template content uses
      const matches = template.content.match(/\{\{([a-zA-Z0-9._]+)\}\}/g) || [];
      const keysUsed = Array.from(new Set(matches.map((m: string) => m.replace(/\{\{|\}\}/g, ''))));
      
      const missingVars = keysUsed
        .map(key => catalog.find(v => v.key === key) || { key, label: key, type: 'text', source_type: 'manual', required: true })
        .filter(v => !resolved[v.key]);

      setVariables(resolved);
      setRequiredVars(missingVars as DocumentVariable[]);
      
      if (missingVars.length === 0) {
        await generatePreview(template.content, resolved);
        setStep('preview');
      } else {
        setStep('resolve');
      }
    } catch (err) {
      toast.error("Erro ao processar variáveis.");
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = async (content: string, data: Record<string, string>) => {
    try {
      const html = await documentService.renderTemplate(content, data);
      setRenderedHtml(html);
    } catch (err) {
      toast.error("Erro ao gerar prévia.");
    }
  };

  const handleFinishResolve = async () => {
    setLoading(true);
    await generatePreview(selectedTemplate.content, variables);
    setStep('preview');
    setLoading(false);
  };

  const handleExportPDF = () => {
    if (!previewRef.current) return;
    
    const element = previewRef.current;
    const opt = {
      margin: [10, 10],
      filename: `${selectedTemplate.name}_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
    toast.success("Exportação iniciada.");
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase.from('generated_docs').insert({
        office_id: officeId,
        client_id: clientId,
        case_id: caseId,
        template_version_id: selectedTemplate.active_version_id,
        title: selectedTemplate.name,
        content_html: renderedHtml,
        used_variables: variables,
        generation_mode: 'ai_assisted',
        user_id: user.user?.id
      }).select().single();

      if (error) throw error;
      
      toast.success("Documento registrado na auditoria.");
      onOpenChange(false);
      if (onComplete) onComplete(data.id);
    } catch (err) {
      toast.error("Erro ao salvar documento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-none shadow-2xl">
        <DialogHeader className="p-6 bg-white border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Wand2 className="h-5 w-5" />
              </div>
              <div>
                  <DialogTitle className="text-xl font-black tracking-tight tracking-tight">Gerador de Peças Institucionais</DialogTitle>
                  <DialogDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1 flex items-center gap-2">
                    {step === 'select' && "1. Seleção de Modelo"}
                    {step === 'resolve' && "2. Resolução de Dados"}
                    {step === 'preview' && "3. Validação e Exportação"}
                  </DialogDescription>
              </div>
            </div>
            {step !== 'select' && (
              <Button variant="ghost" size="sm" onClick={() => setStep('select')} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {step === 'select' && (
            <ScrollArea className="flex-1 p-6">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(t => (
                    <Card key={t.id} className="cursor-pointer hover:border-primary/40 transition-all group hover:shadow-md" onClick={() => handleSelectTemplate(t)}>
                       <CardContent className="p-5 flex flex-col gap-4">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-muted rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <FileText className="h-6 w-6" />
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="font-bold text-sm truncate">{t.name}</h4>
                              <p className="text-[10px] uppercase font-black text-muted-foreground mt-1">{t.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-4 border-t border-muted/50">
                             <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter">{t.vertical}</Badge>
                             <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary" />
                          </div>
                       </CardContent>
                    </Card>
                  ))}
               </div>
            </ScrollArea>
          )}

          {step === 'resolve' && (
            <ScrollArea className="flex-1 p-8 bg-white">
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                  <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                    <Database className="h-5 w-5" /> Dados Necessários
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Algumas informações precisam ser preenchidas manualmente para este modelo.</p>
                </div>
                
                <div className="grid grid-cols-1 gap-6 pb-20">
                  {requiredVars.map(v => (
                    <div key={v.key} className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                        {v.label || v.key}
                        {v.required && <span className="text-destructive">*</span>}
                      </Label>
                      {v.type === 'long_text' ? (
                        <Textarea 
                          value={variables[v.key] || ''} 
                          onChange={e => setVariables({...variables, [v.key]: e.target.value})} 
                          className="rounded-xl bg-muted/20 focus:bg-background transition-all"
                          placeholder={v.help_text}
                        />
                      ) : (
                        <Input 
                          value={variables[v.key] || ''} 
                          onChange={e => setVariables({...variables, [v.key]: e.target.value})} 
                          className="rounded-xl h-12 bg-muted/20 focus:bg-background transition-all" 
                          placeholder={v.help_text} 
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}

          {step === 'preview' && (
            <div className="flex-1 overflow-auto p-12 bg-slate-100 custom-scrollbar">
               <div 
                  ref={previewRef}
                  className="bg-white shadow-2xl mx-auto min-h-[1120px] w-full max-w-[800px] p-[2.5cm] border border-slate-200 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }} 
               />
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-white border-t gap-3 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === 'resolve' && (
            <Button className="rounded-full px-8 shadow-lg shadow-primary/20 font-bold" onClick={handleFinishResolve} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <><Sparkles className="mr-2 h-4 w-4" /> Gerar Peça</>}
            </Button>
          )}
          {step === 'preview' && (
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full gap-2" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4" /> Exportar PDF
              </Button>
              <Button className="rounded-full px-8 shadow-lg shadow-primary/20 font-bold" onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <><Check className="h-4 w-4 mr-2" /> Finalizar e Registrar</>}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { Database } from 'lucide-react';
