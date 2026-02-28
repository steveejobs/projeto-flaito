import { LexosArchitectureSnapshot } from "@/lexosArchitectureSnapshot";

export type AuditSeverity = "CRITICO" | "ALTO" | "MEDIO" | "BAIXO";

export type AuditFinding = {
  id: string;
  severity: AuditSeverity;
  title: string;
  description: string;
  resource?: string;
  autoFixable?: boolean;
  recommendation?: string;
  detectedFunctions?: string[];
};

export type AuditReport = {
  generatedAt: string;
  findings: AuditFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
};

// Rotas que podem ser públicas sem risco
const ALLOWED_PUBLIC_ROUTES = ["/", "/login", "/signup"];

// Tabelas potencialmente duplicadas com recomendações
const DUPLICATE_TABLE_PAIRS: { tables: [string, string]; canonical: string; recommendation: string }[] = [
  {
    tables: ["audit_log", "audit_logs"],
    canonical: "audit_logs",
    recommendation: "Escolher 'audit_logs' como tabela canônica e criar VIEW 'audit_log' para compatibilidade temporária. Migrar referências gradualmente.",
  },
  {
    tables: ["generated_docs", "generated_documents"],
    canonical: "generated_documents",
    recommendation: "Escolher 'generated_documents' como tabela canônica e criar VIEW 'generated_docs' para compatibilidade temporária. Migrar referências gradualmente.",
  },
];

// Padrões críticos que indicam chamadas diretas a APIs de IA no frontend
const AI_DIRECT_PATTERNS = [
  { pattern: /openai\.com/gi, name: "OpenAI API direta" },
  { pattern: /anthropic\.com/gi, name: "Anthropic API direta" },
  { pattern: /api\.groq\.com/gi, name: "Groq API direta" },
  { pattern: /generativelanguage\.googleapis\.com/gi, name: "Gemini API direta" },
];

export type AIEdgeUsage = {
  file: string;
  pattern: string;
  severity: AuditSeverity;
  snippet?: string;
};

// Função para escanear uso direto de APIs de IA no código (apenas padrões críticos)
export function scanAIEdgeUsage(
  files: string[],
  fileContents: Map<string, string>
): AIEdgeUsage[] {
  const usages: AIEdgeUsage[] = [];

  for (const file of files) {
    const content = fileContents.get(file);
    if (!content) continue;

    // Verificar apenas padrões críticos (chamadas diretas a APIs externas)
    for (const { pattern, name } of AI_DIRECT_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        usages.push({
          file,
          pattern: name,
          severity: "CRITICO",
          snippet: matches[0],
        });
      }
    }
  }

  return usages;
}

