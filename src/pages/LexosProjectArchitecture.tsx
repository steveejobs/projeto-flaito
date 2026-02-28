import { useState, useEffect } from "react";
import { 
  generateLexosArchitectureSnapshot, 
  LexosArchitectureSnapshot 
} from "@/lexosArchitectureSnapshot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Download, 
  FileCode, 
  Route, 
  Database, 
  Component, 
  FileText,
  Layers,
  RefreshCw,
  Copy,
  Check,
  ArrowLeft,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Menu structure from AppSidebar (for inventory export)
const MENU_TREE_FOR_EXPORT = [
  {
    group: 'Painel',
    items: [
      { title: 'Dashboard', url: '/dashboard', minRole: 'MEMBER' },
      { title: 'Alertas', url: '/alerts', minRole: 'MEMBER' },
    ],
  },
  {
    group: 'Casos',
    items: [
      { title: 'Meus Casos', url: '/cases?scope=mine', minRole: 'MEMBER' },
      { title: 'Casos (Todos)', url: '/cases', minRole: 'MEMBER' },
      { title: 'Documentos', url: '/documents', minRole: 'MEMBER' },
    ],
  },
  {
    group: 'Clientes',
    items: [
      { title: 'Cadastro de Clientes', url: '/clientes', minRole: 'MEMBER' },
    ],
  },
  {
    group: 'Agenda',
    items: [
      { title: 'Compromissos', url: '/agenda', minRole: 'MEMBER' },
      { title: 'Pagamentos Pendentes', url: '/agenda/payments', minRole: 'MEMBER' },
      { title: 'Historico', url: '/agenda/history', minRole: 'MEMBER' },
    ],
  },
  {
    group: 'NIJA',
    items: [
      { title: 'Analise Juridica', url: '/nija', minRole: 'MEMBER' },
      { title: 'Geracao de Pecas', url: '/nija/docs', minRole: 'MEMBER' },
      { title: 'Pesquisa e Precedentes', url: '/nija/research', minRole: 'MEMBER' },
      { title: 'Uso do NIJA', url: '/nija-usage', minRole: 'ADMIN' },
      { title: 'Creditos / Pagamentos', url: '/nija/credits', minRole: 'ADMIN' },
    ],
  },
  {
    group: 'Conteudo',
    items: [
      { title: 'Tipos de Documentos', url: '/document-types', minRole: 'ADMIN' },
      { title: 'Base de Conhecimento', url: '/knowledge', minRole: 'ADMIN' },
    ],
  },
  {
    group: 'Sistema > Escritorio',
    items: [
      { title: 'Meu Escritorio', url: '/meu-escritorio', minRole: 'MEMBER' },
      { title: 'Membros', url: '/settings/members', minRole: 'ADMIN' },
      { title: 'Configuracoes', url: '/settings/office', minRole: 'ADMIN' },
    ],
  },
  {
    group: 'Sistema > Manutencao',
    items: [
      { title: 'Visao Geral do Sistema', url: '/lexos-overview', minRole: 'ADMIN' },
      { title: 'Explorar Projeto', url: '/system/explore', minRole: 'ADMIN' },
      { title: 'Arquitetura', url: '/system/architecture', minRole: 'ADMIN' },
      { title: 'Auditoria do Sistema', url: '/system-audit', minRole: 'ADMIN' },
      { title: 'Integracoes', url: '/integrations', minRole: 'ADMIN' },
    ],
  },
  {
    group: 'Sistema > Administracao',
    items: [
      { title: 'Modelos', url: '/admin/modelos', minRole: 'ADMIN' },
      { title: 'Dicionario TJTO', url: '/admin/tjto-dictionary', minRole: 'ADMIN' },
      { title: 'Precedentes', url: '/admin/precedents', minRole: 'OWNER' },
      { title: 'Manutencao', url: '/system/maintenance', minRole: 'OWNER' },
    ],
  },
];

