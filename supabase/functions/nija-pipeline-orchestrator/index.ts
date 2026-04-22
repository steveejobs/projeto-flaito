// supabase/functions/nija-pipeline-orchestrator/index.ts
// ORQUESTRADOR DO PIPELINE JURÍDICO (NIJA-MAESTRO) V3.3 - FULL ASYNC, RESILIENT & HYBRID SIGNING
// Coordena: Dossiê -> Estratégia -> Geração -> Revisão -> Juiz IA -> Assinatura Nativa/ZapSign -> Notificações

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireResourceAccess } from "../_shared/auth.ts";
import { withRetry, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrchestratorRequest {
  case_id: string;
  options?: {
    force_piece_type?: string;
    skip_review?: boolean;
    score_threshold?: number;
    send_to_sign?: boolean; // ZapSign (Opcional)
    use_native_signature?: boolean; // Assinatura Flaito
    notify_lawyer?: boolean;
    signature_methods?: string[]; // ['CLIENT', 'LAWYER']
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { case_id, options } = await req.json() as OrchestratorRequest;

    // 1. AUTENTICAÇÃO E AUTORIZAÇÃO
    const auth = await requireResourceAccess(req, {
        resourceType: 'cases',
        resourceId: case_id,
        minRole: 'MEMBER'
    });

    if (!auth.ok) return auth.response;

    const adminClient = getSupabaseAdmin();
    const officeId = auth.membership.office_id;

    // 2. CARREGAR METADADOS DO CASO
    const { data: caseData, error: caseErr } = await adminClient
        .from("cases")
        .select("id, office_id, client_id, title")
        .eq("id", case_id)
        .single();
    
    if (caseErr || !caseData) throw new Error("Erro ao carregar metadados do caso.");

    // 3. CRIAR REGISTRO DE EXECUÇÃO
    const { data: run, error: runErr } = await adminClient
        .from("nija_pipeline_runs")
        .insert({
            case_id,
            office_id: officeId,
            status: "RUNNING",
            current_stage: "INICIANDO",
            metadata: { options }
        })
        .select()
        .single();
    
    if (runErr) throw new Error(`Falha ao registrar início da run: ${runErr.message}`);

    // 4. DISPARAR PROCESSAMENTO ASSÍNCRONO
    (async () => {
        const startTime = Date.now();
        const logs: string[] = [];
        const log = (msg: string) => {
            const time = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[NIJA-MAESTRO][${run.id}][${time}s] ${msg}`);
            logs.push(`${time}s: ${msg}`);
        };

        const updateRun = async (update: any) => {
            await adminClient
                .from("nija_pipeline_runs")
                .update({ ...update, logs, updated_at: new Date().toISOString() })
                .eq("id", run.id);
        };

        try {
            log("Iniciando pipeline assíncrono completo...");

            // ETAPA 1-5: CORE NIJA (Dossiê -> Auditoria)
            log("Executando estágios Core do NIJA...");
            await updateRun({ current_stage: "NIJA_CORE", progress_percentage: 10 });
            
            // Reutilizando o fluxo consolidado
            const dossier = await withRetry(async () => {
                const { data, error } = await adminClient.functions.invoke("nija-consolidate-dossier", {
                    body: { case_id, office_id: officeId }
                });
                if (error) throw error;
                return data;
            });

            await adminClient.functions.invoke("nija-stage-2-legal-theory-map", { body: { dossier_id: dossier.id, office_id: officeId } });
            await adminClient.functions.invoke("nija-stage-3-strategy-selection", { body: { dossier_id: dossier.id, office_id: officeId } });
            await adminClient.functions.invoke("nija-stage-4-document-assembly", { body: { dossier_id: dossier.id, office_id: officeId } });
            
            const audit = await withRetry(async () => {
                const { data, error } = await adminClient.functions.invoke("nija-stage-5-document-audit", {
                    body: { dossier_id: dossier.id, office_id: officeId }
                });
                if (error) throw error;
                return data;
            });

            if (audit.status === "BLOCKED_HALLUCINATION_DETECTED") throw new Error("Alucinação detectada pela auditoria.");

            const finalPieceContent = audit.assembled_document_markdown;

            // PERSISTÊNCIA JURÍDICA
            const { data: finalDoc } = await adminClient.from("legal_documents").insert({
                title: `Petição Inicial - NIJA - ${caseData.title}`,
                content: finalPieceContent,
                type: "PETICAO",
                office_id: officeId,
                case_id: case_id,
                client_id: caseData.client_id,
                metadata: { nija_run_id: run.id }
            }).select().single();
            const pieceId = finalDoc.id;

            // ETAPA 6: JUIZ IA
            log("Executando Simulação de Decisão...");
            await updateRun({ current_stage: "JUIZ_IA", progress_percentage: 80 });
            const judgment = await withRetry(async () => {
                const { data, error } = await adminClient.functions.invoke("nija-judge-simulation", {
                    body: { case_id, dossier_id: dossier.id, draft_piece: { content: finalPieceContent, id: pieceId }, office_id: officeId }
                });
                if (error) throw error;
                return data;
            });

            // ETAPA 7: STORAGE E DOCUMENTO GLOBAL
            log("Finalizando documento e storage...");
            const storagePath = `nija-pieces/${officeId}/${case_id}/${pieceId}.html`;
            await adminClient.storage.from("documents").upload(storagePath, finalPieceContent, { contentType: "text/html", upsert: true });

            const { data: globalDoc } = await adminClient.from("documents").insert({
                office_id: officeId,
                case_id: case_id,
                client_id: caseData.client_id,
                filename: `Petição_NIJA_${pieceId}.html`,
                storage_bucket: "documents",
                storage_path: storagePath,
                kind: "PECA",
                status: "PENDENTE",
                metadata: { nija_run_id: run.id, nija_legal_doc_id: pieceId }
            }).select().single();

            // ETAPA 8: ASSINATURA (HÍBRIDA)
            let signatureLink = null;

            if (options?.use_native_signature && globalDoc) {
                log("Gerando fluxo de Assinatura Nativa Flaito...");
                const { data: signLink, error: signError } = await adminClient.functions.invoke("create_signature_links", {
                    body: { 
                        document_id: globalDoc.id,
                        office_id: officeId,
                        methods: options.signature_methods || ['CLIENT']
                    }
                });
                if (!signError) signatureLink = signLink.url;
            }

            if (options?.send_to_sign && globalDoc) {
                log("Disparando ZapSign (Opcional)...");
                await adminClient.functions.invoke("zapsign-send-document", {
                    body: { office_id: officeId, client_id: caseData.client_id, case_id: case_id, document_id: globalDoc.id }
                });
            }

            // ETAPA 9: NOTIFICAÇÕES
            if (options?.notify_lawyer) {
                await adminClient.from("notificacoes_fila").insert({
                    office_id: officeId,
                    resource_type: "CASE",
                    resource_id: case_id,
                    mensagem: `NIJA: Peça concluída (${judgment.probabilidade_exito}% êxito).${signatureLink ? ' Link de Assinatura pronto.' : ''}`,
                    status: "PENDING",
                    destinatario_tipo: "OFFICE",
                    metadata: { signature_url: signatureLink }
                });
            }

            // CONCLUSÃO
            log("Pipeline NIJA-MAESTRO concluído com sucesso.");
            await updateRun({ 
                status: "COMPLETED", 
                current_stage: "CONCLUÍDO",
                progress_percentage: 100,
                final_piece_id: pieceId,
                metadata: { ...options, judgment, signature_url: signatureLink },
                finished_at: new Date().toISOString()
            });

        } catch (bgError) {
            const errorMsg = bgError instanceof Error ? bgError.message : String(bgError);
            log(`ERRO FATAL: ${errorMsg}`);
            await adminClient.from("nija_pipeline_runs").update({ 
                status: "FAILED", 
                error_message: errorMsg,
                logs,
                finished_at: new Date().toISOString() 
            }).eq("id", run.id);
        }
    })();

    return new Response(JSON.stringify({ success: true, run_id: run.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
