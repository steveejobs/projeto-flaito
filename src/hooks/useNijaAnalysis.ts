import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  runNijaAnalyzer,
  runNijaEngine, 
  NijaDetectedDefectInput,
  mapAllAIVicios, 
  normalizeAto,
  inferTipoDocumento,
  inferParteFromPolo,
  inferBeneficiario,
  NijaPolo,
  NijaRamo,
  normalizePartyPrefill,
  buildAnalysisKey, 
  computeDocumentsHash,
  type EnrichedDoc,
} from "@/nija";
import { runNijaFullAnalysisQuick } from "@/services/nijaFullAnalysis";
import { logNijaStart, logNijaSuccess, logNijaError, createNijaTimer } from "@/lib/nijaLogger";

type ActingSide = "AUTOR" | "REU";

export interface UseNijaAnalysisOptions {
  actingSide: ActingSide;
  clientName: string;
  opponentName: string;
  processNumber: string;
  processYear: string;
  vara: string;
  city: string;
  lawyerName: string;
  oabNumber: string;
  mode: "SUPERVISED" | "AUTOMATIC";
  selectedRamo: string;
  caseDescription: string;

  setActingSide: (v: ActingSide) => void;
  setClientName: (v: string) => void;
  setOpponentName: (v: string) => void;
  setProcessNumber: (v: string) => void;
  setProcessYear: (v: string) => void;
  setVara: (v: string) => void;
  setCity: (v: string) => void;
}

export interface NijaDocumentInput {
  id: string;
  filename: string;
  content: string;
  kind?: string;
}

interface DetectedMetadata {
  authorName?: string;
  defendantName?: string;
  comarca?: string;
  vara?: string;
  actionType?: string;
  events?: any[];
}

