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

    // User client for auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for catalog queries
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    let officeId = body.office_id;

    // If no office_id, get from office_members
    if (!officeId) {
      const { data: memberData } = await adminClient
        .from('office_members')
        .select('office_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!memberData) {
        return new Response(JSON.stringify({ error: 'No office found for user' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      officeId = memberData.office_id;
    }

    // Validate ADMIN/OWNER role
    const { data: roleData } = await adminClient
      .from('office_members')
      .select('role')
      .eq('office_id', officeId)
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['OWNER', 'ADMIN'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Access denied: ADMIN/OWNER required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const frontendManifest = body.frontend_manifest || {};
    const edgeManifest = body.edge_manifest || [];

    console.log('[lexos-governance-run] Running full audit for office:', officeId);

    // Call the RPC to save full snapshot
    const { data: snapshotId, error: rpcError } = await userClient.rpc('lexos_audit_save_full_snapshot', {
      p_office_id: officeId,
      p_frontend_manifest: frontendManifest,
      p_edge_manifest: edgeManifest,
      p_mode: 'FULL',
    });

    if (rpcError) {
      console.error('[lexos-governance-run] RPC error:', rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the created snapshot
    const { data: snapshot } = await userClient
      .from('audit_snapshots')
      .select('id, created_at, status, meta, risk, report_md')
      .eq('id', snapshotId)
      .single();

    console.log('[lexos-governance-run] Audit completed:', snapshotId);

    return new Response(JSON.stringify({
      snapshot_id: snapshotId,
      created_at: snapshot?.created_at,
      risk_summary: snapshot?.risk,
      counts: {
        tables: snapshot?.meta?.db_snapshot?.tables?.length || 0,
        policies: snapshot?.meta?.db_snapshot?.policies?.length || 0,
        functions: snapshot?.meta?.db_snapshot?.functions?.length || 0,
      },
      report_md: snapshot?.report_md,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[lexos-governance-run] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