export function runSystemAudit(
  snapshot: LexosArchitectureSnapshot,
  aiEdgeUsages?: AIEdgeUsage[]
): AuditReport {
  const findings: AuditFinding[] = [];
  let findingId = 1;

  // 1. Verificar rotas públicas que não deveriam ser públicas
  snapshot.routes.forEach((route) => {
    if (!route.protected && !ALLOWED_PUBLIC_ROUTES.includes(route.path)) {
      if (route.path === "/nija") {
        findings.push({
          id: `AUDIT-${findingId++}`,
          severity: "CRITICO",
          title: "Rota /nija está pública",
          description:
            "A página NIJA permite análise de documentos jurídicos e deveria ser protegida por autenticação.",
          resource: route.path,
          autoFixable: true,
        });
      } else if (route.path.includes("/documents/print")) {
        findings.push({
          id: `AUDIT-${findingId++}`,
          severity: "CRITICO",
          title: "Rota de impressão de documentos está pública",
          description:
            "A rota /documents/print/:id permite acesso a documentos sem autenticação, expondo dados sensíveis.",
          resource: route.path,
          autoFixable: true,
        });
      } else {
        findings.push({
          id: `AUDIT-${findingId++}`,
          severity: "CRITICO",
          title: `Rota ${route.path} está pública`,
          description: `A rota ${route.path} está configurada como pública mas não está na lista de rotas permitidas sem autenticação.`,
          resource: route.path,
          autoFixable: false,
        });
      }
    }
  });

  // 2. Verificar páginas sem rotas
  const routeComponents = new Set(snapshot.routes.map((r) => r.component));
  snapshot.pages.forEach((page) => {
    const ignoredPages = ["NotFound", "Index"];
    if (!routeComponents.has(page) && !ignoredPages.includes(page)) {
      findings.push({
        id: `AUDIT-${findingId++}`,
        severity: "ALTO",
        title: `Página ${page} sem rota definida`,
        description: `A página ${page} existe no projeto mas não tem rota configurada. Pode ser código morto ou erro de configuração.`,
        resource: `src/pages/${page}.tsx`,
      });
    }
  });

  // 3. Verificar rotas apontando para páginas inexistentes
  snapshot.routes.forEach((route) => {
    if (!snapshot.pages.includes(route.component)) {
      findings.push({
        id: `AUDIT-${findingId++}`,
        severity: "ALTO",
        title: `Rota ${route.path} aponta para página inexistente`,
        description: `A rota ${route.path} está configurada para o componente ${route.component} que não existe em src/pages/.`,
        resource: route.path,
      });
    }
  });

  // 4. Verificar Edge Functions - mapeamento por uso no código
  if (snapshot.edgeFunctions.length > 0) {
    const functionNames = snapshot.edgeFunctions.map((f) => f.name);
    const filesUsing = [...new Set(snapshot.edgeFunctions.flatMap((f) => f.files))];
    
    findings.push({
      id: `AUDIT-${findingId++}`,
      severity: "BAIXO",
      title: "Edge Functions detectadas e mapeadas por uso",
      description: `O scanner mapeia ${snapshot.edgeFunctions.length} funções por análise de uso no código (invoke/URL). Todas as chamadas passam pelo Supabase Edge Functions.`,
      resource: filesUsing.slice(0, 5).join(", ") + (filesUsing.length > 5 ? ` (+${filesUsing.length - 5} arquivos)` : ""),
      detectedFunctions: functionNames,
    });
  }

  // 5. Verificar chamadas diretas a APIs de IA (CRÍTICO)
  if (aiEdgeUsages && aiEdgeUsages.length > 0) {
    const criticalUsages = aiEdgeUsages.filter((u) => u.severity === "CRITICO");
    
    if (criticalUsages.length > 0) {
      const filesWithCritical = [...new Set(criticalUsages.map((u) => u.file))];
      findings.push({
        id: `AUDIT-${findingId++}`,
        severity: "CRITICO",
        title: "Chamadas diretas a APIs de IA detectadas no frontend",
        description: `Encontradas ${criticalUsages.length} chamadas diretas a APIs de IA (OpenAI, Anthropic, Groq, Gemini) no código frontend. Isso expõe chaves de API.`,
        resource: filesWithCritical.join(", "),
        recommendation: "Mover todas as chamadas de IA para Edge Functions do Supabase para proteger as chaves de API.",
      });
    }
  }

  // 6. Verificar tabelas potencialmente duplicadas
  DUPLICATE_TABLE_PAIRS.forEach(({ tables: [table1, table2], recommendation }) => {
    const hasTable1 = snapshot.supabaseTables.includes(table1);
    const hasTable2 = snapshot.supabaseTables.includes(table2);

    if (hasTable1 && hasTable2) {
      findings.push({
        id: `AUDIT-${findingId++}`,
        severity: "MEDIO",
        title: `Possível duplicação de tabelas: ${table1} e ${table2}`,
        description: `Ambas as tabelas ${table1} e ${table2} existem no banco. Isso pode indicar migração incompleta ou dados duplicados.`,
        resource: `${table1}, ${table2}`,
        recommendation: recommendation,
      });
    }
  });

  // 7. Verificar se há muitas páginas públicas
  const publicRoutes = snapshot.routes.filter(
    (r) => !r.protected && !ALLOWED_PUBLIC_ROUTES.includes(r.path)
  );
  if (publicRoutes.length > 3) {
    findings.push({
      id: `AUDIT-${findingId++}`,
      severity: "MEDIO",
      title: `${publicRoutes.length} rotas públicas além das permitidas`,
      description: `Existem ${publicRoutes.length} rotas configuradas como públicas além de /, /login, /signup. Revise se todas devem ser acessíveis sem login.`,
      resource: publicRoutes.map((r) => r.path).join(", "),
    });
  }

  // Calcular sumário
  const summary = {
    critical: findings.filter((f) => f.severity === "CRITICO").length,
    high: findings.filter((f) => f.severity === "ALTO").length,
    medium: findings.filter((f) => f.severity === "MEDIO").length,
    low: findings.filter((f) => f.severity === "BAIXO").length,
    total: findings.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    findings,
    summary,
  };
}

export function getSeverityColor(severity: AuditSeverity): string {
  switch (severity) {
    case "CRITICO":
      return "bg-red-500/10 text-red-600 border-red-500/30";
    case "ALTO":
      return "bg-orange-500/10 text-orange-600 border-orange-500/30";
    case "MEDIO":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    case "BAIXO":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30";
  }
}

export function getSeverityIcon(severity: AuditSeverity): string {
  switch (severity) {
    case "CRITICO":
      return "🔴";
    case "ALTO":
      return "🟠";
    case "MEDIO":
      return "🟡";
    case "BAIXO":
      return "🔵";
  }
}
