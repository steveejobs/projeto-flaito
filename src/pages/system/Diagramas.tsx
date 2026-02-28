import { useState, useEffect } from 'react';
import { GitBranch, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getDbSnapshot, type DbSnapshot } from '@/system/audit/governanceClient';

export default function Diagramas() {
  const { user } = useAuth();
  const officeId = sessionStorage.getItem('lexos_office_id');
  const [loading, setLoading] = useState(false);
  const [dbSnapshot, setDbSnapshot] = useState<DbSnapshot | null>(null);

  useEffect(() => {
    if (officeId) loadData();
  }, [officeId]);

  const loadData = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const db = await getDbSnapshot(officeId);
      setDbSnapshot(db);
    } catch (err) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const tables = dbSnapshot?.tables || [];
  const functions = dbSnapshot?.functions || [];

  // Generate ER Diagram
  const erDiagram = `erDiagram
${tables.slice(0, 15).map(t => `    ${t.name} {
        uuid id PK
    }`).join('\n')}
`;

  // Generate Flow Diagram
  const flowDiagram = `flowchart TD
    subgraph Auth["Autenticação"]
        LOGIN[Login] --> AUTH{Supabase Auth}
        AUTH -->|JWT| SESSION[Sessão]
    end
    
    subgraph RBAC["Controle de Acesso"]
        SESSION --> ROLE{Role Check}
        ROLE -->|OWNER| FULL[Acesso Total]
        ROLE -->|ADMIN| ADMIN_ACCESS[Acesso Admin]
        ROLE -->|MEMBER| LIMITED[Acesso Limitado]
    end
    
    subgraph RLS["Row Level Security"]
        FULL --> DB[(Database)]
        ADMIN_ACCESS --> DB
        LIMITED --> DB
    end
`;

  // Generate Functions Diagram
  const funcDiagram = `graph LR
    subgraph "SECURITY DEFINER"
${functions.filter(f => f.security_definer).slice(0, 10).map(f => `        ${f.name.replace(/-/g, '_')}["${f.name}"]`).join('\n')}
    end
    
    subgraph "SECURITY INVOKER"
${functions.filter(f => !f.security_definer).slice(0, 10).map(f => `        ${f.name.replace(/-/g, '_')}["${f.name}"]`).join('\n')}
    end
`;

  const copyDiagram = (text: string, name: string) => {
    navigator.clipboard.writeText('```mermaid\n' + text + '\n```');
    toast.success(`Diagrama ${name} copiado`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Diagramas de Arquitetura
          </h1>
          <p className="text-muted-foreground">Diagramas Mermaid em blocos copiáveis</p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Diagrama ER (Tabelas)</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => copyDiagram(erDiagram, 'ER')}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <pre className="font-mono text-xs bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap">
                {erDiagram}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Fluxo de Autenticação</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => copyDiagram(flowDiagram, 'Flow')}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <pre className="font-mono text-xs bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap">
                {flowDiagram}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Funções do Sistema</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => copyDiagram(funcDiagram, 'Functions')}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <pre className="font-mono text-xs bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap">
                {funcDiagram}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
