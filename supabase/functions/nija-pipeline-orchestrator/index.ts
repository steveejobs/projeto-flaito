// supabase/functions/nija-pipeline-orchestrator/index.ts
// ORQUESTRADOR DO PIPELINE JURÍDICO (NIJA-MAESTRO) V2.1
// Coordena: Dossiê -> Estratégia -> Geração -> Revisão -> Juiz IA -> Storage -> ZapSign -> Notificações

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireResourceAccess } from "../_shared/auth.ts";
import { orchestrateGeneration } from "./piece-generation-orchestrator.ts";
import { OpenAI } from "https://esm.sh/openai@4.24.1";

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
    send_to_sign?: boolean;
    notify_lawyer?: boolean;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const logs: string[] = [];

  try {
    const { case_id, options } = await req.json() as OrchestratorRequest;
    const threshold = options?.score_threshold ?? 65;

    const log = (msg: string) => {
        const time = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[NIJA-MAESTRO][${time}s] ${msg}`);
        logs.push(`${time}s: ${msg}`);
    };

    // ETAPA -1: AUTENTICAÇÃO E AUTORIZAÇÃO (Zero Trust)
    const auth = await requireResourceAccess(req, {
        resourceType: 'cases',
        resourceId: case_id,
        minRole: 'MEMBER'
    });

    if (!auth.ok) return auth.response;

    const supabase = auth.adminClient;
    const officeId = auth.membership.office_id;

    log(`Iniciando orquestração inteligente para o caso: ${case_id} (Office: ${officeId})`);

    // ETAPA 0: CARREGAR CONTEXTO E INICIAR RUN
    // Já validamos o acesso ao caso, agora buscamos metadados adicionais com o adminClient
    const { data: caseData, error: caseErr } = await supabase
        .from("cases")
        .select("id, office_id, client_id, title")
        .eq("id", case_id)
        .single();
    
    if (caseErr || !caseData) throw new Error("Erro ao carregar metadados do caso após autorização.");

    const { data: run, error: runErr } = await supabase
        .from("nija_pipeline_runs")
        .insert({
            case_id,
            office_id: caseData.office_id,
            status: "RUNNING",
            current_stage: "INICIANDO",
            metadata: { options }
        })
        .select()
        .single();
    
    if (runErr) log("Aviso: Falha ao registrar início da run no banco.");

    const updateRun = async (update: any) => {
        if (!run?.id) return;
        await supabase
            .from("nija_pipeline_runs")
            .update({ ...update, logs, updated_at: new Date().toISOString() })
            .eq("id", run.id);
    };

    // ETAPA 1: DOSSIÊ (Consolidação)
    log("Etapa 1: Consolidando Dossiê Jurídico...");
    await updateRun({ current_stage: "DOSSIÊ" });
    const { data: dossier, error: dossierErr } = await supabase.functions.invoke("nija-consolidate-dossier", {
        body: { case_id, office_id: caseData.office_id }
    });
    if (dossierErr) throw new Error(`Erro no Dossiê: ${dossierErr.message}`);
    log(`Dossiê V${dossier.version} consolidado com sucesso.`);
    await updateRun({ dossier_id: dossier.id });

    // ETAPA 1: DOSSIÊ (Estruturação)
    log("Etapa 1: Consolidando Dossiê Jurídico...");
    await updateRun({ current_stage: "ESTRUTURAÇÃO (S1)" });
    const { data: dossier, error: dossierErr } = await supabase.functions.invoke("nija-consolidate-dossier", {
        body: { case_id, office_id: caseData.office_id }
    });
    if (dossierErr) throw new Error(`Erro no Dossiê: ${dossierErr.message}`);
    log(`Dossiê V${dossier.version} estruturado.`);
    await updateRun({ dossier_id: dossier.id });

    // ETAPA 2: RECONSTRUÇÃO (Teoria Jurídica)
    log("Etapa 2: Mapeando Teoria Jurídica e Fatos...");
    await updateRun({ current_stage: "RECONSTRUÇÃO (S2)" });
    const { data: theory, error: theoryErr } = await supabase.functions.invoke("nija-stage-2-legal-theory-map", {
        body: { dossier_id: dossier.dossier_id, office_id: caseData.office_id }
    });
    if (theoryErr) throw new Error(`Erro na Teoria Jurídica: ${theoryErr.message}`);
    log(`Teoria jurídica mapeada. Status: ${theory.status}`);

    // ETAPA 3: RACIOCÍNIO (Seleção de Estratégia)
    log("Etapa 3: Selecionando Estratégia e Plano de Ataque...");
    await updateRun({ current_stage: "RACIOCÍNIO (S3)" });
    const { data: strategy, error: stratErr } = await supabase.functions.invoke("nija-stage-3-strategy-selection", {
        body: { dossier_id: theory.dossier_id, office_id: caseData.office_id }
    });
    if (stratErr) throw new Error(`Erro na Estratégia: ${stratErr.message}`);
    log(`Estratégia definida via ${strategy.mode}.`);

    // ETAPA 4: GERAÇÃO (Montagem Controlada)
    log("Etapa 4: Montando Documento com Rastreabilidade...");
    await updateRun({ current_stage: "GERAÇÃO (S4)" });
    const { data: assembly, error: assemblyErr } = await supabase.functions.invoke("nija-stage-4-document-assembly", {
        body: { dossier_id: strategy.dossier_id, office_id: caseData.office_id }
    });
    if (assemblyErr) throw new Error(`Erro na Montagem: ${assemblyErr.message}`);
    log(`Documento montado com ${assembly.blocks_assembled} blocos.`);

    // ETAPA 5: AUDITORIA (Gatekeeper Anti-Alucinação)
    log("Etapa 5: Executando Auditoria Final Gatekeeper...");
    await updateRun({ current_stage: "AUDITORIA (S5)" });
    const { data: audit, error: auditErr } = await supabase.functions.invoke("nija-stage-5-document-audit", {
        body: { dossier_id: assembly.dossier_id, office_id: caseData.office_id }
    });
    if (auditErr) throw new Error(`Erro na Auditoria: ${auditErr.message}`);
    log(`Auditoria concluída. Status Global: ${audit.status}`);

    if (audit.status === "BLOCKED_HALLUCINATION_DETECTED") {
        throw new Error("Pipeline Bloqueado: Alucinação detectada pela auditoria de segurança.");
    }

    const finalPieceContent = audit.assembled_document_markdown;
    const finalDossierId = audit.dossier_id;

    // Persistir Peça Final para Auditoria/Assinatura
    const { data: finalDoc, error: finalDocErr } = await supabase
        .from("legal_documents")
        .insert({
            title: `Petição Inicial - NIJA S5 - ${caseData.title}`,
            content: finalPieceContent,
            type: "PETICAO",
            office_id: caseData.office_id,
            case_id: caseData.id,
            client_id: caseData.client_id,
            version: audit.version || 1,
            metadata: { 
                nija_run_id: run?.id, 
                audit_status: audit.status,
                integrity_hash: audit.integrity_hash 
            }
        })
        .select()
        .single();
    
    if (finalDocErr) throw new Error(`Erro ao persistir documento final: ${finalDocErr.message}`);
    const pieceId = finalDoc.id;

    // ETAPA 6: SIMULAÇÃO DE DECISÃO (JUIZ IA)
    log("Etapa 6: Simulação de Decisão Judicial...");
    await updateRun({ current_stage: "JUIZ_IA" });
    const { data: judgment, error: judgeErr } = await supabase.functions.invoke("nija-judge-simulation", {
        body: { 
            case_id, 
            dossier_id: finalDossierId, 
            draft_piece: { content: finalPieceContent, id: pieceId }, 
            office_id: caseData.office_id,
            pipeline_stage: "JUIZ_IA"
        }
    });
    if (judgeErr) throw new Error(`Erro no Juiz IA: ${judgeErr.message}`);
    log(`Probabilidade de êxito: ${judgment.probabilidade_exito}%`);

    // ETAPA 7: FEEDBACK LOOP & VERSIONAMENTO
    let finalPieceId = pieceId;
    let finalJudgment = judgment;
    let iterations = 1;

    // ETAPA 7: PERSISTÊNCIA EM STORAGE E TABELA DE DOCUMENTOS
    log("Etapa 7: Finalizando e salvando snapshot para assinatura...");
    await updateRun({ current_stage: "FINALIZANDO", final_piece_id: finalPieceId });

    const storagePath = `nija-pieces/${caseData.office_id}/${case_id}/${finalPieceId}.html`;
    const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, finalPieceContent, {
            contentType: "text/html",
            upsert: true
        });

    if (uploadErr) log(`Aviso: Erro ao fazer upload para storage: ${uploadErr.message}`);

    // Criar o registro na tabela global de documentos para ZapSign
    const { data: globalDoc, error: globalDocErr } = await supabase
        .from("documents")
        .insert({
            office_id: caseData.office_id,
            case_id: caseData.id,
            client_id: caseData.client_id,
            filename: `${pieceRes.tipo_peca || 'Petição'}_NIJA_V${iterations}.html`,
            storage_bucket: "documents",
            storage_path: storagePath,
            kind: "PECA",
            status: "PENDENTE",
            metadata: { nija_run_id: run?.id, nija_legal_doc_id: finalPieceId }
        })
        .select()
        .single();
    
    if (globalDocErr) log(`Erro crítico ao criar documento global: ${globalDocErr.message}`);

    // ETAPA 8: NOTIFICAÇÕES E ASSINATURA
    if (options?.notify_lawyer) {
        await supabase.from("notificacoes_fila").insert({
            office_id: caseData.office_id,
            resource_type: "CASE",
            resource_id: case_id,
            mensagem: `NIJA: Peça do caso "${caseData.title}" concluída com ${finalJudgment.probabilidade_exito}% de êxito.`,
            status: "PENDING",
            destinatario_tipo: "OFFICE"
        });
    }

    if (options?.send_to_sign && globalDoc) {
        log("Disparando fluxo de assinatura ZapSign...");
        await supabase.functions.invoke("zapsign-send-document", {
            body: { 
                office_id: caseData.office_id,
                client_id: caseData.client_id,
                case_id: caseData.id,
                document_id: globalDoc.id,
                document_type: "DOCUMENTO_JURIDICO"
            }
        });
    }

    log("Pipeline NIJA-MAESTRO concluído com sucesso.");
    await updateRun({ status: "COMPLETED", finished_at: new Date().toISOString(), current_stage: "CONCLUÍDO" });

    return new Response(
      JSON.stringify({
        success: true,
        case_id,
        run_id: run?.id,
        final_piece_id: finalPieceId,
        global_document_id: globalDoc?.id,
        judgment: finalJudgment,
        strategy: strategy, // Incluindo estratégia para o frontend
        metadata: {
            total_time: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
            iterations,
            logs
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[NIJA-MAESTRO] Fatal Error:", errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg, logs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
