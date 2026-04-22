// supabase/functions/create-signature-links/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  document_id: string;
  office_id: string;
  methods: string[]; // ['CLIENT', 'LAWYER']
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { document_id, office_id, methods } = await req.json() as RequestBody;
    const adminClient = getSupabaseAdmin();

    // 1. Gerar um token único
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    
    // 2. Definir expiração (ex: 7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 3. Buscar dados do documento/cliente para o link
    const { data: doc } = await adminClient
      .from("documents")
      .select("client_id")
      .eq("id", document_id)
      .single();

    // 4. Criar o registro no banco
    const { data: link, error } = await adminClient
      .from("signature_links")
      .insert({
        token,
        office_id,
        client_id: doc?.client_id,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
        metadata: { document_id, methods }
      })
      .select()
      .single();

    if (error) throw error;

    // 5. Retornar a URL (ajustar base_url conforme ambiente)
    // Em produção usaríamos o domínio real, aqui pegamos do env se existir
    const baseUrl = Deno.env.get("FRONTEND_URL") || "https://projeto-flaito.lovable.app";
    const url = `${baseUrl}/assinatura/${token}`;

    return new Response(JSON.stringify({ url, token: link.token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
