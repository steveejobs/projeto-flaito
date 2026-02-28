import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { documentId, fileName } = await req.json()
    if (!documentId || !fileName) {
      return new Response(JSON.stringify({ error: 'documentId and fileName are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify generated_doc exists and user has access (document belongs to user's office)
    const { data: doc, error: docError } = await supabase
      .from('generated_docs')
      .select('id, office_id')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      console.error('Document not found:', docError)
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user belongs to the same office
    const { data: member, error: memberError } = await supabase
      .from('office_members')
      .select('id')
      .eq('office_id', doc.office_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (memberError || !member) {
      console.error('User not in office:', memberError)
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const bucket = 'case-documents'
    // SECURITY: Path MUST start with office/<officeId>/ for RLS policy enforcement
    const filePath = `office/${doc.office_id}/${documentId}/${fileName}`

    // Create signed upload URL (valid for 5 minutes)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath)

    if (signedError) {
      console.error('Failed to create signed URL:', signedError)
      return new Response(JSON.stringify({ error: 'Failed to create upload URL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Signed upload URL created for document:', documentId)

    return new Response(JSON.stringify({ signedUrl: signedData.signedUrl, path: filePath }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
