import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { 
  Plus, 
  Save, 
  Play, 
  Trash2, 
  MessageCircle, 
  GitBranch, 
  UserPlus, 
  Database, 
  Clock, 
  Check,
  ChevronLeft,
  MousePointer2,
  Hand,
  Maximize2,
  Minimize2,
  Settings,
  ShieldCheck,
  Code
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";

// Node Types
type NodeType = 'message' | 'condition' | 'handoff' | 'crm_action' | 'delay' | 'end';

interface Node {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number, y: number };
  config: any;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export default function FlowBuilder() {
  const { id: flowId } = useParams();
  const { officeId } = useOfficeRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [flow, setFlow] = useState<any>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flowId) {
      fetchFlowData();
    }
  }, [flowId]);

  const fetchFlowData = async () => {
    try {
      const { data, error } = await supabase
        .from("automation_flows")
        .select("*")
        .eq("id", flowId)
        .single();

      if (error) throw error;
      setFlow(data);

      const { data: version, error: verError } = await supabase
        .from("flow_versions")
        .select("*")
        .eq("flow_id", flowId)
        .eq("status", "draft")
        .maybeSingle();

      if (version?.definition_json) {
        setNodes(version.definition_json.nodes || []);
        setConnections(version.definition_json.connections || []);
      } else {
        // Initial node
        setNodes([{
          id: 'start-node',
          type: 'message',
          label: 'Início do Fluxo',
          position: { x: 100, y: 100 },
          config: { text: "Olá! Como posso ajudar você hoje?" }
        }]);
      }
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleAddNode = (type: NodeType) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '),
      position: { x: 200, y: 200 },
      config: {}
    };
    setNodes(prev => [...prev, newNode]);
  };

  const handleSave = async (silent = false) => {
    try {
      setIsSaving(true);
      const definition = { nodes, connections };

      // Get or create draft version
      const { data: existingDraft } = await supabase
        .from("flow_versions")
        .select("id")
        .eq("flow_id", flowId)
        .eq("status", "draft")
        .maybeSingle();

      if (existingDraft) {
        await supabase
          .from("flow_versions")
          .update({ definition_json: definition })
          .eq("id", existingDraft.id);
      } else {
        await supabase
          .from("flow_versions")
          .insert({
            flow_id: flowId,
            office_id: officeId,
            version_number: 1,
            status: 'draft',
            definition_json: definition
          });
      }

      if (!silent) {
        toast({
          title: "Alterações salvas",
          description: "O rascunho do fluxo foi atualizado.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    await handleSave(true);
    // Validation logic here in future
    toast({
      title: "Publicando versionamento...",
      description: "Esta funcionalidade estará disponível na próxima atualização.",
    });
  };

  const updateNodePosition = (id: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, position: { x, y } } : n));
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FB] dark:bg-[#0D0E10] overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 border-b bg-background/80 backdrop-blur-md px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/flow-manager')} className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">{flow?.name || "Carregando..."}</h2>
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary">Draft</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">Última alteração: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-muted/30 p-1 rounded-full border border-border/50">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            <div className="px-3 flex items-center text-xs font-mono">{Math.round(zoom * 100)}%</div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving} className="gap-2 rounded-full px-5">
            <Save className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} /> Salvar
          </Button>
          <Button onClick={handlePublish} className="gap-2 rounded-full px-6 shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/80">
            <ShieldCheck className="h-4 w-4" /> Publicar
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Library */}
        <aside className="w-72 border-r bg-background/50 backdrop-blur-sm p-6 flex flex-col gap-6 z-40">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Blocos de Construção</h3>
            <div className="grid grid-cols-1 gap-3">
              <NodeLibraryItem 
                icon={MessageCircle} 
                color="text-blue-500" 
                bg="bg-blue-500/10 shadow-blue-500/5"
                title="Mensagem" 
                desc="Enviar texto, imagem ou menu"
                onClick={() => handleAddNode('message')} 
              />
              <NodeLibraryItem 
                icon={GitBranch} 
                color="text-amber-500" 
                bg="bg-amber-500/10 shadow-amber-500/5"
                title="Condição" 
                desc="Se/Senão baseado em dados"
                onClick={() => handleAddNode('condition')} 
              />
              <NodeLibraryItem 
                icon={UserPlus} 
                color="text-purple-500" 
                bg="bg-purple-500/10 shadow-purple-500/5"
                title="Handoff" 
                desc="Transferir para um humano"
                onClick={() => handleAddNode('handoff')} 
              />
              <NodeLibraryItem 
                icon={Database} 
                color="text-emerald-500" 
                bg="bg-emerald-500/10 shadow-emerald-500/5"
                title="Ação CRM" 
                desc="Mover card ou criar lead"
                onClick={() => handleAddNode('crm_action')} 
              />
              <NodeLibraryItem 
                icon={Clock} 
                color="text-slate-500" 
                bg="bg-slate-500/10 shadow-slate-500/5"
                title="Delay" 
                desc="Esperar tempo determinado"
                onClick={() => handleAddNode('delay')} 
              />
            </div>
          </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 relative bg-grid h-full overflow-hidden">
          {/* Grid Background via CSS */}
          <div 
            className="absolute inset-0 z-0 bg-transparent opacity-5"
            style={{ 
              backgroundImage: 'radial-gradient(#888 1px, transparent 1px)', 
              backgroundSize: '24px 24px',
              transform: `scale(${zoom})`,
              transformOrigin: '0 0'
            }}
          />

          <div 
            ref={canvasRef}
            className="absolute inset-0 p-20 z-10 transition-transform duration-200"
            style={{ 
              transform: `scale(${zoom})`, 
              transformOrigin: 'center center'
            }}
          >
            {nodes.map(node => (
              <FlowNode 
                key={node.id} 
                node={node} 
                isSelected={selectedNodeId === node.id}
                onClick={() => {
                  setSelectedNodeId(node.id);
                  setIsInspectorOpen(true);
                }}
              />
            ))}
            
            {/* Future: SVG connections Layer */}
          </div>

          <div className="absolute bottom-6 right-6 flex gap-2 z-50">
            <Button variant="secondary" size="icon" className="rounded-full shadow-lg h-10 w-10"><MousePointer2 className="h-5 w-5" /></Button>
            <Button variant="outline" size="icon" className="rounded-full shadow-lg h-10 w-10 bg-background"><Hand className="h-5 w-5" /></Button>
          </div>
        </main>

        {/* Inspector Sheet */}
        <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
          <SheetContent side="right" className="w-[400px]">
            <SheetHeader className="pb-6 border-b">
              <SheetTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configurar Bloco
              </SheetTitle>
              <SheetDescription>
                Ajuste os parâmetros específicos deste nó.
              </SheetDescription>
            </SheetHeader>

            <div className="py-6 space-y-6">
              {selectedNode && (
                <>
                  <div className="space-y-2">
                    <Label>Nome do Bloco</Label>
                    <Input 
                      value={selectedNode.label} 
                      onChange={e => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n))}
                    />
                  </div>

                  {selectedNode.type === 'message' && (
                    <div className="space-y-4 animate-in slide-in-from-bottom-2">
                      <div className="space-y-2">
                        <Label>Texto da Mensagem</Label>
                        <Textarea 
                          rows={6}
                          placeholder="Digite aqui a mensagem que o usuário receberá..."
                          value={selectedNode.config.text || ""}
                          onChange={e => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, config: { ...n.config, text: e.target.value } } : n))}
                        />
                      </div>
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                        <Code className="h-4 w-4 text-primary mt-1" />
                        <p className="text-[10px] text-primary/70 font-mono">
                          Dica: Use {"{nome}"} para personalizar com o nome do cliente.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'handoff' && (
                    <div className="space-y-4 animate-in slide-in-from-bottom-2">
                       <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-2">
                        <Label className="text-purple-600">Equipe de Destino</Label>
                        <Input placeholder="Comercial, Suporte..." />
                       </div>
                    </div>
                  )}

                  <div className="pt-6 border-t">
                    <Button 
                      variant="destructive" 
                      className="w-full gap-2 rounded-xl"
                      onClick={() => {
                        setNodes(nodes.filter(n => n.id !== selectedNode.id));
                        setConnections(connections.filter(c => c.from !== selectedNode.id && c.to !== selectedNode.id));
                        setIsInspectorOpen(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Remover Bloco
                    </Button>
                  </div>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function NodeLibraryItem({ icon: Icon, color, bg, title, desc, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={`p-3 rounded-2xl border border-transparent hover:border-border cursor-pointer transition-all hover:bg-muted/50 group flex items-start gap-3 active:scale-95`}
    >
      <div className={`p-2.5 rounded-xl ${bg} ${color} transition-transform group-hover:scale-110`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-bold leading-none">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{desc}</p>
      </div>
    </div>
  );
}

function FlowNode({ node, isSelected, onClick }: { node: Node, isSelected: boolean, onClick: () => void }) {
  const IconMap: any = {
    message: MessageCircle,
    condition: GitBranch,
    handoff: UserPlus,
    crm_action: Database,
    delay: Clock,
    end: Check
  };

  const Icon = IconMap[node.type] || MessageCircle;

  return (
    <motion.div
      layoutId={node.id}
      style={{ left: node.position.x, top: node.position.y }}
      className={`absolute w-64 bg-background rounded-2xl border-2 shadow-2xl z-20 cursor-move transition-shadow ${isSelected ? 'border-primary shadow-primary/20 ring-4 ring-primary/10' : 'border-border'}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      whileHover={{ scale: 1.02 }}
      drag
      dragMomentum={false}
    >
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg bg-primary/10 text-primary`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider">{node.type}</span>
        </div>
        <div className="h-2 w-2 rounded-full bg-primary/20" />
      </div>
      <div className="p-4">
        <p className="text-sm font-bold truncate">{node.label}</p>
        <div className="mt-2 text-[10px] text-muted-foreground line-clamp-1 italic">
          {node.type === 'message' ? (node.config.text || 'Nenhuma mensagem') : 'Clique para configurar'}
        </div>
      </div>
      
      {/* Ports */}
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-background border-2 border-border rounded-full z-30 hover:bg-primary transition-colors cursor-crosshair" />
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-background border-2 border-border rounded-full z-30 hover:bg-primary transition-colors cursor-crosshair" />
    </motion.div>
  );
}
