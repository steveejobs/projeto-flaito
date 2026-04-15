import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, FileText, LayoutPanelLeft, Eye } from "lucide-react";
import { toast } from "sonner";
import { generateCaseDocumentHtml } from "@/lib/caseDocumentHtmlGenerator";
import { useDocumentEngine } from "@/hooks/useDocumentEngine";
import { DocumentPreviewFrame } from "@/components/documents/DocumentPreviewFrame";
import { DocumentTemplateSelector } from "@/components/documents/DocumentTemplateSelector";
import { DocumentTemplateId } from "@/types/institutional";
import { useInstitutionalConfig } from "@/hooks/useInstitutionalConfig";
import { cn } from "@/lib/utils";

interface CaseDocumentGeneratorProps {
  caseId: string;
  onGenerated: () => void;
}

export function CaseDocumentGenerator({ caseId, onGenerated }: CaseDocumentGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [loadingDb, setLoadingDb] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [visualTemplateId, setVisualTemplateId] = useState<DocumentTemplateId>("premium_elegant");

  const [officeId, setOfficeId] = useState<string | null>(null);
  const { data: instConfig } = useInstitutionalConfig(officeId || '');
  const { generateDocument, renderedHtml, isRenderLoading } = useDocumentEngine();

  // Load Templates & Office Info
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
        const { data: tpls } = await supabase
          .from("document_templates")
          .select("id, name, code")
          .eq("office_id", caseDoc.office_id)
          .eq("is_active", true);
        
        if (tpls && tpls.length > 0) {
          setTemplates(tpls);
          setSelectedTemplate(tpls[0].code);
        } else {
          setTemplates([{ id: "fallback1", name: "Procuração Padrão", code: "PROC" }, { id: "fallback2", name: "Contrato de Honorários", code: "CONTRATO" }]);
          setSelectedTemplate("PROC");
        }
      }
      setLoadingDb(false);
    }
    loadInitialData();
  }, [open, caseId]);

  // Draft Rendering Effect
  useEffect(() => {
    if (!open || !instConfig?.resolvedContext || !selectedTemplate) return;

    const timer = setTimeout(async () => {
      const context = {
        ...instConfig.resolvedContext,
        templateMetadata: {
          ...instConfig.resolvedContext.templateMetadata!,
          id: visualTemplateId
        }
      };

      const mockBody = `
        <h1 style="text-align: center;">${templates.find(t => t.code === selectedTemplate)?.name || 'Documento'}</h1>
        <p style="text-align: right;">Cidade, ${new Date().toLocaleDateString('pt-BR')}</p>
        <br/><br/>
        <p>Este é um <b>rascunho de visualização</b> do template escolhido.</p>
        <p>Ao clicar em "Gerar Documento", o sistema preencherá automaticamente todos os dados do cliente, do processo e os termos jurídicos configurados.</p>
        <br/>
        <div style="border: 1px dashed #ccc; padding: 20px; text-align: center; color: #666; font-size: 0.9em;">
          [ CONTEÚDO DINÂMICO DO TEMPLATE: ${selectedTemplate} ]
        </div>
      `;

      await generateDocument(context, mockBody);
    }, 500);

    return () => clearTimeout(timer);
  }, [open, instConfig, selectedTemplate, visualTemplateId, templates, generateDocument]);

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast.error("Selecione um template");
      return;
    }

    setGenerating(true);
    try {
      const result = await generateCaseDocumentHtml(caseId, selectedTemplate, {}, visualTemplateId);
      
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
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Gerar Novo Documento
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerador de Documentos Jurídicos
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden divide-x">
          {/* Config Column */}
          <div className="w-80 overflow-y-auto p-6 space-y-6 bg-muted/10">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">1. Modelo do Conteúdo</Label>
                {loadingDb ? (
                  <div className="h-10 border rounded flex items-center px-3 text-xs gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                  </div>
                ) : (
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione o texto base" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(tpl => (
                        <SelectItem key={tpl.id} value={tpl.code}>
                          {tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <LayoutPanelLeft className="h-3 w-3" /> 2. Estética Profissional
                </Label>
                <DocumentTemplateSelector 
                  value={visualTemplateId} 
                  onChange={setVisualTemplateId} 
                />
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Info</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  O sistema utilizará o <b>Snapshot Institucional</b> atual para garantir que o cabeçalho e rodapé reflitam as configurações vigentes do escritório.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <Button 
                className="w-full h-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" 
                disabled={generating || loadingDb || !selectedTemplate} 
                onClick={handleGenerate}
              >
                {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : "Gerar Documento Final"}
              </Button>
            </div>
          </div>

          {/* Preview Column */}
          <div className="flex-1 bg-muted/30 p-8 flex justify-center overflow-y-auto">
            <div className="w-full max-w-[700px] flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-2">
                  <Eye className="h-3 w-3" /> Preview do Design System
                </span>
                {isRenderLoading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </div>
              
              <DocumentPreviewFrame 
                htmlContent={renderedHtml} 
                loading={isRenderLoading} 
                className="shadow-2xl border-0 bg-white"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
