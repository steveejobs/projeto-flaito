// supabase/functions/escavador-api/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { EscavadorClient, normalizeCNJ } from "../_shared/escavador-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  console.log(`[escavador-api] [${correlationId}] Starting request: ${req.method}`);

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Auth & Context
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Get office_id
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("office_id")
      .eq("id", user.id)
      .single();

    if (!profile?.office_id) {
      throw new Error("User has no associated office.");
    }

    const { action, payload } = await req.json();

    // 2. Rate Limiting
    const limitCheck = await supabaseClient.rpc("check_and_increment_rate_limit", {
        p_scope_type: "office",
        p_scope_id: profile.office_id,
        p_action: "escavador_search",
        p_limit_per_window: 50,
        p_window_minutes: 1
    });

    if (limitCheck.data && !limitCheck.data.allowed) {
        return new Response(JSON.stringify({ error: "RATE_LIMIT_EXCEEDED", message: "Limite do escritório atingido." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    const client = new EscavadorClient();

    // 3. Routing
    switch (action) {
      case "search_processo": {
        const { numero } = payload;
        const { normalized, isValid } = normalizeCNJ(numero);
        
        if (!isValid) {
          return new Response(JSON.stringify({ error: "INVALID_CNJ", message: "Número CNJ inválido." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Check Cache (TTL 24h)
        const { data: cache } = await supabaseClient
          .from("escavador_search_requests")
          .select("*, escavador_search_results(*)")
          .eq("numero_processo", normalized)
          .eq("office_id", profile.office_id)
          .eq("status", "COMPLETED")
          .gt("ttl_expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cache && cache.escavador_search_results?.length > 0) {
          console.log(`[escavador-api] [${correlationId}] Cache hit for ${normalized}`);
          return new Response(JSON.stringify({ 
            data: cache.escavador_search_results[0].payload_response, 
            source: "CACHE",
            request_id: cache.id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Check Duplicity (PROCESSING in the last 5 minutes)
        const { data: processing } = await supabaseClient
          .from("escavador_search_requests")
          .select("id")
          .eq("numero_processo", normalized)
          .eq("office_id", profile.office_id)
          .eq("status", "PROCESSING")
          .gt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .maybeSingle();

        if (processing) {
          return new Response(JSON.stringify({ error: "DUPLICATE_REQUEST", message: "Busca já em andamento." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Register Request
        const { data: request, error: reqError } = await supabaseClient
          .from("escavador_search_requests")
          .insert({
            office_id: profile.office_id,
            requested_by: user.id,
            numero_processo: normalized,
            tipo_busca: "PROCESSO",
            status: "PROCESSING",
            correlation_id: correlationId,
            ttl_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single();

        if (reqError) throw reqError;

        try {
          // Call Escavador
          const { data: escavadorResponse } = await client.getProcessoPorNumero(normalized, correlationId);
          
          // Save Result
          await supabaseClient.from("escavador_search_results").insert({
            request_id: request.id,
            payload_response: escavadorResponse,
            source: "SYNC"
          });

          // Finalize Request
          await supabaseClient.from("escavador_search_requests")
            .update({ status: "COMPLETED" })
            .eq("id", request.id);

          return new Response(JSON.stringify({ data: escavadorResponse, source: "SYNC", request_id: request.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });

        } catch (err: any) {
          await supabaseClient.from("escavador_search_requests")
            .update({ status: "FAILED", error_code: err.code || "UPSTREAM_ERROR" })
            .eq("id", request.id);
          
          throw err;
        }
      }

      case "list_monitoramentos": {
        const { data: localMonitorings } = await supabaseClient
          .from("escavador_monitorings")
          .select("*")
          .eq("office_id", profile.office_id)
          .eq("is_active", true);

        return new Response(JSON.stringify({ data: localMonitorings }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "create_monitoramento": {
        const { numero, frequencia, observacao } = payload;
        const { normalized, isValid } = normalizeCNJ(numero);

        if (!isValid) throw { code: 'INVALID_CNJ', message: 'CNJ inválido para monitoramento.' };

        // 1. Call Escavador
        const { data: escavadorResp } = await client.criarMonitoramento({
            tipo: "PROCESSO",
            valor: normalized,
            frequencia: frequencia || "DIARIA",
            callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/escavador-webhook`,
            termo: normalized
        }, correlationId);

        // 2. Persist Local
        const { data: monitoring, error: monError } = await supabaseClient
          .from("escavador_monitorings")
          .insert({
            office_id: profile.office_id,
            numero_processo: normalized,
            external_id: escavadorResp.id.toString(),
            is_active: true
          })
          .select()
          .single();

        if (monError) throw monError;

        return new Response(JSON.stringify({ data: monitoring }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "delete_monitoramento": {
        const { id, external_id } = payload;

        // 1. Remove from Escavador
        await client.removerMonitoramento(external_id, correlationId);

        // 2. Update Local
        await supabaseClient.from("escavador_monitorings")
          .update({ is_active: false })
          .eq("id", id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "search_by_context": {
        const { client_id } = payload;
        
        // 1. Get Client Info
        const { data: clientData } = await supabaseClient
            .from("clients")
            .select("full_name, document_id, oab_number")
            .eq("id", client_id)
            .single();

        if (!clientData) throw { code: 'CLIENT_NOT_FOUND', message: 'Cliente não localizado.' };

        // 2. Prioritized Search Logic
        let result: any = null;
        let searchUsed: string = '';

        if (clientData.document_id) {
            console.log(`[escavador-api] [${correlationId}] Searching by Document: ${clientData.document_id}`);
            result = await client.getEnvolvido(clientData.document_id, correlationId);
            searchUsed = 'CPF_CNPJ';
        } else if (clientData.full_name) {
            console.log(`[escavador-api] [${correlationId}] Searching by Name: ${clientData.full_name}`);
            result = await client.getEnvolvido(clientData.full_name, correlationId);
            searchUsed = 'NOME';
        }

        return new Response(JSON.stringify({ data: result?.data, searchUsed }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "link_process_to_client": {
        const { client_id, numero_processo, external_id, search_request_id, match_input_type } = payload;
        
        // 1. Calculate Confidence Score (Granular 0-100)
        let score = 0;
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        let reason = '';

        if (match_input_type === 'CPF_CNPJ' || match_input_type === 'CNJ') {
            score = 100;
            confidence = 'HIGH';
            reason = `Match exato e verificado via ${match_input_type}`;
        } else if (match_input_type === 'OAB') {
            score = 80;
            confidence = 'MEDIUM';
            reason = 'Match via OAB (requer conferência de polo)';
        } else {
            score = 30; // Heurística inicial para NOME
            confidence = 'LOW';
            reason = 'Sugestão baseada em match fonético de nome';
        }

        // 2. Persist Link with Product Metrics
        const { data: link, error: linkError } = await supabaseClient
            .from("client_linked_processes")
            .insert({
                office_id: profile.office_id,
                client_id,
                numero_processo,
                escavador_search_request_id: search_request_id,
                external_id,
                confidence_level: confidence,
                confidence_score: score,
                match_reason: reason,
                match_input_type,
                status: 'LINKED',
                is_confirmed: confidence === 'HIGH',
                linked_by: user.id
            })
            .select()
            .single();

        if (linkError) {
            if (linkError.code === '23505') throw { code: 'ALREADY_LINKED', message: 'Este processo já está vinculado a este cliente.' };
            throw linkError;
        }

        return new Response(JSON.stringify({ data: link }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "reject_suggestion": {
        const { link_id, is_permanent } = payload;
        
        const { error } = await supabaseClient.rpc("escavador_record_decision", {
            p_link_id: link_id,
            p_status: is_permanent ? 'IGNORED' : 'REJECTED',
            p_notes: is_permanent ? 'Ignorado permanentemente pelo usuário' : 'Rejeitado na triagem',
            p_permanent_ignore: is_permanent || false
        });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "get_performance_metrics": {
        const { data, error } = await supabaseClient
            .from("vw_escavador_performance")
            .select("*")
            .eq("office_id", profile.office_id)
            .maybeSingle();
            
        if (error) throw error;
        return new Response(JSON.stringify(data || { total_suggestions: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "auto_provision_case": {
        const { link_id, acting_side } = payload;
        
        // 1. Get Link and Process Data
        const { data: link, error: linkError } = await supabaseClient
            .from("client_linked_processes")
            .select("*, client:clients(full_name)")
            .eq("id", link_id)
            .single();

        if (linkError || !link) throw new Error("Vínculo não encontrado.");
        if (link.case_created_id) return new Response(JSON.stringify({ data: { id: link.case_created_id } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        // 2. Create Case via RPC
        const side = acting_side || 'ATAQUE'; 
        const title = `Caso Escavador - ${link.numero_processo}`;
        
        const { data: caseId, error: caseError } = await supabaseClient.rpc("lexos_nija_create_case", {
            p_client_id: link.client_id,
            p_side: side,
            p_title: title,
            p_stage: 'pre_processual'
        });

        if (caseError) throw caseError;

        // 3. Update Case with Escavador Metadata
        await supabaseClient.rpc("lexos_nija_update_case_metadata", {
            p_case_id: caseId,
            p_patch: {
                cnj_number: link.numero_processo,
                external_id: link.external_id,
                source: 'ESCAVADOR',
                auto_provisioned: true
            }
        });

        // 4. Update Link
        await supabaseClient
            .from("client_linked_processes")
            .update({ case_created_id: caseId, status: 'LINKED' })
            .eq("id", link_id);

        return new Response(JSON.stringify({ data: { id: caseId } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "get_process_summary": {
        const { numero_processo } = payload;
        // Mocking for now, in prod calls NIJA + LLM
        return new Response(JSON.stringify({ 
            summary: `Resumo simplificado do processo ${numero_processo}: Trata-se de uma ação de cobrança em fase inicial.` 
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "get_saldo": {
        const { data } = await client.obterSaldo(correlationId);
        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(JSON.stringify({ error: "INVALID_ACTION" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

  } catch (err: any) {
    console.error(`[escavador-api] [${correlationId}] Error:`, err);
    return new Response(JSON.stringify({ error: err.code || "INTERNAL_ERROR", message: err.message }), {
      status: err.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