// Edge functions from supabase/functions directory
const EDGE_FUNCTIONS_LIST = [
  'asaas-create-payment',
  'asaas-webhook',
  'cep-proxy',
  'cleanup-orphan-files',
  'createSignedDownloadUrl',
  'createSignedUploadUrl',
  'delete-case-hard',
  'gcal_sync_events',
  'knowledge-ai-suggest',
  'lexos-chat-assistant',
  'create-client-kit',
  'lexos-extract-document-data',
  'lexos-extract-text',
  'lexos-generate-document',
  'lexos-nija-timebar',
  'lexos-render-document',
  'nija-auto-petition',
  'nija-full-analysis',
  'nija-generate-petition',
  'nija-generate-piece',
  'nija-prescricao',
  'nija-strategy-compare',
  'precedents-worker',
  'public-client-registration',
];

// Dependencies list (from package.json)
const DEPENDENCIES_LIST: Record<string, string> = {
  '@dnd-kit/core': '^6.3.1',
  '@dnd-kit/sortable': '^10.0.0',
  '@hookform/resolvers': '^3.10.0',
  '@radix-ui/react-accordion': '^1.2.11',
  '@radix-ui/react-alert-dialog': '^1.1.14',
  '@radix-ui/react-aspect-ratio': '^1.1.7',
  '@radix-ui/react-avatar': '^1.1.10',
  '@radix-ui/react-checkbox': '^1.3.2',
  '@radix-ui/react-collapsible': '^1.1.11',
  '@radix-ui/react-context-menu': '^2.2.15',
  '@radix-ui/react-dialog': '^1.1.14',
  '@radix-ui/react-dropdown-menu': '^2.1.15',
  '@radix-ui/react-hover-card': '^1.1.14',
  '@radix-ui/react-label': '^2.1.7',
  '@radix-ui/react-menubar': '^1.1.15',
  '@radix-ui/react-navigation-menu': '^1.2.13',
  '@radix-ui/react-popover': '^1.1.14',
  '@radix-ui/react-progress': '^1.1.7',
  '@radix-ui/react-radio-group': '^1.3.7',
  '@radix-ui/react-scroll-area': '^1.2.9',
  '@radix-ui/react-select': '^2.2.5',
  '@radix-ui/react-separator': '^1.1.7',
  '@radix-ui/react-slider': '^1.3.5',
  '@radix-ui/react-slot': '^1.2.3',
  '@radix-ui/react-switch': '^1.2.5',
  '@radix-ui/react-tabs': '^1.1.12',
  '@radix-ui/react-toast': '^1.2.14',
  '@radix-ui/react-toggle': '^1.1.9',
  '@radix-ui/react-toggle-group': '^1.1.10',
  '@radix-ui/react-tooltip': '^1.2.7',
  '@supabase/supabase-js': '^2.87.1',
  '@tanstack/react-query': '^5.83.0',
  'class-variance-authority': '^0.7.1',
  'clsx': '^2.1.1',
  'cmdk': '^1.1.1',
  'date-fns': '^3.6.0',
  'date-fns-tz': '^3.2.0',
  'docx': '^9.5.1',
  'embla-carousel-react': '^8.6.0',
  'file-saver': '^2.0.5',
  'html2pdf.js': '^0.10.2',
  'input-otp': '^1.4.2',
  'jszip': '^3.10.1',
  'lucide-react': '^0.462.0',
  'next-themes': '^0.3.0',
  'qrcode': '^1.5.4',
  'react': '^18.3.1',
  'react-day-picker': '^8.10.1',
  'react-dom': '^18.3.1',
  'react-hook-form': '^7.61.1',
  'react-markdown': '^10.1.0',
  'react-resizable-panels': '^2.1.9',
  'react-router-dom': '^6.30.1',
  'react-textarea-autosize': '^8.5.9',
  'recharts': '^2.15.4',
  'rehype-highlight': '^7.0.2',
  'sonner': '^1.7.4',
  'tailwind-merge': '^2.6.0',
  'tailwindcss-animate': '^1.0.7',
  'vaul': '^0.9.9',
  'zod': '^3.25.76',
};

