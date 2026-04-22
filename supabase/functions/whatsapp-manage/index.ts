import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREATE_INSTANCE_URL = "https://grlwciflaotripbumhve.supabase.co/functions/v1/create-instance-url";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const WHATSAPI_TOKEN = Deno.env.get("WhatsApi_API_TOKEN") || "okkrnvHHUdwz6TwKiNIOG28h82dc4ZKEcyxD"; // Fallback to provided token

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "");

    // Validar JWT e extrair userId
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: corsHeaders });
    }

    const tokenJwt = authHeader.replace("Bearer ", "");
    // Usar getUser no lugar de getClaims, porque getUser é o suportado pelo supabase-js para checar autenticidade no edge
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(tokenJwt);
    
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }
    
    const userId = claimsData.user.id;

    const body = await req.json();
    const action = body.action;
    let officeId = body.office_id;

    if (!officeId) {
      // Descobrir o officeId do usuário atual se não veio no body
      const { data: profile } = await adminClient
        .from("office_members")
        .select("office_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      officeId = profile?.office_id;
    }

    if (!officeId) {
      return new Response(JSON.stringify({ error: "Office not found for user" }), { status: 403, headers: corsHeaders });
    }

    if (action === "get-or-create") {
      const { data: existing } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("office_id", officeId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ instance: existing, is_new: false }), { headers: corsHeaders });
      }

      // Criar nova instância na uazapi
      const instanceName = `whatsapi-${officeId.substring(0, 8)}`;
      const deviceName = "Flaito CRM";

      const createPayload = {
        token: WHATSAPI_TOKEN,
        name: instanceName,
        deviceName: deviceName
      };

      console.log(`[WhatsApp] Usando Token (Início): ${WHATSAPI_TOKEN.substring(0, 5)}...`);
      console.log(`[WhatsApp] Chamando API de criação: ${CREATE_INSTANCE_URL}`);
      
      const createRes = await fetch(CREATE_INSTANCE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });

      const responseText = await createRes.text();
      console.log(`[WhatsApp] Resposta da API (${createRes.status}):`, responseText);

      if (!createRes.ok) {
        throw new Error(`Falha ao criar instância: ${createRes.status} - ${responseText}`);
      }

      const apiData = JSON.parse(responseText);
      const serverUrl = apiData.server_url;
      const instanceToken = apiData["Instance Token"];
      const generalToken = apiData.token;
      const returnedInstanceName = apiData.instance?.name || instanceName;

      if (!serverUrl || !instanceToken) {
        throw new Error("API retornou dados incompletos (server_url ou instance_token ausentes)");
      }

      // Registrar webhook automaticamente
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?office_id=${officeId}`;
      
      try {
        await fetch(`${serverUrl}/webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instanceToken,
          },
          body: JSON.stringify({
            url: webhookUrl,
            enabled: true,
            active: true,
            byApi: true,
            addUrlEvents: true,
            addUrlTypesMessages: true,
            excludeMessages: ["wasSentByApi", "isGroupYes"],
            events: [
              "connection", "messages", "messages_update", "presence",
              "call", "contacts", "groups", "labels", "chats",
              "chat_labels", "blocks", "leads", "history", "sender",
            ],
          }),
        });
      } catch (webhookErr) {
        console.error("Erro ao registrar webhook:", webhookErr);
      }

      // Salvar no banco
      const { data: newInstance, error: insertError } = await adminClient
        .from("whatsapp_instances")
        .insert({
          user_id: userId,
          office_id: officeId,
          instance_name: returnedInstanceName,
          device_name: deviceName,
          server_url: serverUrl,
          instance_token: instanceToken,
          token: generalToken,
          webhook_url: webhookUrl,
          status: "created",
          is_connected: false
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ instance: newInstance, is_new: true }), { headers: corsHeaders });
    }

    if (action === "qrcode") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("server_url, instance_token")
        .eq("office_id", officeId)
        .maybeSingle();

      if (!inst) {
        return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404, headers: corsHeaders });
      }

      const qrRes = await fetch(`${inst.server_url}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": inst.instance_token,
        },
        body: "{}",
      });

      const qrJson = await qrRes.json();
      const connected = qrJson?.connected === true || qrJson?.instance?.status === "connected";

      if (connected) {
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connected", is_connected: true })
          .eq("office_id", officeId);
        
        return new Response(JSON.stringify({ connected: true }), { headers: corsHeaders });
      }

      const qrcode = qrJson?.instance?.qrcode || qrJson?.qrcode || "";
      return new Response(JSON.stringify({ qrcode, connected: false }), { headers: corsHeaders });
    }

    if (action === "disconnect") {
      await adminClient
        .from("whatsapp_instances")
        .update({ status: "disconnected", is_connected: false })
        .eq("office_id", officeId);

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === "delete") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("server_url, instance_token")
        .eq("office_id", officeId)
        .maybeSingle();

      if (inst) {
        try {
          await fetch(`${inst.server_url}/instance`, {
            method: "DELETE",
            headers: { "token": inst.instance_token },
          });
        } catch (e) {
          console.error("uazapi delete failed (continuing):", e);
        }
      }

      await adminClient
        .from("whatsapp_instances")
        .delete()
        .eq("office_id", officeId);

      return new Response(JSON.stringify({ deleted: true }), { headers: corsHeaders });
    }

    if (action === "save") {
      const { data: result, error: saveError } = await adminClient
        .from("whatsapp_instances")
        .upsert({
          ...body.data,
          office_id: officeId,
          user_id: userId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (saveError) throw saveError;
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error("Error in whatsapp-manage:", error.message);
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error",
      details: error.stack
    }), { 
      status: 200, // Retornar 200 para que o frontend consiga ler o body do erro sem cair no catch do invoke
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
