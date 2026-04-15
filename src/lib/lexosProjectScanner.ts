export type LexosFileKind = "page" | "component" | "hook" | "lib" | "context" | "edge-function" | "style" | "asset" | "config" | "other";

export type LexosFileEntry = {
  path: string;
  ext: string;
  kind: LexosFileKind;
  category?: string;
};

export type LexosRoute = {
  path: string;
  component: string;
  protected: boolean;
};

export type LexosEdgeFunction = {
  name: string;
  path: string;
};

export type LexosProjectScan = {
  projectName: string;
  total: number;
  files: LexosFileEntry[];
  routes: LexosRoute[];
  edgeFunctions: LexosEdgeFunction[];
  contexts: string[];
  hooks: string[];
  pages: string[];
  components: string[];
  libs: string[];
  supabaseTables: string[];
  generatedAt: string;
  summary: {
    totalPages: number;
    totalComponents: number;
    totalHooks: number;
    totalLibs: number;
    totalContexts: number;
    totalEdgeFunctions: number;
    totalStyles: number;
    totalAssets: number;
    totalConfigs: number;
  };
};

function classifyKind(path: string, ext: string): LexosFileKind {
  const e = ext.toLowerCase();
  const p = path.toLowerCase();
  
  // Classify by path first
  if (p.includes("/pages/")) return "page";
  if (p.includes("/components/")) return "component";
  if (p.includes("/hooks/")) return "hook";
  if (p.includes("/contexts/")) return "context";
  if (p.includes("/lib/") || p.includes("/utils/")) return "lib";
  if (p.includes("supabase/functions/")) return "edge-function";
  
  // Then by extension
  if (["css", "scss", "sass"].includes(e)) return "style";
  if (["json", "yml", "yaml", "toml"].includes(e)) return "config";
  if (["png", "jpg", "jpeg", "webp", "svg", "ico", "gif"].includes(e)) return "asset";
  if (["ts", "tsx", "js", "jsx"].includes(e)) return "lib";
  
  return "other";
}

function getCategory(path: string): string {
  if (path.startsWith("src/pages/")) return "pages";
  if (path.startsWith("src/components/ui/")) return "ui-components";
  if (path.startsWith("src/components/")) return "components";
  if (path.startsWith("src/hooks/")) return "hooks";
  if (path.startsWith("src/contexts/")) return "contexts";
  if (path.startsWith("src/lib/")) return "lib";
  if (path.startsWith("src/integrations/")) return "integrations";
  if (path.startsWith("supabase/functions/")) return "edge-functions";
  if (path.startsWith("supabase/")) return "supabase-config";
  if (path.startsWith("public/")) return "public-assets";
  return "root";
}

function normalizePath(raw: string): string {
  if (raw.startsWith("../")) {
    return "src/" + raw.slice(3);
  }
  if (raw.startsWith("./")) {
    return "src/" + raw.slice(2);
  }
  return raw;
}

function extractFileName(path: string): string {
  const parts = path.split("/");
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.(tsx?|jsx?|css|json)$/, "");
}

// Routes extracted from App.tsx structure
const KNOWN_ROUTES: LexosRoute[] = [
  { path: "/", component: "Index", protected: false },
  { path: "/login", component: "Login", protected: false },
  { path: "/signup", component: "Signup", protected: false },
  { path: "/dashboard", component: "Dashboard", protected: true },
  { path: "/meu-escritorio", component: "MeuEscritorio", protected: true },
  { path: "/clientes", component: "Clientes", protected: true },
  { path: "/cases", component: "Cases", protected: true },
  { path: "/documents", component: "Documents", protected: true },
  { path: "/document-types", component: "DocumentTypes", protected: true },
  { path: "/nija-usage", component: "NijaUsage", protected: true },
  { path: "/onboarding", component: "Onboarding", protected: true },
  { path: "/reports", component: "Reports", protected: true },
  { path: "/integrations", component: "Integrations", protected: true },
  { path: "/alerts", component: "DeadlineAlerts", protected: true },
  { path: "/lexos-overview", component: "LexosOverview", protected: true },
  { path: "/lexos-project", component: "LexosProjectExplorer", protected: true },
  { path: "/nija", component: "Nija", protected: false },
  { path: "/documents/print/:id", component: "DocumentPrint", protected: false },
];

// Known Supabase tables from the types file
const KNOWN_TABLES = [
  "assistant_memory",
  "audit_events",
  "audit_log",
  "audit_logs",
  "case_cnj_snapshots",
  "case_deadlines",
  "case_events",
  "case_expenses",
  "case_permissions",
  "case_stage_logs",
  "case_stage_rules",
  "case_status_logs",
  "case_status_rules",
  "case_status_transitions",
  "case_task_templates",
  "case_tasks",
  "cases",
  "chat_ai_logs",
  "chat_messages",
  "chat_threads",
  "client_files",
  "clients",
  "document_access_logs",
  "document_events",
  "document_render_jobs",
  "document_sign_requests",
  "document_status_logs",
  "document_status_rules",
  "document_template_tag_map",
  "document_template_tags",
  "document_template_versions",
  "document_templates",
  "document_type_permissions",
  "document_types",
  "documents",
  "generated_docs",
  "generated_documents",
  "legal_subjects",
  "nija_usage_logs",
  "office_branding",
  "office_headers",
  "office_members",
  "offices",
  "profiles",
  "signature_requests",
  "document_signatures",
];

