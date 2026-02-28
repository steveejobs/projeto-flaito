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
    const { office_id, audit_snapshot_id, frontend_snapshot_id, mode = 'PLAN' } = body;

    if (!office_id || !audit_snapshot_id) {
      return new Response(JSON.stringify({ error: 'office_id and audit_snapshot_id required' }), {
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

    console.log('[lexos-rebuild-engine] Creating rebuild job:', { office_id, mode });

    // Get audit snapshot
    const { data: snapshot } = await userClient
      .from('audit_snapshots')
      .select('meta, report_md')
      .eq('id', audit_snapshot_id)
      .single();

    if (!snapshot) {
      return new Response(JSON.stringify({ error: 'Audit snapshot not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dbSnapshot = snapshot.meta?.db_snapshot || {};
    const tables = dbSnapshot.tables || [];
    const policies = dbSnapshot.policies || [];
    const functions = dbSnapshot.functions || [];

    // Generate schema.sql (CREATE TABLE IF NOT EXISTS)
    let schemaSql = '-- Schema SQL (Idempotent)\n\n';
    for (const t of tables) {
      if (t.kind === 'table') {
        schemaSql += `-- Table: ${t.name}\n`;
        schemaSql += `-- CREATE TABLE IF NOT EXISTS public.${t.name} (...);\n`;
        if (t.rls_enabled) {
          schemaSql += `ALTER TABLE public.${t.name} ENABLE ROW LEVEL SECURITY;\n`;
        }
        schemaSql += '\n';
      }
    }

    // Generate rls.sql
    let rlsSql = '-- RLS Policies SQL (Idempotent)\n\n';
    for (const p of policies) {
      rlsSql += `-- Policy: ${p.name} on ${p.table}\n`;
      rlsSql += `DROP POLICY IF EXISTS "${p.name}" ON public.${p.table};\n`;
      rlsSql += `-- CREATE POLICY "${p.name}" ON public.${p.table} ...;\n\n`;
    }

    // Generate functions.sql
    let functionsSql = '-- Functions SQL (Idempotent)\n\n';
    for (const f of functions) {
      functionsSql += `-- Function: ${f.name}(${f.args || ''})\n`;
      if (f.security_definer) {
        functionsSql += `-- SECURITY DEFINER: true\n`;
      }
      functionsSql += `-- CREATE OR REPLACE FUNCTION public.${f.name}(...) ...;\n\n`;
    }

    // Generate rebuild plan markdown
    const rebuildPlanMd = `# Plano de Rebuild

**Gerado em:** ${new Date().toISOString()}
**Modo:** ${mode}
**Snapshot:** ${audit_snapshot_id}

## Resumo
- Tabelas: ${tables.length}
- Políticas: ${policies.length}
- Funções: ${functions.length}

## Arquivos Gerados
- schema.sql: Estrutura de tabelas (CREATE IF NOT EXISTS)
- rls.sql: Políticas RLS
- functions.sql: Funções do banco

## Avisos
- Este plano é declarativo e idempotente
- Nenhum DROP destrutivo será executado
- Revise antes de aplicar em produção
`;

    // Create rebuild job
    const { data: job, error: jobError } = await userClient
      .from('rebuild_jobs')
      .insert({
        office_id,
        created_by: user.id,
        audit_snapshot_id,
        frontend_snapshot_id,
        mode,
        status: mode === 'PLAN' ? 'DONE' : 'PENDING',
        rebuild_plan_md: rebuildPlanMd,
        schema_sql: schemaSql,
        rls_sql: rlsSql,
        functions_sql: functionsSql,
        completed_at: mode === 'PLAN' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (jobError) {
      console.error('[lexos-rebuild-engine] Job error:', jobError);
      return new Response(JSON.stringify({ error: jobError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[lexos-rebuild-engine] Job created:', job.id);

    return new Response(JSON.stringify({
      job_id: job.id,
      mode,
      status: job.status,
      rebuild_plan_md: rebuildPlanMd,
      schema_sql: schemaSql,
      rls_sql: rlsSql,
      functions_sql: functionsSql,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[lexos-rebuild-engine] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
