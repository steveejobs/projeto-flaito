import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAgentConfig } from "../_shared/agent-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { client_id, agent_slug, input, use_context } = await req.json();

    if (!client_id || !agent_slug || !input) {
      throw new Error("Parâmetros ausentes: client_id, agent_slug e input são obrigatórios.");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get Client Data
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, full_name, email, phone, notes, office_id")
      .eq("id", client_id)
      .single();

    if (clientErr || !client) {
      throw new Error("Cliente não encontrado ou erro ao buscar dados.");
    }

    // 2. Resolve Agent Config (OFFICE > GLOBAL)
    const resolved = await getAgentConfig(supabase, agent_slug, {
      office_id: client.office_id
    });

    if (!resolved) {
      throw new Error(`Configuração não encontrada para o agente: ${agent_slug}`);
    }

    if (!resolved.is_active || resolved.resolution.is_blocked) {
      throw new Error(`O agente ${agent_slug} está desativado para este escritório.`);
    }

    // 3. Build Context (Hierarquia: System -> Extra -> Client -> Context)
    
    // 3a. Client Data
    const clientContext = `
DADOS DO CLIENTE PARA CONTEXTO:
- Nome: ${client.full_name}
- Email: ${client.email || 'Não informado'}
- Telefone: ${client.phone || 'Não informado'}
- Notas/Observações: ${client.notes || 'Nenhuma nota registrada'}
    `.trim();

    // 3b. Recent History Context (Optional)
    let recentHistoryContext = "";
    if (use_context) {
      const { data: history, error: histErr } = await supabase
        .from("agent_executions")
        .select("input, output, created_at")
        .eq("client_id", client_id)
        .eq("office_id", client.office_id)
        .order("created_at", { ascending: false })
        .limit(3);

      if (!histErr && history && history.length > 0) {
        // Ordenar cronologicamente (antigo -> novo) conforme solicitado
        const sortedHistory = [...history].reverse();
        
        const historyLines = sortedHistory.map((item, index) => {
          const truncatedInput = item.input.length > 500 ? item.input.substring(0, 500) + "..." : item.input;
          const truncatedOutput = item.output.length > 500 ? item.output.substring(0, 500) + "..." : item.output;
          
          return `${index + 1}. Usuário: ${truncatedInput}\n   Resposta: ${truncatedOutput}`;
        });

        recentHistoryContext = `
---
CONTEXTO RECENTE DESTE CLIENTE (Últimas interações):
${historyLines.join('\n\n')}
---
        `.trim();
      }
    }

    // 3c. Assemble Final System Prompt
    const promptParts = [
      resolved.system_prompt,
      resolved.extra_instructions,
      clientContext,
      recentHistoryContext
    ].filter(p => p && p.trim() !== "");

    const systemPrompt = promptParts.join("\n\n");

    // 4. Call LLM (Lovable AI Gateway)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolved.model,
        temperature: resolved.temperature,
        max_tokens: resolved.max_tokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input }
        ]
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error(`[EXECUTE-AGENT] LLM Error: ${aiResponse.status}`, errBody);
      throw new Error(`Erro na chamada da IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Sem resposta do agente.";

    // 5. Persist Log (Tratamento obrigatório conforme Etapa 7)
    // A execução só é considerada sucesso se a persistência também concluir.
    const { error: logError } = await supabase
      .from("agent_executions")
      .insert({
        client_id,
        office_id: client.office_id,
        agent_slug,
        input,
        output: content,
        model: resolved.model,
        config_source: resolved.resolution.source_level,
        config_version: resolved.resolution.version
      });

    if (logError) {
      console.error("[EXECUTE-AGENT] History Persistence Error:", logError);
      throw new Error("Falha ao registrar histórico de execução. Operação abortada para integridade.");
    }

    return new Response(JSON.stringify({ 
      content,
      _audit: {
        config_id: resolved.resolution.config_id,
        version: resolved.resolution.version,
        source: resolved.resolution.source_level,
        model: resolved.model
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[EXECUTE-AGENT] Fatal Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