export function useNijaAnalysis(opts: UseNijaAnalysisOptions) {
  const { toast } = useToast();

  // =========================
  // STATES
  // =========================
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [draftText, setDraftText] = useState<string>("");
  const [draftLoading, setDraftLoading] = useState(false);

  const [generatedPiece, setGeneratedPiece] = useState<any>(null);
  const [isGeneratingPiece, setIsGeneratingPiece] = useState(false);

  const [autoCaseId, setAutoCaseId] = useState<string | null>(null);

  // =========================
  // LOCKS & SESSION REFS (Snapshot First Pattern)
  // =========================
  const analysisLockRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string | null>(null);
  const currentAnalysisKeyRef = useRef<string | null>(null);

  // =========================
  // RUN ANALYSIS (HÍBRIDA: IA + Motor Local)
  // Com busca por snapshot antes de executar
  // =========================
  const runAnalysis = useCallback(
    async (
      inputs: NijaDocumentInput[],
      extraContext?: {
        identifiedDocs?: EnrichedDoc[];
        detectedMetadata?: DetectedMetadata;
        manualDocText?: string;
      },
      providedCaseId?: string | null
    ) => {
      // Guard: Bloquear execução simultânea
      if (analysisLockRef.current) {
        toast({
          title: "Análise em andamento",
          description: "Aguarde a conclusão da análise atual.",
          variant: "destructive",
        });
        return;
      }

      if (!inputs || inputs.length === 0) {
        toast({
          title: "Nenhum conteúdo",
          description: "Adicione ao menos um documento ou texto para análise.",
          variant: "destructive",
        });
        return;
      }

      // Ativar lock
      analysisLockRef.current = true;

      try {
        setAnalysisLoading(true);
        setAnalysisResult(null);
        setDraftText("");
        setGeneratedPiece(null);
        setAutoCaseId(null);

        // Timer para medir duração
        const timer = createNijaTimer();

        const docsHash = await computeDocumentsHash(inputs);
        const poloForAnalysis: NijaPolo = opts.actingSide === "AUTOR" ? "AUTOR" : "REU";
        const ramoForKey = opts.selectedRamo !== "__AUTO__" ? opts.selectedRamo : "AUTO";

        // LOG: Início da análise
        logNijaStart("useNijaAnalysis", "ANALYZE", {
          caseId: providedCaseId || autoCaseId,
          sessionId: sessionIdRef.current,
          payload: {
            documentsCount: inputs.length,
            docsHash,
            polo: poloForAnalysis,
            ramo: ramoForKey,
            mode: opts.mode,
          },
        });

        // PASSO 1: Construir analysis_key única
        const analysisKey = await buildAnalysisKey({
          documentsHash: docsHash,
          actingSide: opts.actingSide,
          ramo: ramoForKey,
          mode: opts.mode,
        });
        currentAnalysisKeyRef.current = analysisKey;

        // PASSO 2: Determinar case_id ou session_id
        // Regra anti-duplicação: se já existe uma análise com o mesmo documents_hash + analysis_key
        // associada a um case_id, reutilizar esse case para evitar criar "Casos" duplicados.
        if (!providedCaseId && !autoCaseId) {
          const { data: existingByHashKey } = await supabase
            .from("nija_case_analysis")
            .select("case_id, analysis")
            .eq("documents_hash", docsHash)
            .eq("analysis_key", analysisKey)
            .not("case_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingByHashKey?.case_id && existingByHashKey.analysis) {
            setAutoCaseId(existingByHashKey.case_id);
            setAnalysisResult(existingByHashKey.analysis);
            const defectsFound = (existingByHashKey.analysis as any)?.recommendation?.findings?.length ?? 0;
            toast({
              title: "Análise já existente",
              description: `Reutilizando o caso existente (${defectsFound} vício(s)).`,
            });
            return;
          }
        }

        const caseId = providedCaseId || autoCaseId;
        
        // PASSO 3: Buscar snapshot existente
        if (caseId) {
          // Busca por case_id + analysis_key
          const { data: cached } = await supabase
            .from("nija_case_analysis")
            .select("analysis")
            .eq("case_id", caseId)
            .eq("analysis_key", analysisKey)
            .maybeSingle();

          if (cached?.analysis) {
            setAnalysisResult(cached.analysis);
            setAutoCaseId(caseId);
            const defectsFound = (cached.analysis as any)?.recommendation?.findings?.length ?? 0;
            toast({
              title: "Análise recuperada do cache",
              description: `${defectsFound} vício(s) identificado(s). Polo: ${poloForAnalysis}.`,
            });
            return;
          }
        } else {
          // Modo solto: usar session_id
          if (!sessionIdRef.current) {
            sessionIdRef.current = crypto.randomUUID();
          }
          const sessionId = sessionIdRef.current;

          const { data: cached } = await supabase
            .from("nija_case_analysis")
            .select("analysis")
            .eq("session_id", sessionId)
            .eq("analysis_key", analysisKey)
            .maybeSingle();

          if (cached?.analysis) {
            setAnalysisResult(cached.analysis);
            const defectsFound = (cached.analysis as any)?.recommendation?.findings?.length ?? 0;
            toast({
              title: "Análise recuperada da sessão",
              description: `${defectsFound} vício(s) identificado(s). Polo: ${poloForAnalysis}.`,
            });
            return;
          }
        }

        // PASSO 4: Nenhum snapshot encontrado - executar análise
        const rawText = inputs.map((d) => d.content).join("\n\n---\n\n");

        try {
          toast({
            title: "Análise em andamento...",
            description: "O NIJA está analisando os documentos com IA + Motor Técnico.",
          });

          // Normalizar partes
          const finalNormalized = normalizePartyPrefill(opts.actingSide, {
            authorName: extraContext?.detectedMetadata?.authorName,
            defendantName: extraContext?.detectedMetadata?.defendantName,
            comarca: extraContext?.detectedMetadata?.comarca,
            vara: extraContext?.detectedMetadata?.vara,
          }, { clientName: opts.clientName, opponentName: opts.opponentName, city: opts.city });

          // PASSO 4.1: Análise IA completa
          const quickResult = await runNijaFullAnalysisQuick({
            rawText,
            ramoHint: opts.selectedRamo !== "__AUTO__" ? opts.selectedRamo : null,
            faseHint: null,
            poloHint: opts.actingSide === "AUTOR" ? "AUTOR" : "REU",
            caseId: caseId || null,
            titleHint: opts.caseDescription || `NIJA – Análise solta – ${new Date().toLocaleString("pt-BR")}`,
            preDetected: {
              clientName: finalNormalized.clientName || opts.clientName || undefined,
              opponentName: finalNormalized.opponentName || opts.opponentName || undefined,
              processNumber: opts.processNumber || undefined,
              processYear: opts.processYear || undefined,
              courtName: opts.vara || undefined,
              comarca: finalNormalized.city || opts.city || undefined,
              lawyerName: opts.lawyerName || undefined,
              oabNumber: opts.oabNumber || undefined,
              actionType: extraContext?.detectedMetadata?.actionType || undefined,
              identifiedDocs: extraContext?.identifiedDocs && extraContext.identifiedDocs.length > 0
                ? extraContext.identifiedDocs.map(d => ({ label: d.label || "Outros Documentos", category: d.category || "ANEXO" }))
                : undefined,
              events: extraContext?.detectedMetadata?.events?.map(e => ({
                ...e,
                meaning: (e as any).meaning,
                category: (e as any).category,
              })) || undefined,
            },
          });

          const createdCaseId = quickResult.caseId;
          setAutoCaseId(createdCaseId);

          // PASSO 4.2: Mapear vícios da IA para o catálogo técnico
          const aiVicios = quickResult.vicios || [];
          const { enriched: enrichedVicios, mapped, unmapped, unmappedCodes, ignored, ignoredCodes } = mapAllAIVicios(aiVicios);

          // PASSO 4.3: Converter para formato do motor local
          const mappedDefects: NijaDetectedDefectInput[] = enrichedVicios
            .filter((v) => v.catalogCode !== null)
            .map((v) => ({
              code: v.catalogCode!,
              notas: v.observacoes || null,
              tipoDocumento: v.atoRelacionado || inferTipoDocumento(v.catalogCode!),
              trecho: v.trecho || null,
              parteEnvolvida: (v as any).process_side || (v as any).parteEnvolvida || inferParteFromPolo(poloForAnalysis),
              parteQuePraticou: (v as any).quemPraticou || null,
              ladoAfetado: (v as any).who_benefits || inferBeneficiario(poloForAnalysis),
            }));

          // PASSO 4.4: Executar motor local
          const engineResult = runNijaEngine(
            {
              ramo: (quickResult.meta?.ramo as NijaRamo) || (opts.selectedRamo !== "__AUTO__" ? opts.selectedRamo as NijaRamo : undefined),
              descricaoCaso: opts.caseDescription || undefined,
              polo: poloForAnalysis,
            },
            mappedDefects
          );

          // PASSO 4.5: Combinar resultados IA + Motor Local
          const combinedFindings = enrichedVicios.map((v) => {
            const engineFinding = engineResult.findings.find(
              (f) => f.defect.code === v.catalogCode
            );

            return {
              code: v.catalogCode || v.codigo,
              label: v.label || engineFinding?.defect.label || v.codigo,
              severity: engineFinding?.severity || (v.gravidade === "ALTA" ? "ALTA" : v.gravidade === "MEDIA" ? "MEDIA" : "BAIXA"),
              impact: engineFinding?.impact || (v.gravidade === "ALTA" ? "POTENCIAL_REVERSAO_TOTAL" : "POTENCIAL_REVERSAO_PARTE"),
              natureza: v.natureza,
              atoRelacionado: normalizeAto(v.atoRelacionado),
              trecho: v.trecho,
              observacoes: v.observacoes,
              parteEnvolvida: (v as any).process_side || (v as any).parteEnvolvida || inferParteFromPolo(poloForAnalysis),
              parteQuePraticou: (v as any).quemPraticou || null,
              ladoAfetado: (v as any).who_benefits || inferBeneficiario(poloForAnalysis),
              technicalDetails: v.technicalDetails ? {
                motivoDeteccao: v.technicalDetails.legalLogic || v.observacoes || "Detectado pela análise",
                criteriosAplicados: v.technicalDetails.recommendedActions || [],
                fundamentosLegais: v.technicalDetails.fundamentosLegaisEnriquecidos || v.fundamentosLegais || [],
              } : {
                motivoDeteccao: v.observacoes || "Detectado pela análise IA",
                criteriosAplicados: [],
                fundamentosLegais: v.fundamentosLegais || [],
              },
              ato: engineFinding?.ato || {
                tipo: normalizeAto(v.atoRelacionado),
                id: undefined,
                data: undefined,
              },
              secaoDocumento: engineFinding?.secaoDocumento || undefined,
              tecnico: engineFinding?.tecnico || undefined,
              catalogMapped: v.catalogCode !== null,
              catalogCode: v.catalogCode,
              defect: engineFinding?.defect || { 
                code: v.catalogCode || v.codigo, 
                label: v.label || v.codigo 
              },
            };
          });

          // Estratégias
          const aiMainStrategies = (quickResult.estrategias?.principais || []).map((s: any) => ({
            code: s.label?.toLowerCase().replace(/\s+/g, "_") || `strategy_${Math.random()}`,
            label: s.label,
            description: s.descricao,
            potentialPieces: s.possiveisPecas || [],
            recomendadaPara: s.recomendadaPara || [opts.actingSide === "AUTOR" ? "AUTOR" : "REU"],
          }));

          const aiSecondaryStrategies = (quickResult.estrategias?.secundarias || []).map((s: any) => ({
            code: s.label?.toLowerCase().replace(/\s+/g, "_") || `sec_${Math.random()}`,
            label: s.label,
            description: s.descricao,
          }));

          const finalMainStrategies = engineResult.mainStrategies.length > 0
            ? engineResult.mainStrategies.map((s) => ({
                code: s.code,
                label: s.label,
                description: s.description,
                potentialPieces: s.potentialPieces,
                tacticalNotes: s.tacticalNotes,
              }))
            : aiMainStrategies;

          const finalSecondaryStrategies = engineResult.secondaryStrategies.length > 0
            ? engineResult.secondaryStrategies.map((s) => ({
                code: s.code,
                label: s.label,
                description: s.description,
              }))
            : aiSecondaryStrategies;

          // Resumo tático combinado
          const aiResumo = quickResult.meta?.resumoTatico || "";
          const motorResumo = engineResult.resumoTatico || "";
          const combinedResumo = motorResumo
            ? `${aiResumo}\n\n[Motor NIJA - ${poloForAnalysis}]: ${motorResumo}`
            : aiResumo;

          // Resultado híbrido
          const hybridResult = {
            mode: opts.mode,
            ramoFinal: (quickResult.meta?.ramo as NijaRamo) || engineResult.ramoFinal,
            poloFinal: poloForAnalysis,
            coreOverview: {
              version: "3.0-hybrid",
              defectsCount: combinedFindings.length,
              strategiesCount: finalMainStrategies.length + finalSecondaryStrategies.length,
              mappedVicios: mapped,
              unmappedVicios: unmapped,
              ignoredVicios: ignored,
            },
            recommendation: {
              findings: combinedFindings,
              mainStrategies: finalMainStrategies,
              secondaryStrategies: finalSecondaryStrategies,
              resumoTatico: combinedResumo,
            },
            usedDefects: mappedDefects.map((d) => d.code),
            warnings: [
              ...(unmappedCodes.length > 0
                ? [`${unmappedCodes.length} vício(s) não mapeados: ${unmappedCodes.join(", ")}`]
                : []),
              ...(ignoredCodes.length > 0
                ? [`${ignoredCodes.length} vício(s) ignorados (contexto negado): ${ignoredCodes.join(", ")}`]
                : []),
            ],
            meta: quickResult.meta,
            prescricao: quickResult.prescricao,
            partes: quickResult.partes,
            processo: quickResult.processo,
            linhaDoTempo: quickResult.linhaDoTempo,
            sugestaoPeca: quickResult.sugestaoPeca,
            engineRecommendation: engineResult,
          };

          setAnalysisResult(hybridResult);

          const ignoredMsg = ignored > 0 ? ` ${ignored} ignorado(s) por contexto negado.` : "";
          toast({
            title: "Análise híbrida concluída",
            description: `${combinedFindings.length} vício(s) identificado(s). Polo: ${poloForAnalysis}. ${mapped} mapeados, ${unmapped} não mapeados.${ignoredMsg}`,
          });

          // PASSO 5: Salvar snapshot com analysis_key via RPC
          // LOG: Antes de chamar RPC
          logNijaStart("useNijaAnalysis", "DB_RPC_INSERT_ANALYSIS", {
            caseId: createdCaseId,
            sessionId: sessionIdRef.current,
            payload: { docsHash, analysisKey },
          });

          // Usar RPC para bypass RLS em modo sessão
          const { error: rpcError } = await supabase.rpc("lexos_nija_insert_analysis", {
            p_documents_hash: docsHash,
            p_analysis_key: analysisKey,
            p_analysis: JSON.parse(JSON.stringify(hybridResult)),
            p_case_id: createdCaseId || null,
            p_session_id: !createdCaseId ? sessionIdRef.current : null,
          });

          if (rpcError) {
            logNijaError("useNijaAnalysis", "DB_RPC_INSERT_ANALYSIS", rpcError, {
              caseId: createdCaseId,
              sessionId: sessionIdRef.current,
              durationMs: timer.elapsed(),
            });
          } else {
            logNijaSuccess("useNijaAnalysis", "ANALYZE", {
              caseId: createdCaseId,
              sessionId: sessionIdRef.current,
              result: { findingsCount: combinedFindings.length, mapped, unmapped },
              durationMs: timer.elapsed(),
            });
          }

        } catch (autoErr: any) {
          console.warn("[NIJA] Erro na análise IA, usando fallback local:", autoErr);

          // Fallback: análise local
          const caseContext = {
            ramo: opts.selectedRamo !== "__AUTO__" ? opts.selectedRamo : undefined,
            descricaoCaso: opts.caseDescription || undefined,
            polo: poloForAnalysis,
          };

          const localResult = runNijaAnalyzer({
            mode: opts.mode,
            caseContext: caseContext as any,
            documents: inputs,
            preDetectedDefects: undefined,
          });

          const enrichedLocalResult = {
            ...localResult,
            poloFinal: poloForAnalysis,
          };

          setAnalysisResult(enrichedLocalResult);

          const defectsFound = localResult?.recommendation?.findings?.length ?? 0;
          const errorMessage = autoErr?.message || "";
          const isAIServiceError = 
            errorMessage.includes("503") || 
            errorMessage.includes("temporarily unavailable") ||
            errorMessage.includes("non-2xx") ||
            errorMessage.includes("timeout") ||
            errorMessage.includes("429") ||
            errorMessage.includes("402");

          toast({
            title: isAIServiceError ? "Análise local (IA indisponível)" : "Análise local concluída",
            description: isAIServiceError 
              ? `${defectsFound} vício(s) via análise local. Polo: ${poloForAnalysis}. IA temporariamente indisponível.`
              : `${defectsFound} vício(s) identificado(s) via análise local. Polo: ${poloForAnalysis}.`,
            variant: isAIServiceError ? "destructive" : "default",
          });

          // Salvar cache do fallback
          try {
            // LOG: Fallback RPC
            logNijaStart("useNijaAnalysis", "DB_RPC_INSERT_FALLBACK", {
              sessionId: sessionIdRef.current,
            });

            // Usar RPC para bypass RLS em modo sessão (fallback)
            const { error: fallbackErr } = await supabase.rpc("lexos_nija_insert_analysis", {
              p_documents_hash: docsHash,
              p_analysis_key: analysisKey,
              p_analysis: JSON.parse(JSON.stringify(enrichedLocalResult)),
              p_case_id: null,
              p_session_id: sessionIdRef.current,
            });

            if (fallbackErr) {
              logNijaError("useNijaAnalysis", "DB_RPC_INSERT_FALLBACK", fallbackErr, {
                sessionId: sessionIdRef.current,
              });
            }
          } catch (cacheErr) {
            logNijaError("useNijaAnalysis", "DB_RPC_INSERT_FALLBACK", cacheErr, {
              sessionId: sessionIdRef.current,
            });
            console.warn("[NIJA] Não foi possível salvar cache:", cacheErr);
          }
        }
      } catch (err) {
        // LOG: Erro geral
        logNijaError("useNijaAnalysis", "ANALYZE", err, {
          caseId: providedCaseId || autoCaseId,
          sessionId: sessionIdRef.current,
        });
        console.error(err);
        toast({
          title: "Erro na análise",
          description: "Ocorreu um erro ao executar o NIJA.",
          variant: "destructive",
        });
      } finally {
        setAnalysisLoading(false);
        analysisLockRef.current = false;
      }
    },
    [opts, toast, autoCaseId]
  );

  // =========================
  // GENERATE DRAFT (MINUTA)
  // =========================
  const generateDraft = useCallback(
    async (inputs: NijaDocumentInput[], manualDocText?: string) => {
      if (!analysisResult) return;

      try {
        setDraftLoading(true);

        const payload = {
          ramo: analysisResult.ramoFinal || opts.selectedRamo,
          resumoTatico: analysisResult.recommendation?.resumoTatico || "",
          vicios: analysisResult.recommendation?.findings || [],
          estrategiasPrincipais: analysisResult.recommendation?.mainStrategies || [],
          estrategiasSecundarias: analysisResult.recommendation?.secondaryStrategies || [],
          textoBase: manualDocText || "",
          engineTecnico: analysisResult,
          actingSide: opts.actingSide,
          caseDescription: opts.caseDescription || "",
          clientName: opts.clientName || "",
          opponentName: opts.opponentName || "",
          cnjNumber: opts.processNumber || "",
          courtName: opts.vara || "",
          city: opts.city || "",
          lawyerName: opts.lawyerName || "",
          oabNumber: opts.oabNumber || "",
        };

        const { data, error } = await supabase.functions.invoke("nija-generate-petition", {
          body: payload,
        });

        // Safari fix: validate response before processing
        if (error) {
          const errorMessage = error.message || "Erro desconhecido";
          console.error("[NIJA] Edge function error:", error);
          throw new Error(errorMessage);
        }

        if (!data || typeof data !== "object") {
          console.error("[NIJA] Invalid response type:", typeof data);
          throw new Error("Resposta inválida do serviço NIJA");
        }

        if (data?.petition) {
          setDraftText(data.petition);
          toast({ title: "Minuta gerada", description: "Confira o resultado abaixo." });
        } else {
          throw new Error("Resposta inválida da edge function");
        }
      } catch (err) {
        console.error(err);
        toast({
          title: "Erro ao gerar minuta",
          description: "Não foi possível gerar a minuta. Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setDraftLoading(false);
      }
    },
    [analysisResult, opts, toast]
  );

  // =========================
  // GENERATE PIECE (PEÇA ESTRUTURADA)
  // =========================
  const generatePiece = useCallback(
    async (inputs: NijaDocumentInput[]) => {
      if (!analysisResult) return;
      const defects = analysisResult?.recommendation?.findings || [];

      if (defects.length === 0) {
        toast({
          title: "Sem vícios detectados",
          description: "É necessário ter vícios identificados para gerar a peça estruturada.",
          variant: "destructive",
        });
        return;
      }

      try {
        const docsHash = await computeDocumentsHash(inputs);
        const pieceType = "DEFAULT";

        // Tentar buscar cache
        const { data: cached } = await supabase
          .from("nija_generated_pieces")
          .select("piece")
          .eq("piece_type", pieceType)
          .eq("documents_hash", docsHash)
          .maybeSingle();

        if (cached?.piece) {
          setGeneratedPiece(cached.piece);
          toast({ title: "Peça recuperada do cache", description: "Confira a estrutura na aba 'Peças geradas pelo NIJA'." });
          return;
        }

        // Confirmar geração
        if (!window.confirm("Gerar esta minuta consome créditos de IA. Deseja continuar?")) {
          return;
        }

        setIsGeneratingPiece(true);
        setGeneratedPiece(null);

        // Timer e LOG de início
        const pieceTimer = createNijaTimer();
        logNijaStart("useNijaAnalysis", "GENERATE_PIECE", {
          caseId: autoCaseId,
          payload: { pieceType, docsHash },
        });

        const payload = {
          ramo: analysisResult.ramoFinal || opts.selectedRamo,
          resumoTatico: analysisResult.recommendation?.resumoTatico || "",
          vicios: defects,
          estrategiasPrincipais: analysisResult.recommendation?.mainStrategies || [],
          estrategiasSecundarias: analysisResult.recommendation?.secondaryStrategies || [],
          timeline: analysisResult.timeline || [],
          caseDescription: opts.caseDescription || "",
          actingSide: opts.actingSide,
          clientName: opts.clientName || undefined,
          opponentName: opts.opponentName || undefined,
          cnjNumber: opts.processNumber || undefined,
          courtName: opts.vara || undefined,
          city: opts.city || undefined,
          lawyerName: opts.lawyerName || undefined,
          oabNumber: opts.oabNumber || undefined,
        };

        const { data, error } = await supabase.functions.invoke("nija-generate-piece", {
          body: payload,
        });

        // Safari fix: validate response before processing
        if (error) {
          const errorMessage = error.message || "Erro desconhecido";
          console.error("[NIJA] Edge function error:", error);
          throw new Error(errorMessage);
        }

        if (!data || typeof data !== "object") {
          console.error("[NIJA] Invalid response type:", typeof data);
          throw new Error("Resposta inválida do serviço NIJA");
        }

        // A edge function retorna o objeto diretamente (não dentro de "piece")
        // Verificar se tem tipoPeca ou estrutura para validar resposta
        const pieceData = data?.tipoPeca ? data : data?.piece;
        
        if (pieceData?.tipoPeca || pieceData?.estrutura) {
          setGeneratedPiece(pieceData);
          toast({ title: "Peça estruturada gerada", description: "Confira a estrutura na aba 'Peças geradas pelo NIJA'." });

          // Usar RPC para inserir peça com validação de office
          if (autoCaseId) {
            logNijaStart("useNijaAnalysis", "DB_RPC_INSERT_PIECE", {
              caseId: autoCaseId,
              payload: { pieceType },
            });

            const { error: pieceRpcErr } = await supabase.rpc("lexos_nija_insert_piece", {
              p_piece_type: pieceType,
              p_documents_hash: docsHash,
              p_case_id: autoCaseId,
              p_piece: pieceData,
            });

            if (pieceRpcErr) {
              logNijaError("useNijaAnalysis", "DB_RPC_INSERT_PIECE", pieceRpcErr, {
                caseId: autoCaseId,
                durationMs: pieceTimer.elapsed(),
              });
            } else {
              logNijaSuccess("useNijaAnalysis", "GENERATE_PIECE", {
                caseId: autoCaseId,
                durationMs: pieceTimer.elapsed(),
              });
            }
          }
        } else {
          console.error("[NIJA] Resposta inesperada da edge function:", data);
          throw new Error("Resposta inválida da edge function");
        }
      } catch (err) {
        logNijaError("useNijaAnalysis", "GENERATE_PIECE", err, {
          caseId: autoCaseId,
        });
        console.error(err);
        toast({
          title: "Erro ao gerar peça",
          description: "Não foi possível gerar a peça estruturada. Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsGeneratingPiece(false);
      }
    },
    [analysisResult, opts, toast, autoCaseId]
  );

  // =========================
  // AUTO-PREFILL AFTER ANALYSIS
  // =========================
  useEffect(() => {
    if (!analysisResult) return;

    const detectedPolo = analysisResult.meta?.poloAtuacao;
    if (detectedPolo === "AUTOR" || detectedPolo === "REU") {
      opts.setActingSide(detectedPolo);
    }

    const partes = analysisResult.partes;
    if (partes?.cliente?.nome && !opts.clientName) {
      opts.setClientName(partes.cliente.nome);
    }
    if (partes?.parteContraria?.nome && !opts.opponentName) {
      opts.setOpponentName(partes.parteContraria.nome);
    }

    const processo = analysisResult.processo;
    if (processo?.numero && !opts.processNumber) {
      opts.setProcessNumber(processo.numero);
    }
    if (processo?.vara && !opts.vara) {
      opts.setVara(processo.vara);
    }
    if (processo?.comarca && !opts.city) {
      opts.setCity(processo.comarca);
    }
  }, [analysisResult]);

  // =========================
  // HELPERS
  // =========================
  const clearDraft = useCallback(() => {
    setDraftText("");
  }, []);

  const copyDraft = useCallback(() => {
    if (draftText) {
      navigator.clipboard.writeText(draftText);
      toast({ title: "Copiado", description: "Minuta copiada para a área de transferência." });
    }
  }, [draftText, toast]);

  const copyPieceText = useCallback(() => {
    if (!generatedPiece) return;
    const { estrutura } = generatedPiece;
    const fullText = [
      "## FATOS",
      estrutura.fatos || "",
      "",
      "## FUNDAMENTOS JURÍDICOS",
      estrutura.fundamentos || "",
      "",
      "## PEDIDOS",
      estrutura.pedidos || "",
      estrutura.jurisprudenciaSugerida ? `\n## JURISPRUDÊNCIA SUGERIDA\n${estrutura.jurisprudenciaSugerida}` : "",
      estrutura.observacoesEstrategicas ? `\n## OBSERVAÇÕES ESTRATÉGICAS\n${estrutura.observacoesEstrategicas}` : "",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(fullText);
    toast({ title: "Copiado", description: "Texto da peça copiado para a área de transferência." });
  }, [generatedPiece, toast]);

  // Limpar sessão (para nova análise solta)
  const clearSession = useCallback(() => {
    sessionIdRef.current = null;
    currentAnalysisKeyRef.current = null;
  }, []);

  // =========================
  // API
  // =========================
  return {
    analysisResult,
    analysisLoading,
    runAnalysis,
    setAnalysisResult,

    draftText,
    draftLoading,
    generateDraft,
    setDraftText,
    clearDraft,
    copyDraft,

    generatedPiece,
    isGeneratingPiece,
    generatePiece,
    setGeneratedPiece,
    copyPieceText,

    autoCaseId,
    setAutoCaseId,

    // Novos exports para controle de sessão
    clearSession,
    currentAnalysisKey: currentAnalysisKeyRef.current,
    sessionId: sessionIdRef.current,
  };
}
