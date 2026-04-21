import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, FileText, LayoutPanelLeft, Eye, Database, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { generateCaseDocumentHtml } from "@/lib/caseDocumentHtmlGenerator";
import { useDocumentEngine } from "@/hooks/useDocumentEngine";
import { DocumentPreviewFrame } from "@/components/documents/DocumentPreviewFrame";
import { DocumentTemplateSelector } from "@/components/documents/DocumentTemplateSelector";
import { DocumentTemplateId } from "@/types/institutional";
import { useInstitutionalConfig } from "@/hooks/useInstitutionalConfig";
import { TemplateEngine } from "@/utils/templateEngine";
import { documentService, DocumentVariable } from "@/services/documentService";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CaseDocumentGeneratorProps {
  caseId: string;
  onGenerated: () => void;
}

export function CaseDocumentGenerator({ caseId, onGenerated }: CaseDocumentGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [loadingDb, setLoadingDb] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; code: string; content?: string }[]>([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>("");
  const [visualTemplateId, setVisualTemplateId] = useState<DocumentTemplateId>("premium_elegant");

  // State for dynamic variables
  const [extractedKeys, setExtractedKeys] = useState<string[]>([]);
  const [variableCatalog, setVariableCatalog] = useState<DocumentVariable[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  
  const [officeId, setOfficeId] = useState<string | null>(null);
  const { data: instConfig } = useInstitutionalConfig(officeId || '');
  const { generateDocument, renderedHtml, isRenderLoading, setRenderedHtml } = useDocumentEngine();

  // 1. Load Templates & Office Info
  useEffect(() => {
    async function loadInitialData() {
      if (!open) return;
      setLoadingDb(true);
      
      const { data: caseDoc } = await supabase
        .from("cases")
        .select("office_id")
        .eq("id", caseId)
        .single();
        
      if (caseDoc) {
        setOfficeId(caseDoc.office_id);
        
        // Load templates
        const { data: tpls } = await supabase
          .from("document_templates")
          .select("id, name, code, content")
          .or(`office_id.is.null,office_id.eq.${caseDoc.office_id}`)
          .eq("is_active", true);
        
        if (tpls && tpls.length > 0) {
          setTemplates(tpls);
          setSelectedTemplateCode(tpls[0].code);
        }

        // Load variable catalog for metadata
        const catalog = await documentService.getVariableCatalog(caseDoc.office_id);
        setVariableCatalog(catalog);
      }
      setLoadingDb(false);
    }
    loadInitialData();
  }, [open, caseId]);

  // 2. When template changes, extract variables
  useEffect(() => {
    const template = templates.find(t => t.code === selectedTemplateCode);
    if (template?.content) {
      const keys = TemplateEngine.extractVariables(template.content);
      setExtractedKeys(keys);
      
      // Initialize custom values for keys starting with 'custom.'
      const initialCustom: Record<string, any> = {};
      keys.forEach(k => {
        if (k.startsWith('custom.')) {
          const keyName = k.replace('custom.', '');
          initialCustom[keyName] = customValues[keyName] || "";
        }
      });
      setCustomValues(initialCustom);
    }
  }, [selectedTemplateCode, templates]);

  // 3. Real-time Preview Effect (SQL-Driven)
  useEffect(() => {
    if (!open || !instConfig?.resolvedContext || !selectedTemplateCode) return;

    const template = templates.find(t => t.code === selectedTemplateCode);
    if (!template) return;

    const timer = setTimeout(async () => {
      try {
        // Resolve system variables
        const systemVars = await documentService.resolveSystemVariables(officeId!, instConfig.resolvedContext.client?.id, caseId);
        
        // Merge with custom values (we need to map back to full paths for the engine)
        const fullData: Record<string, any> = { ...systemVars };
        
        // Group by prefix (client, office, case, user, custom)
        Object.entries(systemVars).forEach(([k, v]) => {
          const [prefix, key] = k.split('.');
          if (!fullData[prefix]) fullData[prefix] = {};
          fullData[prefix][key] = v;
        });

        fullData.custom = customValues;
        fullData.institutional = instConfig.resolvedContext;

        // Call SQL RPC for preview
        const body = await documentService.renderTemplate(template.content || "", fullData);
        
        const context = {
          ...instConfig.resolvedContext,
          templateMetadata: {
            ...instConfig.resolvedContext.templateMetadata!,
            id: visualTemplateId
          }
        };

        await generateDocument(context, body);
      } catch (err) {
        console.error("Preview error:", err);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [open, instConfig, selectedTemplateCode, visualTemplateId, templates, customValues, caseId, officeId, generateDocument]);

  // 4. Manual Variable Form Generation
  const manualVariables = useMemo(() => {
    return extractedKeys
      .filter(k => k.startsWith('custom.'))
      .map(k => {
        const catalogItem = variableCatalog.find(v => v.key === k);
        return {
          key: k.replace('custom.', ''),
          fullKey: k,
          label: catalogItem?.label || k.replace('custom.', '').replace(/_/g, ' '),
          type: catalogItem?.type || 'text',
          required: catalogItem?.required || false,
          help: catalogItem?.help_text
        };
      });
  }, [extractedKeys, variableCatalog]);

  const isFormValid = useMemo(() => {
    return manualVariables.every(v => !v.required || (customValues[v.key] !== undefined && customValues[v.key] !== ""));
  }, [manualVariables, customValues]);

  const handleGenerate = async () => {
    if (!selectedTemplateCode) {
      toast.error("Selecione um template");
      return;
    }

    if (!isFormValid) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setGenerating(true);
    try {
      const result = await generateCaseDocumentHtml(caseId, selectedTemplateCode, customValues, visualTemplateId);
      
      if (!result.ok) {
        toast.error("Erro ao gerar documento: " + result.error);
      } else {
        toast.success("Documento gerado e salvo no processo!");
        setOpen(false);
        onGenerated();
      }
    } catch (e: any) {
      toast.error("Erro inesperado: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full px-4 shadow-sm hover:shadow-md transition-all">
          <Plus className="mr-2 h-4 w-4" />
          Gerar Novo Documento
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b bg-background/50 backdrop-blur-md flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="font-black tracking-tight">Assistente de Documentação</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">Workflow de Conformidade & Auditoria</p>
            </div>
          </DialogTitle>
          <div className="flex items-center gap-3 pr-8">
             <Badge variant="outline" className="h-6 text-[9px] font-black tracking-widest uppercase px-2 bg-muted/30 border-primary/10">
                PRO ENGINE V2.4
             </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden divide-x border-t">
          {/* Config Column */}
          <div className="w-[400px] overflow-y-auto p-6 space-y-8 bg-muted/5 custom-scrollbar">
            
            {/* Template Selection */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em] px-1">1. Modelo do Conteúdo</Label>
                {loadingDb ? (
                  <div className="h-12 border border-dashed rounded-xl flex items-center px-4 text-xs gap-3 animate-pulse bg-muted/20">
                    <Loader2 className="h-4 w-4 animate-spin opacity-40" /> 
                    <span className="opacity-50">Sincronizando catálogo...</span>
                  </div>
                ) : (
                  <Select value={selectedTemplateCode} onValueChange={setSelectedTemplateCode}>
                    <SelectTrigger className="h-12 rounded-xl bg-background border-primary/10 shadow-sm focus:ring-primary/20">
                      <SelectValue placeholder="Selecione o texto base" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                      {templates.map(tpl => (
                        <SelectItem key={tpl.id} value={tpl.code} className="py-3 focus:bg-primary/5">
                          <div className="flex flex-col">
                             <span className="font-bold text-sm">{tpl.name}</span>
                             <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">{tpl.code}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Design System */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em] px-1 flex items-center gap-2">
                <LayoutPanelLeft className="h-3 w-3" /> 2. Estética Profissional
              </Label>
              <DocumentTemplateSelector 
                value={visualTemplateId} 
                onChange={setVisualTemplateId} 
              />
            </div>

            {/* Dynamic Form: Manual Variables */}
            {manualVariables.length > 0 && (
              <div className="space-y-5 pt-4 border-t border-primary/5">
                <div className="flex items-center justify-between px-1">
                   <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                      <Database className="h-3 w-3" /> 3. Dados Adicionais
                   </Label>
                   <span className="text-[9px] font-bold text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                      {manualVariables.length} campos
                   </span>
                </div>
                
                <div className="space-y-4">
                  {manualVariables.map(v => (
                    <div key={v.key} className="space-y-1.5 group">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-bold text-muted-foreground group-focus-within:text-primary transition-colors">
                          {v.label} {v.required && <span className="text-destructive font-black">*</span>}
                        </Label>
                      </div>
                      {v.type === 'long_text' ? (
                        <Textarea 
                          value={customValues[v.key] || ""} 
                          onChange={e => setCustomValues({...customValues, [v.key]: e.target.value})}
                          placeholder={`Informe ${v.label.toLowerCase()}...`}
                          className="rounded-xl bg-background border-primary/5 focus:border-primary/20 min-h-[100px] text-sm resize-none shadow-inner"
                        />
                      ) : (
                        <Input 
                          type={v.type === 'number' ? 'number' : 'text'}
                          value={customValues[v.key] || ""} 
                          onChange={e => setCustomValues({...customValues, [v.key]: e.target.value})}
                          placeholder={`Informe ${v.label.toLowerCase()}...`}
                          className="h-11 rounded-xl bg-background border-primary/5 focus:border-primary/20 text-sm shadow-inner"
                        />
                      )}
                      {v.help && <p className="text-[9px] text-muted-foreground italic px-1 opacity-70">{v.help}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isFormValid && (
               <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-tight text-destructive font-bold">
                    Existem campos obrigatórios pendentes. Preencha todos para habilitar a geração final.
                  </p>
               </div>
            )}

            <div className="pt-6 border-t">
              <Button 
                className="w-full h-14 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 rounded-2xl text-base font-black tracking-tight gap-3 transition-all active:scale-95 disabled:opacity-50" 
                disabled={generating || loadingDb || !selectedTemplateCode || !isFormValid} 
                onClick={handleGenerate}
              >
                {generating ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Processando...</>
                ) : (
                  <>Finalizar & Gerar Documento</>
                )}
              </Button>
              <p className="text-center text-[9px] text-muted-foreground mt-4 font-bold uppercase tracking-widest opacity-40">
                O documento será salvo automaticamente no processo
              </p>
            </div>
          </div>

          {/* Preview Column */}
          <div className="flex-1 bg-muted/20 p-10 flex justify-center overflow-y-auto custom-scrollbar">
            <div className="w-full max-w-[800px] flex flex-col gap-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                     <Eye className="h-3 w-3" /> Preview Dinâmico (Real-time SQL)
                   </span>
                </div>
                {isRenderLoading && (
                  <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-[9px] font-black text-primary uppercase tracking-tighter">Sincronizando</span>
                  </div>
                )}
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-b from-primary/10 to-transparent rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                <DocumentPreviewFrame 
                  htmlContent={renderedHtml} 
                  loading={isRenderLoading} 
                  className="shadow-2xl border-0 bg-white relative rounded-[2rem] overflow-hidden min-h-[1123px] w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

