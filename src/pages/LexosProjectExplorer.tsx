import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  scanLexosProject,
  generateArchitectureMarkdown,
  LexosFileEntry,
  LexosProjectScan,
} from "@/lib/lexosProjectScanner";
import { FileCode, Layers, Route, Database, Zap, Download, FileText } from "lucide-react";

type GroupKey =
  | "pages"
  | "components"
  | "hooks"
  | "lib"
  | "contexts"
  | "styles"
  | "assets"
  | "config"
  | "edge-functions"
  | "other";

type GroupedFiles = Record<GroupKey, LexosFileEntry[]>;

export default function LexosProjectExplorer() {
  const [scan, setScan] = useState<LexosProjectScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const result = await scanLexosProject();
        setScan(result);
      } catch (e) {
        console.error(e);
        setErrorMsg("Não foi possível escanear o projeto.");
      }
      setLoading(false);
    }
    load();
  }, []);

  const grouped: GroupedFiles = useMemo(() => {
    const base: GroupedFiles = {
      pages: [],
      components: [],
      hooks: [],
      lib: [],
      contexts: [],
      styles: [],
      assets: [],
      config: [],
      "edge-functions": [],
      other: [],
    };

    if (!scan) return base;

    const q = query.toLowerCase().trim();

    for (const f of scan.files) {
      if (q && !f.path.toLowerCase().includes(q)) continue;

      if (f.kind === "page") base.pages.push(f);
      else if (f.kind === "component") base.components.push(f);
      else if (f.kind === "hook") base.hooks.push(f);
      else if (f.kind === "context") base.contexts.push(f);
      else if (f.kind === "lib") base.lib.push(f);
      else if (f.kind === "edge-function") base["edge-functions"].push(f);
      else if (f.kind === "style") base.styles.push(f);
      else if (f.kind === "asset") base.assets.push(f);
      else if (f.kind === "config") base.config.push(f);
      else base.other.push(f);
    }

    return base;
  }, [scan, query]);

  const renderList = (list: LexosFileEntry[]) => (
    <ScrollArea className="h-[380px] pr-3">
      <div className="space-y-1">
        {list.map((f) => (
          <div
            key={f.path}
            className="text-xs border rounded-md px-3 py-1.5 bg-muted/40 font-mono flex items-center justify-between gap-2"
          >
            <span className="truncate">{f.path}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {f.ext}
            </Badge>
          </div>
        ))}
        {list.length === 0 && (
          <div className="text-xs text-muted-foreground mt-2">
            Nenhum arquivo encontrado com os filtros atuais.
          </div>
        )}
      </div>
    </ScrollArea>
  );

  const exportJSON = () => {
    if (!scan) return;

    const blob = new Blob([JSON.stringify(scan, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexos-architecture-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    if (!scan) return;

    const markdown = generateArchitectureMarkdown(scan);
    const blob = new Blob([markdown], { type: "text/markdown" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexos-architecture-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">LEXOS – Arquitetura Completa</h1>
          <p className="text-sm text-muted-foreground">
            Mapa completo do projeto: páginas, componentes, rotas, edge functions e tabelas Supabase.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={exportJSON} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            JSON
          </Button>
          <Button onClick={exportMarkdown} variant="default" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            Markdown
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {scan && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-primary" />
              <div>
                <div className="text-2xl font-bold">{scan.summary.totalPages}</div>
                <div className="text-xs text-muted-foreground">Páginas</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <div>
                <div className="text-2xl font-bold">{scan.summary.totalComponents}</div>
                <div className="text-xs text-muted-foreground">Componentes</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-primary" />
              <div>
                <div className="text-2xl font-bold">{scan.routes.length}</div>
                <div className="text-xs text-muted-foreground">Rotas</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <div>
                <div className="text-2xl font-bold">{scan.summary.totalEdgeFunctions}</div>
                <div className="text-xs text-muted-foreground">Edge Functions</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <div>
                <div className="text-2xl font-bold">{scan.supabaseTables.length}</div>
                <div className="text-xs text-muted-foreground">Tabelas</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {scan && (
        <p className="text-[11px] text-muted-foreground">
          Total de arquivos: {scan.total} • Gerado em{" "}
          {new Date(scan.generatedAt).toLocaleString("pt-BR")}
        </p>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Input
            placeholder="Filtrar por nome (ex: Lexos, Case, NIJA...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md"
          />

          {loading && (
            <div className="text-sm text-muted-foreground mt-2">
              Carregando arquivos...
            </div>
          )}

          {!loading && errorMsg && (
            <div className="text-sm text-destructive mt-2">{errorMsg}</div>
          )}

          {!loading && !errorMsg && scan && (
            <Tabs defaultValue="pages" className="mt-3">
              <div className="w-full overflow-x-auto no-scrollbar">
                <TabsList className="inline-flex min-w-max gap-2 mb-4">
                  <TabsTrigger value="pages" className="whitespace-nowrap text-xs sm:text-sm">
                    Páginas ({grouped.pages.length})
                  </TabsTrigger>
                  <TabsTrigger value="components" className="whitespace-nowrap text-xs sm:text-sm">
                    Componentes ({grouped.components.length})
                  </TabsTrigger>
                  <TabsTrigger value="hooks" className="whitespace-nowrap text-xs sm:text-sm">
                    Hooks ({grouped.hooks.length})
                  </TabsTrigger>
                  <TabsTrigger value="contexts" className="whitespace-nowrap text-xs sm:text-sm">
                    Contexts ({grouped.contexts.length})
                  </TabsTrigger>
                  <TabsTrigger value="lib" className="whitespace-nowrap text-xs sm:text-sm">
                    Lib/Utils ({grouped.lib.length})
                  </TabsTrigger>
                  <TabsTrigger value="edge-functions" className="whitespace-nowrap text-xs sm:text-sm">
                    Edge Functions ({grouped["edge-functions"].length})
                  </TabsTrigger>
                  <TabsTrigger value="routes" className="whitespace-nowrap text-xs sm:text-sm">
                    Rotas ({scan.routes.length})
                  </TabsTrigger>
                  <TabsTrigger value="tables" className="whitespace-nowrap text-xs sm:text-sm">
                    Tabelas ({scan.supabaseTables.length})
                  </TabsTrigger>
                  <TabsTrigger value="other" className="whitespace-nowrap text-xs sm:text-sm">
                    Outros ({grouped.other.length + grouped.styles.length + grouped.assets.length + grouped.config.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="pages" className="mt-3">
                {renderList(grouped.pages)}
              </TabsContent>
              <TabsContent value="components" className="mt-3">
                {renderList(grouped.components)}
              </TabsContent>
              <TabsContent value="hooks" className="mt-3">
                {renderList(grouped.hooks)}
              </TabsContent>
              <TabsContent value="contexts" className="mt-3">
                {renderList(grouped.contexts)}
              </TabsContent>
              <TabsContent value="lib" className="mt-3">
                {renderList(grouped.lib)}
              </TabsContent>
              <TabsContent value="edge-functions" className="mt-3">
                {renderList(grouped["edge-functions"])}
              </TabsContent>
              <TabsContent value="routes" className="mt-3">
                <ScrollArea className="h-[380px] pr-3">
                  <div className="space-y-1">
                    {scan.routes.map((r) => (
                      <div
                        key={r.path}
                        className="text-xs border rounded-md px-3 py-1.5 bg-muted/40 font-mono flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{r.path}</span>
                        <div className="flex gap-1 shrink-0">
                          <Badge variant="secondary" className="text-[10px]">
                            {r.component}
                          </Badge>
                          {r.protected && (
                            <Badge variant="default" className="text-[10px]">
                              🔒
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="tables" className="mt-3">
                <ScrollArea className="h-[380px] pr-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                    {scan.supabaseTables.map((t) => (
                      <div
                        key={t}
                        className="text-xs border rounded-md px-2 py-1 bg-muted/40 font-mono truncate"
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="other" className="mt-3">
                {renderList([...grouped.styles, ...grouped.assets, ...grouped.config, ...grouped.other])}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
