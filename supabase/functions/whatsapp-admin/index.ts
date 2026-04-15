import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. Validar Usuário
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { action, instanceId, token, officeId, data } = await req.json()

    // 2. Validar Acesso ao Escritório (Segurança Crítica)
    const { data: profile } = await supabase
      .from('profiles')
      .select('office_id')
      .eq('id', user.id)
      .single()
    
    // Se o usuário não pertence ao officeId solicitado, bloqueia
    if (!profile || profile.office_id !== officeId) {
      return new Response('Forbidden: Office Mismatch', { status: 403, headers: corsHeaders })
    }

    // 3. Roteamento de Ações
    if (action === 'verify') {
      console.log(`[Admin] Testando conexão para ${instanceId}...`)
      const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/me`)
      const result = await response.json()
      
      if (response.ok) {
        return new Response(JSON.stringify({ success: true, data: result }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      } else {
        return new Response(JSON.stringify({ success: false, error: result }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }
    }

    if (action === 'list') {
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('office_id', officeId)

      if (error) throw error

      // MASCARAR TOKEN antes de enviar ao frontend
      const masked = instances.map(i => ({
        ...i,
        instance_token: i.instance_token ? `${i.instance_token.slice(0, 4)}...${i.instance_token.slice(-4)}` : null
      }))

      return new Response(JSON.stringify(masked), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'save') {
      // Se for marcar como primário, desmarcar os outros primeiro
      if (data.is_primary) {
        await supabase
          .from('whatsapp_instances')
          .update({ is_primary: false })
          .eq('office_id', officeId)
      }

      const { data: result, error } = await supabase
        .from('whatsapp_instances')
        .upsert({
          ...data,
          office_id: officeId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify(result), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response('Action Not Found', { status: 404, headers: corsHeaders })

  } catch (err) {
    console.error('[Admin Error]', err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