function generateInventoryMarkdown(snapshot: LexosArchitectureSnapshot): string {
  const now = new Date();
  const dateStr = now.toLocaleString('pt-BR');
  
  // Group files by category for features/services
  const services = snapshot.files.filter(f => f.path.startsWith('src/services/')).map(f => f.path.split('/').pop()?.replace(/\.[^.]+$/, '') || '');
  const featuresFiles = snapshot.files.filter(f => f.path.startsWith('src/features/'));
  const featuresByModule: Record<string, string[]> = {};
  featuresFiles.forEach(f => {
    const parts = f.path.split('/');
    const module = parts[2] || 'root';
    if (!featuresByModule[module]) featuresByModule[module] = [];
    const name = parts[parts.length - 1].replace(/\.[^.]+$/, '');
    if (name !== 'index' && name !== '.gitkeep') featuresByModule[module].push(name);
  });
  
  const contracts = snapshot.files.filter(f => f.path.startsWith('src/contracts/')).map(f => f.path.split('/').pop()?.replace(/\.[^.]+$/, '') || '');
  
  // Lib submodules
  const libNija = snapshot.files.filter(f => f.path.startsWith('src/lib/nija/')).map(f => f.path.split('/').pop()?.replace(/\.[^.]+$/, '') || '');
  const libRbac = snapshot.files.filter(f => f.path.startsWith('src/lib/rbac/')).map(f => f.path.split('/').pop()?.replace(/\.[^.]+$/, '') || '');
  const libTemplates = snapshot.files.filter(f => f.path.startsWith('src/lib/templates/')).map(f => f.path.split('/').pop()?.replace(/\.[^.]+$/, '') || '');
  const libRoot = snapshot.files.filter(f => f.path.match(/^src\/lib\/[^/]+\.[^/]+$/)).map(f => f.path.split('/').pop()?.replace(/\.[^.]+$/, '') || '');

  const totalFeatures = Object.values(featuresByModule).flat().length;
  const depsCount = Object.keys(DEPENDENCIES_LIST).length;

  let md = `# INVENTARIO COMPLETO DO PROJETO LEXOS

> Gerado em: ${dateStr}
> Projeto: ${snapshot.projectName}

---

## 1. RESUMO EXECUTIVO

| Categoria | Total |
|-----------|-------|
| Paginas | ${snapshot.summary.totalPages} |
| Componentes | ${snapshot.summary.totalComponents} |
| Hooks | ${snapshot.summary.totalHooks} |
| Contexts | ${snapshot.summary.totalContexts} |
| Services | ${services.length} |
| Features | ${totalFeatures} |
| Libs/Utils | ${snapshot.summary.totalLibs} |
| Edge Functions | ${EDGE_FUNCTIONS_LIST.length} |
| Tabelas Supabase | ${snapshot.supabaseTables.length} |
| Dependencias | ${depsCount} |
| **Total de Arquivos** | **${snapshot.total}** |

---

## 2. ESTRUTURA DE NAVEGACAO (MENU)

`;

  MENU_TREE_FOR_EXPORT.forEach(group => {
    md += `### ${group.group}\n`;
    group.items.forEach(item => {
      md += `- ${item.title} (${item.url}) - ${item.minRole}\n`;
    });
    md += '\n';
  });

  md += `---

## 3. ROTAS DA APLICACAO (${snapshot.routes.length})

| Rota | Componente | Acesso |
|------|------------|--------|
`;
  snapshot.routes.forEach(r => {
    md += `| ${r.path} | ${r.component} | ${r.protected ? 'Protegida' : 'Publica'} |\n`;
  });

  md += `
---

## 4. PAGINAS (${snapshot.pages.length})

`;
  snapshot.pages.forEach(p => {
    md += `- ${p}\n`;
  });

  md += `
---

## 5. COMPONENTES (${snapshot.components.length})

`;
  snapshot.components.forEach(c => {
    md += `- ${c}\n`;
  });

  md += `
---

## 6. FEATURES POR MODULO

`;
  Object.entries(featuresByModule).forEach(([mod, items]) => {
    if (items.length > 0) {
      md += `### ${mod} (${items.length})\n`;
      items.forEach(i => {
        md += `- ${i}\n`;
      });
      md += '\n';
    }
  });

  md += `---

## 7. SERVICES (${services.length})

`;
  services.forEach(s => {
    md += `- ${s}\n`;
  });

  md += `
---

## 8. HOOKS (${snapshot.hooks.length})

`;
  snapshot.hooks.forEach(h => {
    md += `- ${h}\n`;
  });

  md += `
---

## 9. CONTEXTS (${snapshot.contexts.length})

`;
  snapshot.contexts.forEach(c => {
    md += `- ${c}\n`;
  });

  md += `
---

## 10. BIBLIOTECAS E UTILITARIOS

### Lib Raiz (${libRoot.length})
`;
  libRoot.forEach(l => {
    md += `- ${l}\n`;
  });

  md += `
### Lib NIJA (${libNija.length})
`;
  libNija.forEach(l => {
    md += `- ${l}\n`;
  });

  md += `
### Lib RBAC (${libRbac.length})
`;
  libRbac.forEach(l => {
    md += `- ${l}\n`;
  });

  md += `
### Lib Templates (${libTemplates.length})
`;
  libTemplates.forEach(l => {
    md += `- ${l}\n`;
  });

  md += `
---

## 11. CONTRACTS (${contracts.length})

`;
  contracts.forEach(c => {
    md += `- ${c}\n`;
  });

  md += `
---

## 12. EDGE FUNCTIONS SUPABASE (${EDGE_FUNCTIONS_LIST.length})

`;
  EDGE_FUNCTIONS_LIST.forEach(ef => {
    md += `- ${ef}\n`;
  });

  md += `
---

## 13. TABELAS SUPABASE (${snapshot.supabaseTables.length})

`;
  snapshot.supabaseTables.forEach(t => {
    md += `- ${t}\n`;
  });

  md += `
---

## 14. DEPENDENCIAS (${depsCount})

| Pacote | Versao |
|--------|--------|
`;
  Object.entries(DEPENDENCIES_LIST).forEach(([pkg, ver]) => {
    md += `| ${pkg} | ${ver} |\n`;
  });

  md += `
---

## 15. ARQUIVOS DE CONFIGURACAO

- vite.config.ts
- tailwind.config.ts
- tsconfig.json
- tsconfig.app.json
- tsconfig.node.json
- postcss.config.js
- eslint.config.js
- components.json
- package.json
- supabase/config.toml

---

## 16. TODOS OS ARQUIVOS POR CATEGORIA

`;

  const filesByCategory: Record<string, string[]> = {};
  snapshot.files.forEach(f => {
    const cat = f.category;
    if (!filesByCategory[cat]) filesByCategory[cat] = [];
    filesByCategory[cat].push(f.path);
  });

  Object.entries(filesByCategory).sort().forEach(([cat, files]) => {
    md += `### ${cat.toUpperCase()} (${files.length})\n`;
    files.sort().forEach(f => {
      md += `- ${f}\n`;
    });
    md += '\n';
  });

  md += `---

*Fim do Inventario*
`;

  return md;
}

