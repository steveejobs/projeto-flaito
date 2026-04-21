import { useState, useEffect } from "react";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { templateService, Template } from "@/services/templateService";
import { TemplateEngine } from "@/utils/templateEngine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Plus, 
  Settings2, 
  History, 
  Eye, 
  Save, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function TemplateStudio() {
  const { officeId, module } = useOfficeRole();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedCaseTemplate] = useState<Template | null>(null);
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (officeId) fetchTemplates();
  }, [officeId, module]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await templateService.listTemplates(officeId!, module || 'LEGAL');
      setTemplates(data);
    } catch (err: any) {
      toast({ title: "Erro ao carregar", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = async (template: Template) => {
    setSelectedCaseTemplate(template);
    setIsEditing(false);
    const version = await templateService.getLatestVersion(template.id);
    setContent(version?.content || "");
  };

  return (
    <div className="container mx-auto py-8 h-[calc(100vh-4rem)] flex flex-col gap-6">
      {/* Header Premium */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Template Studio
          </h1>
          <p className="text-muted-foreground text-lg">Gerencie a identidade e automação dos seus documentos profissionais.</p>
        </div>
        <Button size="lg" className="rounded-full shadow-lg gap-2">
          <Plus className="h-5 w-5" /> Novo Modelo
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
        {/* Lista Lateral */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="p-4 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Modelos Ativos</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {isLoading ? (
                  [1, 2, 3].map(i => <div key={i} className="h-16 w-full animate-pulse bg-muted rounded-xl" />)
                ) : templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className={`w-full p-4 rounded-xl text-left transition-all border border-transparent ${selectedTemplate?.id === t.id ? 'bg-primary/5 border-primary/20 shadow-sm' : 'hover:bg-muted/50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${t.is_system ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{t.name}</p>
                        <div className="flex gap-2 mt-1">
                           <Badge variant="outline" className="text-[9px] uppercase tracking-tighter py-0">{t.category}</Badge>
                           {t.is_system && <Badge className="text-[9px] bg-blue-500/10 text-blue-600 border-none h-4">Sistema</Badge>}
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedTemplate?.id === t.id ? 'rotate-90 text-primary' : ''}`} />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Editor e Preview */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col gap-4 overflow-hidden">
          {selectedTemplate ? (
            <Card className="flex-1 flex flex-col overflow-hidden">
              <Tabs defaultValue="editor" className="flex-1 flex flex-col">
                <CardHeader className="p-4 border-b flex-row justify-between items-center space-y-0 shrink-0">
                  <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="editor" className="gap-2"><Settings2 className="h-4 w-4" /> Editor</TabsTrigger>
                    <TabsTrigger value="preview" className="gap-2"><Eye className="h-4 w-4" /> Preview Real</TabsTrigger>
                    <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Versões (v{selectedTemplate.current_version})</TabsTrigger>
                  </TabsList>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">Descartar</Button>
                    <Button size="sm" className="gap-2 shadow-lg shadow-primary/20"><Save className="h-4 w-4" /> Publicar v{selectedTemplate.current_version + 1}</Button>
                  </div>
                </CardHeader>

                <TabsContent value="editor" className="flex-1 p-0 m-0 overflow-hidden">
                  <div className="grid grid-cols-12 h-full">
                    {/* Área de Texto */}
                    <div className="col-span-9 p-6">
                      <div className="h-full bg-background border rounded-2xl p-6 shadow-inner relative group">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 gap-1"><CheckCircle2 className="h-3 w-3" /> Auto-save ativo</Badge>
                        </div>
                        <Textarea 
                          className="h-full w-full border-none focus-visible:ring-0 resize-none font-serif text-lg leading-relaxed placeholder:text-muted-foreground/30"
                          placeholder="Comece a escrever seu modelo profissional aqui..."
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    {/* Painel de Variáveis */}
                    <div className="col-span-3 border-l bg-muted/30 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-primary" /> Variáveis Dinâmicas
                      </h4>
                      <ScrollArea className="h-[calc(100vh-25rem)]">
                        <div className="space-y-3 pr-4">
                          {[
                            { key: 'client.full_name', label: 'Nome do Cliente' },
                            { key: 'client.cpf', label: 'CPF do Cliente' },
                            { key: 'case.title', label: 'Título do Caso' },
                            { key: 'case.cnj', label: 'Número CNJ' },
                            { key: 'office.name', label: 'Nome do Escritório' }
                          ].map(v => (
                            <button
                              key={v.key}
                              onClick={() => setContent(prev => prev + `{{${v.key}}}`)}
                              className="w-full p-2 text-left text-xs bg-background border border-border/50 rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all group"
                            >
                              <p className="font-bold text-foreground group-hover:text-primary transition-colors">{v.label}</p>
                              <code className="text-[10px] text-muted-foreground opacity-60">{"{{" + v.key + "}}"}</code>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                      
                      <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
                        <p className="text-[11px] leading-relaxed text-primary font-medium">
                          <strong>Dica:</strong> Clique em uma variável para inseri-la na posição do cursor.
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="flex-1 p-6 m-0 bg-muted/50 overflow-y-auto">
                   <div className="max-w-[21cm] mx-auto bg-white shadow-2xl p-[2cm] min-h-[29.7cm] text-black font-serif leading-relaxed rounded-sm border border-border/50 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/50 to-primary" />
                      <div className="whitespace-pre-wrap">
                        {TemplateEngine.resolve(content, {
                           client: { full_name: 'Francisco de Assis Silva', cpf: '123.456.789-00' },
                           office: { name: 'Silva & Associados Inteligência Jurídica' },
                           case: { title: 'Indenização por Danos Morais', cnj: '0012345-67.2026.8.27.0001' },
                           user: { name: 'Dr. Roberto Cardoso', oab: 'TO/12345' }
                        })}
                      </div>
                   </div>
                </TabsContent>
              </Tabs>
            </Card>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-3xl bg-muted/5">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <FileText className="h-10 w-10 text-primary opacity-50" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">Selecione um Modelo</h3>
              <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                Escolha um template na lista lateral para editar suas variáveis e estrutura.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
