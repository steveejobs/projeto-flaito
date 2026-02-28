import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TableInfo {
  schema: string;
  table_name: string;
  has_rls: boolean;
  force_rls: boolean;
}

interface PolicyInfo {
  table_schema: string;
  table_name: string;
  policy_name: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string;
  with_check: string;
}

interface FunctionInfo {
  schema: string;
  name: string;
  identity_arguments: string;
  security_definer: boolean;
  proconfig: string[] | null;
  language: string;
}

interface GrantInfo {
  grantee: string;
  routine_schema: string;
  routine_name: string;
  privilege_type: string;
}

interface ViewInfo {
  schema: string;
  name: string;
}

interface ExtensionInfo {
  name: string;
  schema: string;
  version: string;
}

interface RiskItem {
  level: 'CRÍTICO' | 'ALTO' | 'MÉDIO' | 'BAIXO';
  category: string;
  description: string;
  resource: string;
}

interface AuditMeta {
  tables_count: number;
  policies_count: number;
  functions_count: number;
  views_count: number;
  extensions_count: number;
  generated_at: string;
}

// Sanitize string to remove potential secrets
function sanitize(str: string): string {
  // Remove patterns that look like API keys, tokens, secrets
  return str
    .replace(/(?:key|token|secret|password|apikey|api_key)['":\s]*[=:]["']?[a-zA-Z0-9_\-]{20,}["']?/gi, '[REDACTED]')
    .replace(/sk_[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/pk_[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/eyJ[a-zA-Z0-9_-]{50,}/g, '[REDACTED]');
}

// Execute SQL via REST API with Service Role
async function execSQL<T>(supabaseUrl: string, serviceKey: string, sql: string): Promise<T[]> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_catalog_query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ query_text: sql }),
  });

  if (!response.ok) {
    // Fallback: try direct pg query via PostgREST if RPC doesn't exist
    console.warn('[execSQL] RPC failed, will use alternative method');
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[lexos-audit-snapshot] Starting audit...');

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[lexos-audit-snapshot] No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // User client for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('[lexos-audit-snapshot] Invalid user:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log('[lexos-audit-snapshot] User authenticated:', userId);

    // Admin client for catalog queries
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Get office_id and role
    const { data: memberData, error: memberError } = await adminClient
      .from('office_members')
      .select('office_id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (memberError || !memberData) {
      console.error('[lexos-audit-snapshot] User not member of any office:', memberError?.message);
      return new Response(JSON.stringify({ error: 'User not member of any office' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const officeId = memberData.office_id;
    const userRole = memberData.role;

    console.log('[lexos-audit-snapshot] User office:', officeId, 'role:', userRole);

    // 3. RBAC check - only OWNER/ADMIN
    if (!['OWNER', 'ADMIN'].includes(userRole)) {
      console.error('[lexos-audit-snapshot] Access denied for role:', userRole);
      return new Response(JSON.stringify({ error: 'Access denied. Only OWNER or ADMIN can generate audits.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Collect database metadata using pg_catalog views directly
    console.log('[lexos-audit-snapshot] Collecting database metadata...');

    // 4.1 Tables and RLS - using pg_tables and pg_class
    let tables: TableInfo[] = [];
    
    // Query pg_class directly for RLS info
    const { data: pgClassData } = await adminClient
      .from('pg_catalog.pg_class' as any)
      .select('relname, relrowsecurity, relforcerowsecurity, relnamespace')
      .eq('relkind', 'r');

    const { data: pgNamespaceData } = await adminClient
      .from('pg_catalog.pg_namespace' as any)
      .select('oid, nspname');

    const namespaceMap = new Map<string, string>();
    if (pgNamespaceData) {
      for (const ns of pgNamespaceData) {
        namespaceMap.set(String(ns.oid), ns.nspname);
      }
    }

    const excludedSchemas = [
      'pg_catalog', 'information_schema', 'pg_toast', 'supabase_functions',
      'supabase_migrations', 'auth', 'storage', 'realtime', 'vault',
      'pgsodium', 'pgsodium_masks', 'net', 'extensions', 'graphql', 
      'graphql_public', '_realtime', 'cron', 'pg_cron'
    ];

    if (pgClassData) {
      for (const row of pgClassData) {
        const schema = namespaceMap.get(String(row.relnamespace)) || 'unknown';
        if (!excludedSchemas.includes(schema)) {
          tables.push({
            schema,
            table_name: row.relname,
            has_rls: Boolean(row.relrowsecurity),
            force_rls: Boolean(row.relforcerowsecurity),
          });
        }
      }
    }

    // Fallback if pg_class didn't work
    if (tables.length === 0) {
      console.log('[lexos-audit-snapshot] Using information_schema fallback for tables');
      const { data: infoSchemaData } = await adminClient
        .from('information_schema.tables' as any)
        .select('table_schema, table_name')
        .eq('table_type', 'BASE TABLE');

      if (infoSchemaData) {
        tables = infoSchemaData
          .filter((t: any) => !excludedSchemas.includes(t.table_schema))
          .map((t: any) => ({
            schema: t.table_schema,
            table_name: t.table_name,
            has_rls: false,
            force_rls: false,
          }));
      }
    }

    console.log('[lexos-audit-snapshot] Found tables:', tables.length);

    // 4.2 Policies from pg_policies view
    let policies: PolicyInfo[] = [];
    const { data: policiesData } = await adminClient
      .from('pg_catalog.pg_policies' as any)
      .select('*');

    if (policiesData) {
      policies = policiesData
        .filter((p: any) => !excludedSchemas.includes(p.schemaname || 'public'))
        .map((p: any) => ({
          table_schema: p.schemaname || 'public',
          table_name: p.tablename,
          policy_name: p.policyname,
          permissive: p.permissive || 'PERMISSIVE',
          roles: Array.isArray(p.roles) ? p.roles : [],
          cmd: p.cmd || 'ALL',
          qual: sanitize(p.qual || ''),
          with_check: sanitize(p.with_check || ''),
        }));
    }

    console.log('[lexos-audit-snapshot] Found policies:', policies.length);

    // 4.3 Functions from pg_proc
    const functions: FunctionInfo[] = [];
    
    const { data: pgProcData } = await adminClient
      .from('pg_catalog.pg_proc' as any)
      .select('proname, prosecdef, proconfig, pronamespace, prokind');

    if (pgProcData) {
      for (const proc of pgProcData) {
        const schema = namespaceMap.get(String(proc.pronamespace)) || 'unknown';
        if (schema === 'public' && proc.prokind === 'f') {
          functions.push({
            schema,
            name: proc.proname,
            identity_arguments: '',
            security_definer: Boolean(proc.prosecdef),
            proconfig: proc.proconfig,
            language: 'sql',
          });
        }
      }
    }

    console.log('[lexos-audit-snapshot] Found functions:', functions.length);

    // 4.4 Grants from information_schema.routine_privileges
    let grants: GrantInfo[] = [];
    const { data: grantsData } = await adminClient
      .from('information_schema.routine_privileges' as any)
      .select('grantee, routine_schema, routine_name, privilege_type')
      .eq('routine_schema', 'public')
      .in('grantee', ['PUBLIC', 'anon', 'authenticated']);

    if (grantsData) {
      grants = grantsData.map((g: any) => ({
        grantee: g.grantee,
        routine_schema: g.routine_schema,
        routine_name: g.routine_name,
        privilege_type: g.privilege_type,
      }));
    }

    console.log('[lexos-audit-snapshot] Found grants:', grants.length);

    // 4.5 Views from information_schema.views
    let views: ViewInfo[] = [];
    const { data: viewsData } = await adminClient
      .from('information_schema.views' as any)
      .select('table_schema, table_name')
      .not('table_schema', 'in', `(${excludedSchemas.map(s => `"${s}"`).join(',')})`);

    if (viewsData) {
      views = viewsData
        .filter((v: any) => !excludedSchemas.includes(v.table_schema))
        .map((v: any) => ({
          schema: v.table_schema,
          name: v.table_name,
        }));
    }

    console.log('[lexos-audit-snapshot] Found views:', views.length);

    // 4.6 Extensions from pg_extension
    const extensions: ExtensionInfo[] = [];
    const { data: extData } = await adminClient
      .from('pg_catalog.pg_extension' as any)
      .select('extname, extversion, extnamespace');

    if (extData) {
      for (const ext of extData) {
        const schema = namespaceMap.get(String(ext.extnamespace)) || 'unknown';
        if (schema === 'public') {
          extensions.push({
            name: ext.extname,
            schema,
            version: ext.extversion || 'unknown',
          });
        }
      }
    }

    console.log('[lexos-audit-snapshot] Found extensions in public:', extensions.length);

    // 5. Risk Analysis
    console.log('[lexos-audit-snapshot] Analyzing risks...');
    const risks: RiskItem[] = [];

    const sensitiveTables = [
      'cases', 'clients', 'documents', 'generated_docs', 
      'agenda_items', 'office_members', 'audit_logs', 'audit_snapshots',
      'client_files', 'chat_messages', 'chat_threads'
    ];

    const publicTables = tables.filter(t => t.schema === 'public');

    // Tables without RLS
    for (const table of publicTables) {
      if (!table.has_rls) {
        const isSensitive = sensitiveTables.includes(table.table_name);
        risks.push({
          level: isSensitive ? 'CRÍTICO' : 'ALTO',
          category: 'RLS',
          description: `Tabela ${table.table_name} não tem RLS habilitado`,
          resource: `public.${table.table_name}`,
        });
      }
    }

    // SECURITY DEFINER functions without search_path
    for (const fn of functions) {
      if (fn.security_definer) {
        const hasSearchPath = fn.proconfig?.some((c: string) => 
          c.toLowerCase().includes('search_path')
        );
        
        // Check if has EXECUTE grant for PUBLIC/anon
        const hasPublicGrant = grants.some(g => 
          g.routine_name === fn.name && 
          (g.grantee === 'PUBLIC' || g.grantee === 'anon')
        );

        if (hasPublicGrant) {
          risks.push({
            level: 'CRÍTICO',
            category: 'FUNCTION',
            description: `Função SECURITY DEFINER ${fn.name} tem EXECUTE para PUBLIC/anon`,
            resource: `public.${fn.name}`,
          });
        } else if (!hasSearchPath) {
          risks.push({
            level: 'ALTO',
            category: 'FUNCTION',
            description: `Função ${fn.name} é SECURITY DEFINER mas não tem search_path fixo`,
            resource: `public.${fn.name}`,
          });
        }
      }
    }

    // Grants to PUBLIC/anon
    for (const grant of grants) {
      if (grant.grantee === 'PUBLIC' || grant.grantee === 'anon') {
        const fn = functions.find(f => f.name === grant.routine_name);
        if (!fn?.security_definer) { // Already reported above if SECURITY DEFINER
          risks.push({
            level: 'MÉDIO',
            category: 'GRANT',
            description: `Função ${grant.routine_name} tem EXECUTE para ${grant.grantee}`,
            resource: `public.${grant.routine_name}`,
          });
        }
      }
    }

    // Extensions in public schema
    for (const ext of extensions) {
      risks.push({
        level: 'MÉDIO',
        category: 'EXTENSION',
        description: `Extensão ${ext.name} está instalada no schema public`,
        resource: `public.${ext.name}`,
      });
    }

    // Tables with RLS but no policies
    for (const table of publicTables) {
      if (table.has_rls) {
        const tablePolicies = policies.filter(p => 
          p.table_schema === 'public' && p.table_name === table.table_name
        );
        if (tablePolicies.length === 0) {
          risks.push({
            level: 'CRÍTICO',
            category: 'RLS',
            description: `Tabela ${table.table_name} tem RLS habilitado mas nenhuma policy definida`,
            resource: `public.${table.table_name}`,
          });
        }
      }
    }

    // 6. Generate Markdown Report
    console.log('[lexos-audit-snapshot] Generating report...');
    const now = new Date().toISOString();
    
    const riskSummary = {
      CRÍTICO: risks.filter(r => r.level === 'CRÍTICO').length,
      ALTO: risks.filter(r => r.level === 'ALTO').length,
      MÉDIO: risks.filter(r => r.level === 'MÉDIO').length,
      BAIXO: risks.filter(r => r.level === 'BAIXO').length,
    };

    let reportMd = `# Auditoria Técnica Lexos\n\n`;
    reportMd += `**Gerado em:** ${now}\n`;
    reportMd += `**Office ID:** ${officeId}\n`;
    reportMd += `**Gerado por:** ${userId}\n\n`;
    reportMd += `---\n\n`;

    // BLOCO 1/7 - Inventário
    reportMd += `## [BLOCO 1/7] INVENTÁRIO DO BANCO DE DADOS\n\n`;
    reportMd += `### Resumo\n`;
    reportMd += `- **Tabelas no schema public:** ${publicTables.length}\n`;
    reportMd += `- **Views:** ${views.length}\n`;
    reportMd += `- **Functions:** ${functions.length}\n`;
    reportMd += `- **Extensions (public):** ${extensions.length}\n\n`;
    
    reportMd += `### Tabelas (public)\n\n`;
    reportMd += `| Tabela | RLS Habilitado | Force RLS |\n`;
    reportMd += `|--------|----------------|----------|\n`;
    for (const t of publicTables.slice(0, 60)) {
      reportMd += `| ${t.table_name} | ${t.has_rls ? '✅' : '❌'} | ${t.force_rls ? '✅' : '❌'} |\n`;
    }
    if (publicTables.length > 60) {
      reportMd += `\n*...e mais ${publicTables.length - 60} tabelas*\n`;
    }
    reportMd += `\n`;

    // BLOCO 2/7 - RLS & Policies
    reportMd += `## [BLOCO 2/7] RLS & POLICIES\n\n`;
    reportMd += `### Policies por Tabela\n\n`;
    
    const policyGroups: Record<string, PolicyInfo[]> = {};
    for (const p of policies) {
      const key = `${p.table_schema}.${p.table_name}`;
      if (!policyGroups[key]) policyGroups[key] = [];
      policyGroups[key].push(p);
    }
    
    for (const [table, tablePolicies] of Object.entries(policyGroups).slice(0, 40)) {
      reportMd += `#### ${table}\n\n`;
      for (const p of tablePolicies) {
        reportMd += `- **${p.policy_name}** (${p.cmd}): ${p.permissive}\n`;
      }
      reportMd += `\n`;
    }
    if (Object.keys(policyGroups).length > 40) {
      reportMd += `*...e mais ${Object.keys(policyGroups).length - 40} tabelas com policies*\n\n`;
    }

    // BLOCO 3/7 - Functions & Grants
    reportMd += `## [BLOCO 3/7] FUNCTIONS & GRANTS\n\n`;
    reportMd += `### Functions no schema public\n\n`;
    reportMd += `| Função | Security Definer | Search Path Fixo |\n`;
    reportMd += `|--------|------------------|------------------|\n`;
    for (const fn of functions.slice(0, 50)) {
      const hasSearchPath = fn.proconfig?.some((c: string) => c.toLowerCase().includes('search_path'));
      reportMd += `| ${fn.name} | ${fn.security_definer ? '⚠️ SIM' : 'NÃO'} | ${hasSearchPath ? '✅' : '❌'} |\n`;
    }
    if (functions.length > 50) {
      reportMd += `\n*...e mais ${functions.length - 50} funções*\n`;
    }
    reportMd += `\n`;

    reportMd += `### Grants EXECUTE\n\n`;
    if (grants.length > 0) {
      reportMd += `| Função | Grantee | Privilégio |\n`;
      reportMd += `|--------|---------|------------|\n`;
      for (const g of grants.slice(0, 40)) {
        reportMd += `| ${g.routine_name} | ${g.grantee} | ${g.privilege_type} |\n`;
      }
      if (grants.length > 40) {
        reportMd += `\n*...e mais ${grants.length - 40} grants*\n`;
      }
    } else {
      reportMd += `*Nenhum grant especial detectado para PUBLIC/anon/authenticated*\n`;
    }
    reportMd += `\n`;

    // BLOCO 4/7 - Views
    reportMd += `## [BLOCO 4/7] VIEWS\n\n`;
    if (views.length > 0) {
      reportMd += `| View | Schema |\n`;
      reportMd += `|------|--------|\n`;
      for (const v of views.slice(0, 40)) {
        reportMd += `| ${v.name} | ${v.schema} |\n`;
      }
      if (views.length > 40) {
        reportMd += `\n*...e mais ${views.length - 40} views*\n`;
      }
    } else {
      reportMd += `*Nenhuma view no schema public*\n`;
    }
    reportMd += `\n`;

    // BLOCO 5/7 - Extensions
    reportMd += `## [BLOCO 5/7] EXTENSÕES\n\n`;
    if (extensions.length > 0) {
      reportMd += `| Extensão | Schema | Versão |\n`;
      reportMd += `|----------|--------|--------|\n`;
      for (const e of extensions) {
        reportMd += `| ${e.name} | ${e.schema} | ${e.version} |\n`;
      }
    } else {
      reportMd += `*Nenhuma extensão no schema public*\n`;
    }
    reportMd += `\n`;

    // BLOCO 6/7 - RBAC
    reportMd += `## [BLOCO 6/7] RBAC & TENANCY\n\n`;
    reportMd += `### Estrutura de Multi-Tenancy\n\n`;
    reportMd += `- **office_members:** Controle de acesso por escritório\n`;
    reportMd += `- **Roles disponíveis:** OWNER, ADMIN, MEMBER\n`;
    reportMd += `- **Isolamento:** office_id em tabelas principais\n\n`;

    const rbacTables = publicTables.filter(t => 
      ['office_members', 'case_permissions', 'offices'].includes(t.table_name)
    );
    if (rbacTables.length > 0) {
      reportMd += `### Tabelas de RBAC detectadas\n\n`;
      for (const t of rbacTables) {
        reportMd += `- **${t.table_name}:** RLS ${t.has_rls ? 'habilitado ✅' : 'desabilitado ❌'}\n`;
      }
    }
    reportMd += `\n`;

    // BLOCO 7/7 - Relatório de Riscos
    reportMd += `## [BLOCO 7/7] RELATÓRIO AUTOMÁTICO DE RISCO\n\n`;
    reportMd += `### Resumo\n\n`;
    reportMd += `| Nível | Quantidade |\n`;
    reportMd += `|-------|------------|\n`;
    reportMd += `| 🔴 CRÍTICO | ${riskSummary.CRÍTICO} |\n`;
    reportMd += `| 🟠 ALTO | ${riskSummary.ALTO} |\n`;
    reportMd += `| 🟡 MÉDIO | ${riskSummary.MÉDIO} |\n`;
    reportMd += `| 🟢 BAIXO | ${riskSummary.BAIXO} |\n`;
    reportMd += `\n`;

    if (risks.length > 0) {
      reportMd += `### Detalhamento\n\n`;
      
      const risksByLevel = {
        'CRÍTICO': risks.filter(r => r.level === 'CRÍTICO'),
        'ALTO': risks.filter(r => r.level === 'ALTO'),
        'MÉDIO': risks.filter(r => r.level === 'MÉDIO'),
        'BAIXO': risks.filter(r => r.level === 'BAIXO'),
      };

      for (const [level, levelRisks] of Object.entries(risksByLevel)) {
        if (levelRisks.length === 0) continue;
        const emoji = level === 'CRÍTICO' ? '🔴' : level === 'ALTO' ? '🟠' : level === 'MÉDIO' ? '🟡' : '🟢';
        reportMd += `#### ${emoji} ${level}\n\n`;
        for (const r of levelRisks.slice(0, 25)) {
          reportMd += `- **[${r.category}]** ${r.description}\n`;
          reportMd += `  - Recurso: \`${r.resource}\`\n`;
        }
        if (levelRisks.length > 25) {
          reportMd += `\n*...e mais ${levelRisks.length - 25} itens*\n`;
        }
        reportMd += `\n`;
      }
    } else {
      reportMd += `✅ **Nenhum risco detectado!**\n`;
    }

    reportMd += `\n---\n`;
    reportMd += `*Relatório gerado automaticamente pela Edge Function lexos-audit-snapshot*\n`;

    // 7. Calculate hash
    const encoder = new TextEncoder();
    const data = encoder.encode(reportMd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 8. Persist snapshot
    console.log('[lexos-audit-snapshot] Persisting snapshot...');
    
    const meta: AuditMeta = {
      tables_count: publicTables.length,
      policies_count: policies.length,
      functions_count: functions.length,
      views_count: views.length,
      extensions_count: extensions.length,
      generated_at: now,
    };

    const { data: snapshot, error: insertError } = await adminClient
      .from('audit_snapshots')
      .insert({
        office_id: officeId,
        created_by: userId,
        status: 'DONE',
        report_md: reportMd,
        meta,
        risk: riskSummary,
        source: 'edge',
        hash,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('[lexos-audit-snapshot] Insert error:', insertError.message);
      return new Response(JSON.stringify({ 
        error: 'Failed to save snapshot', 
        details: insertError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[lexos-audit-snapshot] Snapshot saved:', snapshot.id);
    console.log('[lexos-audit-snapshot] Stats - Tables:', publicTables.length, 'Policies:', policies.length, 'Functions:', functions.length);

    // 9. Return result
    return new Response(JSON.stringify({
      snapshot_id: snapshot.id,
      created_at: snapshot.created_at,
      risk_summary: riskSummary,
      counts: meta,
      report_md: reportMd,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[lexos-audit-snapshot] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