export default function LexosProjectArchitecture() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<LexosArchitectureSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadSnapshot = () => {
    setLoading(true);
    try {
      const data = generateLexosArchitectureSnapshot();
      setSnapshot(data);
    } catch (error) {
      console.error("Erro ao gerar snapshot:", error);
      toast.error("Erro ao gerar snapshot da arquitetura");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshot();
  }, []);

  const handleDownloadJSON = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexos-architecture-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("JSON baixado com sucesso!");
  };

  const handleCopyJSON = async () => {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setCopied(true);
      toast.success("JSON copiado para a area de transferencia!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar JSON");
    }
  };

  const handleDownloadInventory = () => {
    if (!snapshot) return;
    const markdown = generateInventoryMarkdown(snapshot);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario-lexos-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Inventario completo baixado!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
            <CardDescription>Nao foi possivel gerar o snapshot da arquitetura.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadSnapshot}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summaryCards = [
    { label: "Paginas", value: snapshot.summary.totalPages, icon: FileText, color: "bg-blue-500/10 text-blue-600" },
    { label: "Componentes", value: snapshot.summary.totalComponents, icon: Component, color: "bg-green-500/10 text-green-600" },
    { label: "Hooks", value: snapshot.summary.totalHooks, icon: Layers, color: "bg-purple-500/10 text-purple-600" },
    { label: "Contexts", value: snapshot.summary.totalContexts, icon: Layers, color: "bg-orange-500/10 text-orange-600" },
    { label: "Libs", value: snapshot.summary.totalLibs, icon: FileCode, color: "bg-cyan-500/10 text-cyan-600" },
    { label: "Tabelas Supabase", value: snapshot.supabaseTables.length, icon: Database, color: "bg-emerald-500/10 text-emerald-600" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Arquitetura do Projeto</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Snapshot LEXOS • {new Date(snapshot.generatedAt).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadSnapshot}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyJSON}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
            <Download className="h-4 w-4 mr-2" />
            Baixar JSON
          </Button>
          <Button size="sm" onClick={handleDownloadInventory}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Inventario
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-border/50">
            <CardContent className="p-4">
              <div className={`inline-flex p-2 rounded-lg ${card.color} mb-2`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-sm text-muted-foreground">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-5">
            <TabsTrigger value="overview" className="whitespace-nowrap">Visão Geral</TabsTrigger>
            <TabsTrigger value="routes" className="whitespace-nowrap">Rotas</TabsTrigger>
            <TabsTrigger value="files" className="whitespace-nowrap">Arquivos</TabsTrigger>
            <TabsTrigger value="database" className="whitespace-nowrap">Banco de Dados</TabsTrigger>
            <TabsTrigger value="json" className="whitespace-nowrap">JSON</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pages */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Páginas ({snapshot.pages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="flex flex-wrap gap-1">
                    {snapshot.pages.map((page) => (
                      <Badge key={page} variant="secondary" className="text-xs">
                        {page}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Components */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Component className="h-5 w-5 text-green-500" />
                  Componentes ({snapshot.components.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="flex flex-wrap gap-1">
                    {snapshot.components.map((comp) => (
                      <Badge key={comp} variant="outline" className="text-xs">
                        {comp}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Hooks & Contexts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-500" />
                  Hooks & Contexts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Hooks ({snapshot.hooks.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {snapshot.hooks.map((hook) => (
                          <Badge key={hook} variant="secondary" className="text-xs bg-purple-500/10">
                            {hook}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Contexts ({snapshot.contexts.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {snapshot.contexts.map((ctx) => (
                          <Badge key={ctx} variant="secondary" className="text-xs bg-orange-500/10">
                            {ctx}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Libs */}
            <Card className="md:col-span-2 lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-cyan-500" />
                  Bibliotecas e Utilitários ({snapshot.libs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {snapshot.libs.map((lib) => (
                    <Badge key={lib} variant="outline" className="text-xs">
                      {lib}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="routes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Rotas da Aplicação ({snapshot.routes.length})
              </CardTitle>
              <CardDescription>Todas as rotas configuradas no projeto</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {snapshot.routes.map((route) => (
                    <div
                      key={route.path}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {route.path}
                        </code>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{route.component}</span>
                      </div>
                      <Badge variant={route.protected ? "default" : "secondary"}>
                        {route.protected ? "Protegida" : "Pública"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                Arquivos do Projeto ({snapshot.total})
              </CardTitle>
              <CardDescription>Todos os arquivos mapeados no projeto</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1">
                  {snapshot.files.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 transition-colors text-sm"
                    >
                      <code className="font-mono text-xs truncate flex-1">{file.path}</code>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge variant="outline" className="text-xs">
                          {file.kind}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          .{file.ext}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Tabelas Supabase ({snapshot.supabaseTables.length})
              </CardTitle>
              <CardDescription>Tabelas disponíveis no banco de dados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {snapshot.supabaseTables.map((table) => (
                  <div
                    key={table}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Database className="h-4 w-4 text-emerald-500" />
                    <code className="text-sm font-mono">{table}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                JSON Completo
              </CardTitle>
              <CardDescription>Snapshot completo em formato JSON</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(snapshot, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
