import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  FileText, 
  Plus, 
  Check, 
  X, 
  Loader2, 
  Eye, 
  Layout, 
  Database, 
  ShieldCheck,
  Bot,
  Hash,
  History,
  Send,
  Lock,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { documentService, DocumentVariable, TemplateVersion } from '@/services/documentService';

const DOC_TYPES = ['PETIÇÃO', 'PROCURAÇÃO', 'CONTRATO', 'DECLARAÇÃO', 'LAUDO', 'OUTROS'] as const;

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  is_active: boolean;
  is_system: boolean;
  office_id: string | null;
  vertical: 'LEGAL' | 'MEDICAL' | 'BOTH';
  description?: string;
  ai_instructions?: string;
  code: string;
  active_version_id?: string;
}

export default function AdminModelos() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [variables, setVariables] = useState<DocumentVariable[]>([]);
  const [activeTab, setActiveTab] = useState('editor');

  const [form, setForm] = useState<Partial<Template>>({
    name: '',
    category: 'PETIÇÃO',
    content: '',
    vertical: 'LEGAL',
    description: '',
    ai_instructions: '',
    code: ''
  });

  const officeId = sessionStorage.getItem('lexos_office_id');

  // Fetch Variables Catalog
  useEffect(() => {
    if (officeId) {
      documentService.getVariableCatalog(officeId).then(setVariables);
    }
  }, [officeId]);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin-modelos', officeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .or(`office_id.is.null,office_id.eq.${officeId}`)
        .order('name');
      if (error) throw error;
      return data as Template[];
    },
    enabled: !!officeId
  });

  // Fetch Versions for selected template
  const { data: versions = [], isLoading: isLoadingVersions } = useQuery({
    queryKey: ['template-versions', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data, error } = await supabase
        .from('document_template_versions')
        .select('*')
        .eq('template_id', selectedId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return data as TemplateVersion[];
    },
    enabled: !!selectedId
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Template>) => {
      const { id, ...payload } = data;
      const finalPayload = { ...payload, office_id: officeId };
      
      let templateId = selectedId;

      if (selectedId) {
        const { error } = await supabase.from('document_templates').update(finalPayload).eq('id', selectedId);
        if (error) throw error;
      } else {
        const { data: newT, error } = await supabase.from('document_templates').insert(finalPayload).select().single();
        if (error) throw error;
        templateId = newT.id;
        setSelectedId(newT.id);
      }

      // Create a draft version automatically on save if content changed
      await documentService.createDraftVersion(templateId!, data.content || '', 'Auto-save draft');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modelos', officeId] });
      queryClient.invalidateQueries({ queryKey: ['template-versions', selectedId] });
      toast.success(selectedId ? 'Modelo salvo (Rascunho criado)' : 'Modelo criado');
    },
    onError: (err: any) => toast.error(err.message)
  });

  const publishMutation = useMutation({
    mutationFn: async (versionId: string) => {
      if (!selectedId) return;
      await documentService.publishVersion(selectedId, versionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modelos', officeId] });
      queryClient.invalidateQueries({ queryKey: ['template-versions', selectedId] });
      toast.success('Versão publicada com sucesso!');
    },
    onError: (err: any) => toast.error(err.message)
  });

  const handleSelectTemplate = (t: Template) => {
    setSelectedId(t.id);
    setForm(t);
    setActiveTab('editor');
  };

  const insertVariable = (key: string) => {
    const placeholder = `{{${key}}}`;
    setForm(prev => ({ ...prev, content: (prev.content || '') + placeholder }));
  };

  const handlePreview = async () => {
    try {
      const mockData = {
        'client.full_name': 'Maria da Silva Santos',
        'office.name': 'Moreira & Associados Advogados',
        'case.cnj_number': '0001234-55.2026.8.27.0001',
        'user.name': 'Dr. João Moreira'
      };
      const html = await documentService.renderTemplate(form.content || '', mockData);
      setRenderedHtml(html);
      setIsPreviewOpen(true);
    } catch (err: any) {
      toast.error('Erro na prévia: ' + err.message);
    }
  };

  const isSystem = form.is_system;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden">
      {/* Sidebar: Templates List */}
      <div className="w-80 border-r flex flex-col bg-muted/5">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Gestão de Documentos</h2>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setSelectedId(null); setForm({ name: '', category: 'PETIÇÃO', content: '', vertical: 'LEGAL', code: '', is_system: false }); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all group flex items-center justify-between",
                  selectedId === t.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className={cn("h-4 w-4 shrink-0", selectedId === t.id ? "text-primary-foreground" : "text-primary")} />
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate font-bold tracking-tight">{t.name}</span>
                    <div className="flex items-center gap-2">
                       <span className={cn("text-[9px] uppercase font-black opacity-50", selectedId === t.id ? "text-primary-foreground" : "text-muted-foreground")}>{t.category}</span>
                       {t.is_system && <Badge variant="secondary" className="h-3.5 text-[8px] px-1 bg-blue-500/20 text-blue-400 border-none">SYSTEM</Badge>}
                    </div>
                  </div>
                </div>
                {t.office_id && !t.is_system && <ShieldCheck className="h-3.5 w-3.5 opacity-40 shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-background/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Layout className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-none tracking-tight">
                {isSystem ? <span className="flex items-center gap-2"><Lock className="h-4 w-4 opacity-40" /> {form.name}</span> : (selectedId ? 'Configurar Modelo' : 'Novo Modelo')}
              </h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1.5">Versionamento & Conformidade</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-full px-4" onClick={handlePreview}>
              <Eye className="h-4 w-4 mr-2" /> Prévia
            </Button>
            {!isSystem && (
              <Button size="sm" className="h-9 rounded-full px-6 shadow-lg shadow-primary/20" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Salvar Rascunho
              </Button>
            )}
            {isSystem && (
               <Button variant="secondary" size="sm" className="h-9 rounded-full px-4 gap-2" onClick={() => {
                 const { id, ...rest } = form;
                 setForm({ ...rest, name: `${form.name} (Customizado)`, is_system: false, office_id: officeId });
                 setSelectedId(null);
                 toast.info("Cópia criada para customização do escritório.");
               }}>
                 <Copy className="h-4 w-4" /> Customizar Modelo
               </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b bg-muted/10">
            <TabsList className="h-12 bg-transparent gap-6">
              <TabsTrigger value="editor" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 gap-2">
                <Layout className="h-4 w-4" /> Editor
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 gap-2">
                <History className="h-4 w-4" /> Histórico de Versões
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <TabsContent value="editor" className="flex-1 flex m-0 overflow-hidden outline-none">
              <ScrollArea className="flex-1">
                <div className="max-w-4xl mx-auto p-8 space-y-10 pb-32">
                  {/* Metadata Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Nome da Peça</Label>
                      <Input disabled={isSystem} value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-11 rounded-xl bg-muted/20 border-primary/5" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Identificador (Code)</Label>
                      <Input disabled={isSystem} value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-11 rounded-xl bg-muted/20 border-primary/5 font-mono text-xs uppercase" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Estrutura do Modelo</Label>
                    <Textarea 
                      disabled={isSystem}
                      value={form.content} 
                      onChange={e => setForm({...form, content: e.target.value})} 
                      className="min-h-[500px] font-mono text-[13px] leading-relaxed p-6 rounded-2xl bg-muted/10 border-primary/5 shadow-inner"
                    />
                  </div>

                  <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 space-y-4">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      <h3 className="font-bold text-sm tracking-tight text-primary">Instruções para IA</h3>
                    </div>
                    <Textarea 
                      disabled={isSystem}
                      value={form.ai_instructions} 
                      onChange={e => setForm({...form, ai_instructions: e.target.value})} 
                      className="bg-background/50 border-primary/10 rounded-xl min-h-[100px] text-sm"
                    />
                  </div>
                </div>
              </ScrollArea>

              {/* Right Sidebar: Variable Picker */}
              <div className="w-80 border-l bg-muted/5 flex flex-col backdrop-blur-sm">
                <div className="p-4 border-b flex items-center gap-3 bg-muted/10">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Catálogo de Variáveis</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-8">
                    {['client', 'case', 'office', 'user', 'custom'].map(cat => (
                      <div key={cat} className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-primary/60 px-2 flex items-center gap-2"><Hash className="h-3 w-3" /> {cat}</h4>
                        <div className="space-y-1">
                          {variables.filter(v => v.key.startsWith(cat)).map(v => (
                            <button
                              key={v.key}
                              disabled={isSystem}
                              onClick={() => insertVariable(v.key)}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-background border border-transparent hover:border-primary/10 text-[11px] font-mono group flex items-center justify-between disabled:opacity-50"
                            >
                              <span className="truncate opacity-70 group-hover:opacity-100">{"{{" + v.key + "}}"}</span>
                              <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="history" className="flex-1 m-0 outline-none bg-muted/5 p-8 overflow-y-auto">
               <div className="max-w-4xl mx-auto space-y-4">
                  {versions.map(v => (
                    <Card key={v.id} className={cn("border-primary/5 overflow-hidden", v.status === 'published' ? "ring-2 ring-primary/20" : "")}>
                       <CardContent className="p-0">
                          <div className="p-4 flex items-center justify-between bg-muted/20">
                             <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center font-black text-xs border">V{v.version_number}</div>
                                <div>
                                   <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm">Versão {v.version_number}</span>
                                      <Badge variant={v.status === 'published' ? 'default' : 'outline'} className="text-[9px] font-black uppercase">
                                         {v.status === 'published' ? 'Publicada' : v.status}
                                      </Badge>
                                   </div>
                                   <p className="text-[10px] text-muted-foreground mt-1">Criada em {new Date(v.created_at).toLocaleString('pt-BR')}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-wider" onClick={() => {
                                  setForm({...form, content: v.content_html});
                                  setActiveTab('editor');
                                  toast.info(`Conteúdo da V${v.version_number} carregado no editor.`);
                                }}>
                                   Restaurar no Editor
                                </Button>
                                {v.status !== 'published' && !isSystem && (
                                   <Button size="sm" className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2 shadow-lg shadow-primary/20" onClick={() => publishMutation.mutate(v.id)} disabled={publishMutation.isPending}>
                                      <Send className="h-3 w-3" /> Publicar
                                   </Button>
                                )}
                             </div>
                          </div>
                          {v.change_log && (
                             <div className="p-4 border-t text-xs text-muted-foreground italic bg-background/50">
                                <strong>Log:</strong> {v.change_log}
                             </div>
                          )}
                       </CardContent>
                    </Card>
                  ))}
                  {versions.length === 0 && (
                     <div className="py-20 text-center opacity-30 italic">Nenhuma versão registrada para este modelo.</div>
                  )}
               </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-none shadow-2xl">
          <div className="p-4 bg-white border-b flex items-center justify-between">
            <h3 className="font-black text-xs uppercase tracking-[0.2em]">Prévia de Conformidade A4</h3>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsPreviewOpen(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-auto p-12 custom-scrollbar">
             <div className="bg-white shadow-2xl mx-auto min-h-[1100px] w-full max-w-[800px] p-[2.5cm] border border-slate-200">
                <div dangerouslySetInnerHTML={{ __html: renderedHtml }} className="prose max-w-none prose-sm" />
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
