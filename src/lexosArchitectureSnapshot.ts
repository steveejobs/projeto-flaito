export type LexosFileKind =
  | "page"
  | "component"
  | "hook"
  | "context"
  | "style"
  | "lib"
  | "integration"
  | "other";

export type LexosFileCategory =
  | "root"
  | "components"
  | "ui-components"
  | "pages"
  | "hooks"
  | "contexts"
  | "integrations"
  | "styles"
  | "other";

export type LexosFileInfo = {
  path: string;
  ext: string;
  kind: LexosFileKind;
  category: LexosFileCategory;
};

export type LexosRouteInfo = {
  path: string;
  component: string;
  protected: boolean;
};

export type LexosEdgeFunctionInfo = {
  name: string;
  detectedBy: "invoke" | "url";
  files: string[];
};

export type LexosArchitectureSnapshot = {
  projectName: string;
  total: number;
  files: LexosFileInfo[];
  routes: LexosRouteInfo[];
  edgeFunctions: LexosEdgeFunctionInfo[];
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

// Mapeia os módulos do projeto (apenas dentro de src/)
const fileModules = import.meta.glob("./**/*", { eager: false });

const guessKindAndCategory = (
  path: string
): Pick<LexosFileInfo, "kind" | "category"> => {
  const normalized = path.startsWith("./") ? path.replace("./", "src/") : path;

  if (normalized.startsWith("src/pages/")) {
    return { kind: "page", category: "pages" };
  }

  if (normalized.startsWith("src/components/ui/")) {
    return { kind: "component", category: "ui-components" };
  }

  if (normalized.startsWith("src/components/")) {
    return { kind: "component", category: "components" };
  }

  if (normalized.startsWith("src/contexts/")) {
    return { kind: "context", category: "contexts" };
  }

  if (normalized.startsWith("src/hooks/")) {
    return { kind: "hook", category: "hooks" };
  }

  if (normalized.startsWith("src/integrations/")) {
    return { kind: "integration", category: "integrations" };
  }

  if (normalized.endsWith(".css")) {
    return { kind: "style", category: "styles" };
  }

  // libs e utilitários raiz
  if (normalized.startsWith("src/")) {
    return { kind: "lib", category: "root" };
  }

  return { kind: "other", category: "other" };
};

const routes: LexosRouteInfo[] = [
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
  { path: "/lexos-project-architecture", component: "LexosProjectArchitecture", protected: true },
  { path: "/system-audit", component: "SystemAudit", protected: true },
  { path: "/nija", component: "Nija", protected: true },
  { path: "/documents/print/:id", component: "DocumentPrint", protected: true },
  { path: "/agenda", component: "Agenda", protected: true },
  { path: "/admin/tjto-dictionary", component: "TjtoDictionaryAdmin", protected: true },
  { path: "/knowledge", component: "Knowledge", protected: true },
  { path: "/admin/maintenance", component: "AdminMaintenance", protected: true },
];

const supabaseTables: string[] = [
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

const getBasename = (path: string) => {
  const normalized = path.startsWith("./") ? path.replace("./", "src/") : path;
  const parts = normalized.split("/");
  const last = parts[parts.length - 1];
  return last.replace(/\.[^.]+$/, "");
};

// Known edge functions detected by code analysis patterns
// This simulates what a build-time scanner would find
const knownEdgeFunctionUsages: { name: string; detectedBy: "invoke" | "url"; files: string[] }[] = [
  { name: "lexos-chat-assistant", detectedBy: "invoke", files: ["src/components/LexosChatAssistant.tsx"] },
  { name: "lexos-extract-document-data", detectedBy: "invoke", files: ["src/components/AIFillButton.tsx"] },
  { name: "lexos-extract-text", detectedBy: "invoke", files: ["src/hooks/useDocumentExtraction.ts"] },
  { name: "lexos-generate-document", detectedBy: "invoke", files: ["src/features/documents/core/DocumentExportActions.tsx"] },
  { name: "lexos-render-document", detectedBy: "invoke", files: ["src/features/documents/core/DocumentExportActions.tsx"] },
  { name: "create-client-kit", detectedBy: "invoke", files: ["src/features/clients/ClientDocumentKit.tsx", "src/features/clients/ClientFormDialog.tsx"] },
  { name: "nija-full-analysis", detectedBy: "invoke", files: ["src/services/nijaFullAnalysis.ts"] },
  { name: "nija-auto-petition", detectedBy: "invoke", files: ["src/services/nijaAutoPetition.ts"] },
  { name: "nija-generate-petition", detectedBy: "invoke", files: ["src/components/NijaPetitionDraftGenerator.tsx"] },
  { name: "nija-generate-piece", detectedBy: "invoke", files: ["src/components/NijaPetitionDraftGenerator.tsx"] },
  { name: "nija-prescricao", detectedBy: "invoke", files: ["src/components/NijaPrescricaoModal.tsx"] },
  { name: "nija-strategy-compare", detectedBy: "invoke", files: ["src/components/NijaStrategyCompare.tsx"] },
  { name: "knowledge-ai-suggest", detectedBy: "invoke", files: ["src/features/cases/CaseKnowledgePanel.tsx"] },
  { name: "cep-proxy", detectedBy: "invoke", files: ["src/features/clients/ClientFormDialog.tsx"] },
  { name: "createSignedUploadUrl", detectedBy: "invoke", files: ["src/features/clients/ClientFilesCard.tsx"] },
  { name: "createSignedDownloadUrl", detectedBy: "invoke", files: ["src/features/clients/ClientFilesCard.tsx"] },
  { name: "delete-case-hard", detectedBy: "invoke", files: ["src/components/DeleteCaseButton.tsx"] },
  { name: "lexos-nija-timebar", detectedBy: "invoke", files: ["src/components/LexosTimeline.tsx"] },
];

export function generateLexosArchitectureSnapshot(): LexosArchitectureSnapshot {
  const fileInfos: LexosFileInfo[] = Object.keys(fileModules)
    .filter((path) => !path.includes("node_modules") && !path.includes(".DS_Store"))
    .map((path) => {
      const normalized = path.startsWith("./") ? path.replace("./", "src/") : path;
      const ext = normalized.includes(".") ? normalized.split(".").pop() || "" : "";
      const { kind, category } = guessKindAndCategory(path);
      return {
        path: normalized,
        ext,
        kind,
        category,
      };
    });

  const pages = fileInfos
    .filter((f) => f.category === "pages" && f.ext === "tsx")
    .map((f) => getBasename(f.path))
    .sort();

  const components = fileInfos
    .filter(
      (f) =>
        (f.category === "components" || f.category === "ui-components") &&
        f.ext === "tsx"
    )
    .map((f) => getBasename(f.path))
    .sort();

  const contexts = fileInfos
    .filter((f) => f.category === "contexts" && f.ext === "tsx")
    .map((f) => getBasename(f.path))
    .sort();

  const hooks = fileInfos
    .filter((f) => f.category === "hooks")
    .map((f) => getBasename(f.path))
    .sort();

  const libs = fileInfos
    .filter((f) => f.kind === "lib")
    .map((f) => getBasename(f.path))
    .sort();

  const totalStyles = fileInfos.filter((f) => f.kind === "style").length;

  // Use detected edge functions from code analysis
  const edgeFunctions: LexosEdgeFunctionInfo[] = knownEdgeFunctionUsages;

  const snapshot: LexosArchitectureSnapshot = {
    projectName: "LEXOS",
    total: fileInfos.length,
    files: fileInfos,
    routes,
    edgeFunctions,
    contexts,
    hooks,
    pages,
    components,
    libs,
    supabaseTables,
    generatedAt: new Date().toISOString(),
    summary: {
      totalPages: pages.length,
      totalComponents: components.length,
      totalHooks: hooks.length,
      totalLibs: libs.length,
      totalContexts: contexts.length,
      totalEdgeFunctions: edgeFunctions.length,
      totalStyles,
      totalAssets: 0,
      totalConfigs: 0,
    },
  };

  return snapshot;
}
