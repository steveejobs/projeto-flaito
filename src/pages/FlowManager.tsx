import { useState, useEffect } from "react";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  FolderTree, 
  Plus, 
  Search, 
  History, 
  Play, 
  ChevronRight,
  MoreVertical,
  Layers,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  ExternalLink
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AutomationFlow {
  id: string;
  name: string;
  channel: string;
  is_active: boolean;
  version_count?: number;
  published_version_id?: string;
  created_at: string;
  updated_at: string;
}

export default function FlowManager() {
  const { officeId } = useOfficeRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (officeId) {
      fetchFlows();
    }
  }, [officeId]);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("automation_flows")
        .select(`
          *,
          flow_versions (count)
        `)
        .eq("office_id", officeId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      
      const formattedData = data.map((flow: any) => ({
        ...flow,
        version_count: flow.flow_versions?.[0]?.count || 0
      }));

      setFlows(formattedData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar fluxos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    try {
      const { data, error } = await supabase
        .from("automation_flows")
        .insert({
          office_id: officeId,
          name: "Novo Fluxo de Automação",
          channel: "whatsapp",
          is_active: false
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Fluxo criado",
        description: "Redirecionando para o builder...",
      });
      
      navigate(`/flow-builder/${data.id}`);
    } catch (error: any) {
      toast({
        title: "Erro ao criar fluxo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredFlows = flows.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 border-border/50">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Builder de Fluxos
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Crie jornadas automatizadas e inteligentes para seus clientes.
          </p>
        </div>
        <Button 
          onClick={handleCreateFlow}
          size="lg" 
          className="rounded-full shadow-lg hover:shadow-primary/20 transition-all gap-2 px-6"
        >
          <Plus className="h-5 w-5" />
          Criar Novo Fluxo
        </Button>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-none shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total de Fluxos</p>
              <p className="text-2xl font-black">{flows.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-none shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Publicados</p>
              <p className="text-2xl font-black">{flows.filter(f => f.is_active).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-none shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Versões Totais</p>
              <p className="text-2xl font-black">{flows.reduce((acc, f) => acc + (f.version_count || 0), 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-indigo-500/5 border-none shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
              <Play className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Execuções (24h)</p>
              <p className="text-2xl font-black">--</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbox */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome do fluxo..." 
            className="pl-10 h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid de Fluxos */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
        </div>
      ) : filteredFlows.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-muted/5 border-muted-foreground/20">
          <FolderTree className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-semibold">Nenhum fluxo projetado</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">
            Crie sequências lógicas de atendimento para qualificar leads ou automatizar suporte.
          </p>
          <Button onClick={handleCreateFlow} variant="outline" className="mt-6 gap-2">
            <Plus className="h-4 w-4" /> Criar Primeiro Fluxo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFlows.map(flow => (
            <Card key={flow.id} className="group overflow-hidden rounded-2xl border-border/50 hover:border-primary/50 transition-all shadow-sm hover:shadow-xl hover:shadow-primary/5">
              <CardHeader className="relative pb-4">
                <div className="absolute right-4 top-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50 rounded-full">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-54 rounded-xl shadow-xl">
                      <DropdownMenuLabel>Gestão de Versões</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate(`/flow-builder/${flow.id}`)} className="gap-2">
                        <Plus className="h-4 w-4" /> Criar Novo Draft
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2">
                        <History className="h-4 w-4" /> Histórico de Versões
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2">
                        <Copy className="h-4 w-4" /> Duplicar Fluxo
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive">
                        <Trash2 className="h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${flow.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'} transition-colors`}>
                    <FolderTree className="h-8 w-8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors truncate pr-8">{flow.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-medium bg-muted/50 border-none capitalize">{flow.channel}</Badge>
                      {flow.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none flex gap-1 items-center">
                          Publicado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground/60">Rascunho</Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Layers className="h-3.5 w-3.5" /> Versões
                    </span>
                    <span className="font-bold">{flow.version_count}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Status
                    </span>
                    <span className={flow.is_active ? "text-emerald-600 font-bold" : "font-bold"}>
                      {flow.is_active ? "Ativo" : "Pendente"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => navigate(`/flow-builder/${flow.id}`)}
                    className="flex-1 rounded-xl shadow-sm gap-2"
                  >
                    Abrir Builder
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
