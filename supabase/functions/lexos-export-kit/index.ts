import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { office_id, snapshot_id } = body;

    if (!office_id || !snapshot_id) {
      return new Response(JSON.stringify({ error: 'office_id and snapshot_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate role
    const { data: roleData } = await adminClient
      .from('office_members')
      .select('role')
      .eq('office_id', office_id)
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['OWNER', 'ADMIN'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Access denied: ADMIN/OWNER required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[lexos-export-kit] Exporting kit for snapshot:', snapshot_id);

    // Get audit snapshot
    const { data: snapshot } = await userClient
      .from('audit_snapshots')
      .select('*')
      .eq('id', snapshot_id)
      .eq('office_id', office_id)
      .single();

    if (!snapshot) {
      return new Response(JSON.stringify({ error: 'Snapshot not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get frontend snapshot if exists
    const frontendSnapshotId = snapshot.meta?.frontend_snapshot_id;
    let frontendSnapshot = null;
    if (frontendSnapshotId) {
      const { data } = await userClient
        .from('frontend_audit_snapshots')
        .select('*')
        .eq('id', frontendSnapshotId)
        .single();
      frontendSnapshot = data;
    }

    // Get latest rebuild job if exists
    const { data: rebuildJob } = await userClient
      .from('rebuild_jobs')
      .select('*')
      .eq('audit_snapshot_id', snapshot_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const dbSnapshot = snapshot.meta?.db_snapshot || {};
    const tables = dbSnapshot.tables || [];
    const policies = dbSnapshot.policies || [];
    const functions = dbSnapshot.functions || [];

    // Generate diagrams markdown
    const diagramsMd = `# Diagramas de Arquitetura

## Tabelas e Relacionamentos

\`\`\`mermaid
erDiagram
${tables.slice(0, 10).map((t: any) => `    ${t.name} {
        uuid id PK
    }`).join('\n')}
\`\`\`

## Fluxo de Políticas RLS

\`\`\`mermaid
flowchart TD
    USER[Usuário] --> AUTH[Autenticação]
    AUTH --> ROLE{Role}
    ROLE -->|OWNER| FULL[Acesso Total]
    ROLE -->|ADMIN| ADMIN_ACCESS[Acesso Admin]
    ROLE -->|MEMBER| LIMITED[Acesso Limitado]
\`\`\`

## Funções do Sistema

Total de funções: ${functions.length}
- SECURITY DEFINER: ${functions.filter((f: any) => f.security_definer).length}
- SECURITY INVOKER: ${functions.filter((f: any) => !f.security_definer).length}
`;

    // Build export kit
    const exportKit = {
      rebuild_plan_md: rebuildJob?.rebuild_plan_md || snapshot.report_md,
      schema_sql: rebuildJob?.schema_sql || '-- No schema generated yet',
      rls_sql: rebuildJob?.rls_sql || '-- No RLS policies generated yet',
      functions_sql: rebuildJob?.functions_sql || '-- No functions generated yet',
      manifests_json: JSON.stringify({
        audit_snapshot: {
          id: snapshot.id,
          created_at: snapshot.created_at,
          status: snapshot.status,
          risk: snapshot.risk,
        },
        frontend_snapshot: frontendSnapshot ? {
          id: frontendSnapshot.id,
          routes: frontendSnapshot.routes,
          menu: frontendSnapshot.menu,
        } : null,
        db_summary: {
          tables: tables.length,
          policies: policies.length,
          functions: functions.length,
        },
      }, null, 2),
      diagrams_md: diagramsMd,
    };

    console.log('[lexos-export-kit] Export complete');

    return new Response(JSON.stringify(exportKit), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[lexos-export-kit] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
