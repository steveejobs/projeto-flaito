// supabase/functions/delete-case-hard/index.ts
// Hard delete de casos - remove permanentemente o caso e registros relacionados

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { caseId, reason } = await req.json();

    if (!caseId) {
      console.error("[delete-case-hard] caseId não fornecido");
      return new Response(
        JSON.stringify({ error: "caseId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-case-hard] Iniciando exclusão permanente do caso: ${caseId}`);
    console.log(`[delete-case-hard] Motivo: ${reason || "Não informado"}`);

    // Criar cliente Supabase com service role (bypass TOTAL de RLS)
    // Não passamos o Authorization header para evitar conflitos com RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("[delete-case-hard] Requisição sem Authorization");
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente com SERVICE ROLE puro (sem user context) para bypass total de RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se o caso existe
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("id, title, office_id, client_id")
      .eq("id", caseId)
      .maybeSingle();

    if (caseError) {
      console.error("[delete-case-hard] Erro ao buscar caso:", caseError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar caso", details: caseError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!caseData) {
      console.warn(`[delete-case-hard] Caso não encontrado: ${caseId}`);
      return new Response(
        JSON.stringify({ error: "Caso não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-case-hard] Caso encontrado: "${caseData.title}"`);

    // Ordem de exclusão (respeitar foreign keys):
    // 1. case_events
    // 2. case_deadlines
    // 3. case_expenses
    // 4. case_tasks
    // 5. case_permissions
    // 6. case_stage_logs
    // 7. case_status_logs
    // 8. case_status_transitions
    // 9. case_cnj_snapshots
    // 10. document_events (via case_id)
    // 11. documents (via case_id)
    // 12. client_files (via case_id)
    // 13. agenda_items (via case_id)
    // 14. chat_threads (via case_id)
    // 15. document_render_jobs (via case_id)
    // 16. O próprio caso

    const deletions: { table: string; deleted: number }[] = [];

    // 1. case_events
    const { error: eventsErr, count: eventsCount } = await supabase
      .from("case_events")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (eventsErr) console.warn("[delete-case-hard] Erro em case_events:", eventsErr.message);
    else deletions.push({ table: "case_events", deleted: eventsCount || 0 });

    // 2. case_deadlines
    const { error: deadlinesErr, count: deadlinesCount } = await supabase
      .from("case_deadlines")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (deadlinesErr) console.warn("[delete-case-hard] Erro em case_deadlines:", deadlinesErr.message);
    else deletions.push({ table: "case_deadlines", deleted: deadlinesCount || 0 });

    // 3. case_expenses
    const { error: expensesErr, count: expensesCount } = await supabase
      .from("case_expenses")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (expensesErr) console.warn("[delete-case-hard] Erro em case_expenses:", expensesErr.message);
    else deletions.push({ table: "case_expenses", deleted: expensesCount || 0 });

    // 4. case_tasks
    const { error: tasksErr, count: tasksCount } = await supabase
      .from("case_tasks")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (tasksErr) console.warn("[delete-case-hard] Erro em case_tasks:", tasksErr.message);
    else deletions.push({ table: "case_tasks", deleted: tasksCount || 0 });

    // 5. case_permissions
    const { error: permsErr, count: permsCount } = await supabase
      .from("case_permissions")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (permsErr) console.warn("[delete-case-hard] Erro em case_permissions:", permsErr.message);
    else deletions.push({ table: "case_permissions", deleted: permsCount || 0 });

    // 6. case_stage_logs
    const { error: stageLogsErr, count: stageLogsCount } = await supabase
      .from("case_stage_logs")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (stageLogsErr) console.warn("[delete-case-hard] Erro em case_stage_logs:", stageLogsErr.message);
    else deletions.push({ table: "case_stage_logs", deleted: stageLogsCount || 0 });

    // 7. case_status_logs
    const { error: statusLogsErr, count: statusLogsCount } = await supabase
      .from("case_status_logs")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (statusLogsErr) console.warn("[delete-case-hard] Erro em case_status_logs:", statusLogsErr.message);
    else deletions.push({ table: "case_status_logs", deleted: statusLogsCount || 0 });

    // 8. case_status_transitions
    const { error: transitionsErr, count: transitionsCount } = await supabase
      .from("case_status_transitions")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (transitionsErr) console.warn("[delete-case-hard] Erro em case_status_transitions:", transitionsErr.message);
    else deletions.push({ table: "case_status_transitions", deleted: transitionsCount || 0 });

    // 9. case_cnj_snapshots
    const { error: cnjErr, count: cnjCount } = await supabase
      .from("case_cnj_snapshots")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (cnjErr) console.warn("[delete-case-hard] Erro em case_cnj_snapshots:", cnjErr.message);
    else deletions.push({ table: "case_cnj_snapshots", deleted: cnjCount || 0 });

    // 10. document_events (via case_id)
    const { error: docEventsErr, count: docEventsCount } = await supabase
      .from("document_events")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (docEventsErr) console.warn("[delete-case-hard] Erro em document_events:", docEventsErr.message);
    else deletions.push({ table: "document_events", deleted: docEventsCount || 0 });

    // 10.5 case_event_segments (via case_id) - Antes dos documents
    const { error: segmentsErr, count: segmentsCount } = await supabase
      .from("case_event_segments")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (segmentsErr) console.warn("[delete-case-hard] Erro em case_event_segments:", segmentsErr.message);
    else deletions.push({ table: "case_event_segments", deleted: segmentsCount || 0 });

    // 11. documents (via case_id) - Primeiro buscar IDs para limpar dependências
    const { data: docs } = await supabase
      .from("documents")
      .select("id")
      .eq("case_id", caseId);

    const docIds = docs?.map((d) => d.id) || [];
    console.log(`[delete-case-hard] Encontrados ${docIds.length} documento(s) para deletar`);

    if (docIds.length > 0) {
      // document_versions (CRÍTICO: deve ser deletado ANTES de documents para evitar trigger conflicts)
      const { error: versionsErr, count: versionsCount } = await supabase
        .from("document_versions")
        .delete({ count: "exact" })
        .in("document_id", docIds);
      if (versionsErr) {
        console.error("[delete-case-hard] ERRO CRÍTICO em document_versions:", versionsErr);
      } else {
        console.log(`[delete-case-hard] ${versionsCount || 0} document_versions deletadas`);
        deletions.push({ table: "document_versions", deleted: versionsCount || 0 });
      }

      // document_sign_requests
      const { error: signReqErr, count: signCount } = await supabase
        .from("document_sign_requests")
        .delete({ count: "exact" })
        .in("document_id", docIds);
      if (signReqErr) console.warn("[delete-case-hard] Erro em document_sign_requests:", signReqErr.message);
      else deletions.push({ table: "document_sign_requests", deleted: signCount || 0 });

      // document_access_logs
      const { error: accessLogsErr } = await supabase
        .from("document_access_logs")
        .delete()
        .in("document_id", docIds);
      if (accessLogsErr) console.warn("[delete-case-hard] Erro em document_access_logs:", accessLogsErr.message);

      // document_status_logs
      const { error: docStatusErr } = await supabase
        .from("document_status_logs")
        .delete()
        .in("document_id", docIds);
      if (docStatusErr) console.warn("[delete-case-hard] Erro em document_status_logs:", docStatusErr.message);

      // document_events (também por document_id, além de case_id)
      const { error: docEventsById } = await supabase
        .from("document_events")
        .delete()
        .in("document_id", docIds);
      if (docEventsById) console.warn("[delete-case-hard] Erro em document_events (by doc_id):", docEventsById.message);
    }

    // Agora deletar os documentos
    const { error: docsErr, count: docsCount } = await supabase
      .from("documents")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (docsErr) {
      console.error("[delete-case-hard] ERRO ao deletar documents:", docsErr);
    } else {
      console.log(`[delete-case-hard] ${docsCount || 0} documento(s) deletado(s)`);
      deletions.push({ table: "documents", deleted: docsCount || 0 });
    }

    // 12. client_files (via case_id)
    const { error: filesErr, count: filesCount } = await supabase
      .from("client_files")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (filesErr) console.warn("[delete-case-hard] Erro em client_files:", filesErr.message);
    else deletions.push({ table: "client_files", deleted: filesCount || 0 });

    // 13. agenda_items (via case_id)
    const { error: agendaErr, count: agendaCount } = await supabase
      .from("agenda_items")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (agendaErr) console.warn("[delete-case-hard] Erro em agenda_items:", agendaErr.message);
    else deletions.push({ table: "agenda_items", deleted: agendaCount || 0 });

    // 14. chat_threads (via case_id) - Primeiro excluir mensagens
    const { data: threads } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("case_id", caseId);

    if (threads && threads.length > 0) {
      const threadIds = threads.map((t) => t.id);
      const { error: msgsErr } = await supabase
        .from("chat_messages")
        .delete()
        .in("thread_id", threadIds);
      if (msgsErr) console.warn("[delete-case-hard] Erro em chat_messages:", msgsErr.message);
    }

    const { error: threadsErr, count: threadsCount } = await supabase
      .from("chat_threads")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (threadsErr) console.warn("[delete-case-hard] Erro em chat_threads:", threadsErr.message);
    else deletions.push({ table: "chat_threads", deleted: threadsCount || 0 });

    // 15. document_render_jobs (via case_id)
    const { error: renderErr, count: renderCount } = await supabase
      .from("document_render_jobs")
      .delete({ count: "exact" })
      .eq("case_id", caseId);
    if (renderErr) console.warn("[delete-case-hard] Erro em document_render_jobs:", renderErr.message);
    else deletions.push({ table: "document_render_jobs", deleted: renderCount || 0 });

    // 16. audit_logs relacionados ao caso (entity = 'case' ou entity_id = caseId)
    const { error: auditErr, count: auditCount } = await supabase
      .from("audit_logs")
      .delete({ count: "exact" })
      .or(`entity_id.eq.${caseId},record_id.eq.${caseId}`);
    if (auditErr) console.warn("[delete-case-hard] Erro em audit_logs:", auditErr.message);
    else deletions.push({ table: "audit_logs", deleted: auditCount || 0 });

    // 17. audit_events relacionados ao caso
    const { error: auditEventsErr, count: auditEventsCount } = await supabase
      .from("audit_events")
      .delete({ count: "exact" })
      .eq("entity_id", caseId);
    if (auditEventsErr) console.warn("[delete-case-hard] Erro em audit_events:", auditEventsErr.message);
    else deletions.push({ table: "audit_events", deleted: auditEventsCount || 0 });

    // 18. Finalmente, excluir o caso
    const { error: caseDeleteErr } = await supabase
      .from("cases")
      .delete()
      .eq("id", caseId);

    if (caseDeleteErr) {
      console.error("[delete-case-hard] Erro ao excluir caso:", caseDeleteErr);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao excluir o caso", 
          details: caseDeleteErr.message,
          partialDeletions: deletions 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-case-hard] Caso "${caseData.title}" excluído com sucesso`);
    console.log(`[delete-case-hard] Resumo:`, JSON.stringify(deletions));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Caso "${caseData.title}" excluído permanentemente`,
        caseId,
        deletions,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[delete-case-hard] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