export async function scanLexosProject(): Promise<LexosProjectScan> {
  // Só comentando para previnir o vite import.meta.glob de estourar The Rollup AST tree com todas as types
  // const modules = import.meta.glob([
  //   "../**/*.{ts,tsx,js,jsx,css,scss,json}",
  // ], { eager: false });
  const modules: Record<string, () => Promise<unknown>> = {};

  const files: LexosFileEntry[] = Object.keys(modules)
    .map((raw) => normalizePath(raw))
    .filter((path) => !path.endsWith("/") && !path.includes("node_modules"))
    .map((path) => {
      const parts = path.split(".");
      const ext = parts.length > 1 ? parts[parts.length - 1] : "";
      const kind = classifyKind(path, ext);
      const category = getCategory(path);
      return { path, ext, kind, category };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  // Extract specific categories
  const pages = files.filter(f => f.kind === "page").map(f => extractFileName(f.path));
  const components = files.filter(f => f.kind === "component").map(f => extractFileName(f.path));
  const hooks = files.filter(f => f.kind === "hook").map(f => extractFileName(f.path));
  const libs = files.filter(f => f.kind === "lib" && f.category === "lib").map(f => extractFileName(f.path));
  const contexts = files.filter(f => f.kind === "context").map(f => extractFileName(f.path));
  
  // Edge functions
  const edgeFunctions: LexosEdgeFunction[] = files
    .filter(f => f.path.includes("supabase/functions/") && f.path.endsWith("/index.ts"))
    .map(f => {
      const match = f.path.match(/supabase\/functions\/([^/]+)\//);
      return {
        name: match ? match[1] : f.path,
        path: f.path,
      };
    });

  const summary = {
    totalPages: pages.length,
    totalComponents: components.length,
    totalHooks: hooks.length,
    totalLibs: libs.length,
    totalContexts: contexts.length,
    totalEdgeFunctions: edgeFunctions.length,
    totalStyles: files.filter(f => f.kind === "style").length,
    totalAssets: files.filter(f => f.kind === "asset").length,
    totalConfigs: files.filter(f => f.kind === "config").length,
  };

  return {
    projectName: "LEXOS",
    total: files.length,
    files,
    routes: KNOWN_ROUTES,
    edgeFunctions,
    contexts,
    hooks,
    pages,
    components,
    libs,
    supabaseTables: KNOWN_TABLES,
    generatedAt: new Date().toISOString(),
    summary,
  };
}

// Generate a complete architecture markdown document
export function generateArchitectureMarkdown(scan: LexosProjectScan): string {
  const lines: string[] = [];
  
  lines.push(`# ${scan.projectName} - Arquitetura Completa do Projeto`);
  lines.push(`\n> Gerado em: ${new Date(scan.generatedAt).toLocaleString("pt-BR")}`);
  lines.push(`\n## Resumo\n`);
  lines.push(`| Categoria | Total |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| Páginas | ${scan.summary.totalPages} |`);
  lines.push(`| Componentes | ${scan.summary.totalComponents} |`);
  lines.push(`| Hooks | ${scan.summary.totalHooks} |`);
  lines.push(`| Libs/Utils | ${scan.summary.totalLibs} |`);
  lines.push(`| Contexts | ${scan.summary.totalContexts} |`);
  lines.push(`| Edge Functions | ${scan.summary.totalEdgeFunctions} |`);
  lines.push(`| Estilos | ${scan.summary.totalStyles} |`);
  lines.push(`| Assets | ${scan.summary.totalAssets} |`);
  lines.push(`| Configs | ${scan.summary.totalConfigs} |`);
  lines.push(`| **Total de Arquivos** | **${scan.total}** |`);
  
  lines.push(`\n---\n`);
  lines.push(`## Rotas da Aplicação\n`);
  lines.push(`| Rota | Componente | Protegida |`);
  lines.push(`|------|------------|-----------|`);
  scan.routes.forEach(r => {
    lines.push(`| \`${r.path}\` | ${r.component} | ${r.protected ? "✅ Sim" : "❌ Não"} |`);
  });
  
  lines.push(`\n---\n`);
  lines.push(`## Páginas (${scan.pages.length})\n`);
  scan.pages.forEach(p => lines.push(`- ${p}`));
  
  lines.push(`\n---\n`);
  lines.push(`## Componentes (${scan.components.length})\n`);
  scan.components.forEach(c => lines.push(`- ${c}`));
  
  lines.push(`\n---\n`);
  lines.push(`## Hooks (${scan.hooks.length})\n`);
  scan.hooks.forEach(h => lines.push(`- ${h}`));
  
  lines.push(`\n---\n`);
  lines.push(`## Contexts (${scan.contexts.length})\n`);
  scan.contexts.forEach(c => lines.push(`- ${c}`));
  
  lines.push(`\n---\n`);
  lines.push(`## Libs/Utils (${scan.libs.length})\n`);
  scan.libs.forEach(l => lines.push(`- ${l}`));
  
  lines.push(`\n---\n`);
  lines.push(`## Edge Functions Supabase (${scan.edgeFunctions.length})\n`);
  scan.edgeFunctions.forEach(ef => {
    lines.push(`- **${ef.name}** → \`${ef.path}\``);
  });
  
  lines.push(`\n---\n`);
  lines.push(`## Tabelas Supabase (${scan.supabaseTables.length})\n`);
  scan.supabaseTables.forEach(t => lines.push(`- ${t}`));
  
  lines.push(`\n---\n`);
  lines.push(`## Todos os Arquivos por Categoria\n`);
  
  const byCategory = new Map<string, LexosFileEntry[]>();
  scan.files.forEach(f => {
    const cat = f.category || "other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(f);
  });
  
  byCategory.forEach((files, category) => {
    lines.push(`\n### ${category} (${files.length})\n`);
    lines.push("```");
    files.forEach(f => lines.push(f.path));
    lines.push("```");
  });
  
  return lines.join("\n");
}
