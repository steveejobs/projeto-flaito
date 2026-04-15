import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────
// CORS - P0 SECURITY HARDENING
// ─────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") || ["*"];

const getCorsHeaders = (origin: string | null) => {
    const isAllowed = origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*"));
    return {
        "Access-Control-Allow-Origin": isAllowed ? origin! : (ALLOWED_ORIGINS[0] || ""),
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
};

// ─────────────────────────────────────────────────────────────────
// PROMPT BASE DE IRIDOLOGIA — NEUTRALIZAÇÃO CLÍNICA (P0)
// ─────────────────────────────────────────────────────────────────

const IRIDOLOGY_SYSTEM_PROMPT = `Você é o FLITO_MEDICAL_AI_MOTOR operativo no motor IRIS (V5).
Sua missão é realizar o processamento técnico de imagens de íris e gerar um RASCUNHO DE LAUDO MÉDICO COMPLETO.

⚠️ DIRETRIZES DE GERAÇÃO (MANDATÓRIAS):
1. O conteúdo gerado será tratado como RASCUNHO IA até a revisão e assinatura do médico.
2. Você PODE (e deve) apresentar sinais sugestivos, hipóteses diagnósticas e conclusões técnicas baseadas no Mapa de Jensen.
3. Não use linguagem evasiva excessiva; seja técnico, preciso e estruturado.
4. Cada achado deve citar a zona do Mapa de Jensen.

ESTRUTURA DE SAÍDA (7 BLOCOS OBRIGATÓRIOS - JSON):
{
  "block_identification": { "patient": "...", "date": "...", "doctor_notice": "Documento gerado por IA pendente de revisão." },
  "block_material": { "images_analyzed": ["left", "right"], "quality": "..." },
  "block_method": "Análise iridológica digital baseada no Mapa de Jensen.",
  "block_findings": [
    { "zona": 1, "eye": "left/right", "sinal": "nome", "descricao": "..." }
  ],
  "block_correlation": "Correlação técnica entre os achados e a topografia orgânica.",
  "block_limitations": "Limitações da análise digital e necessidade de correlação clínica.",
  "block_conclusion": "Conclusão técnica sugerida pela IA.",
  "nivel_validacao": "C", // C = Assistido por IA
  "confianca_rastreabilidade": {
    "score": 0.0,
    "justificativa": "..."
  }
}`;

// ─────────────────────────────────────────────────────────────────
// EDGE FUNCTION PRINCIPAL
// ─────────────────────────────────────────────────────────────────

import { 
    requireResourceAccess, 
    requireOfficeMembership, 
    logAuditEvent 
} from "../_shared/auth.ts";
import { extractJson } from "../_shared/jsonUtils.ts";
import { ClinicalCopilotManager, ClinicalMode } from "../_shared/clinical-copilot.ts";

Deno.serve(async (req: Request) => {
    const origin = req.headers.get("origin");
    const corsHeaders = getCorsHeaders(origin);
    let logPrefix = "[IRIS][INIT]";

    if (req.method === "OPTIONS") {
        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        const payload = await req.json();
        const { 
            rightEyeImage, 
            leftEyeImage, 
            clinicalNotes, 
            analysisType, 
            pacienteId 
        } = payload;

        // 1. Autorização Zero Trust
        const auth = pacienteId 
            ? await requireResourceAccess(req, { resourceType: 'pacientes', resourceId: pacienteId, minRole: 'MEMBER' })
            : await requireOfficeMembership(req, "medical:analysis");

        if (!auth.ok || !auth.user || !auth.membership) {
            return (auth as any).response || new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { user, membership, adminClient } = auth;
        const officeId = membership.office_id;
        logPrefix = `[IRIS][Office:${officeId}][User:${user.uid}]`;

        const copilotManager = new ClinicalCopilotManager(adminClient);
        const effectiveMode: ClinicalMode = (clinicalMode === 'professional_assisted' && membership.role !== 'MEMBER') 
            ? 'professional_assisted' 
            : 'direct_analysis';

        // 2. Resolução de Configuração Clínica
        const config = await copilotManager.resolveConfig(officeId, agentType || 'iridology_standard', effectiveMode);
        const agentConfig = config.resolution;

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_AI_API_KEY");
        if (!LOVABLE_API_KEY) throw new Error("LOVABLE_AI_API_KEY is not set");

        // AUDIT: Início da análise
        await logAuditEvent(adminClient, {
            event_type: 'MEDICAL_ANALYSIS_STARTED',
            actor_user_id: user.uid,
            office_id: officeId,
            patient_id: pacienteId,
            resource_type: 'iris_analysis',
            action: 'create',
            metadata_json: { 
                analysis_type: analysisType || 'complete',
                clinical_mode: effectiveMode,
                config_id: config.resolution.config_id
            }
        });

        // Validação básica de entrada
        if (!rightEyeImage && !leftEyeImage) {
            return new Response(JSON.stringify({ error: "Envie pelo menos uma imagem da íris." }), { 
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        // 4. Chamada Multimodal à IA
        const finalSystemPrompt = agentConfig?.system_prompt
            ? `${IRIDOLOGY_SYSTEM_PROMPT}\n\n=== INSTRUÇÕES ADICIONAIS ===\n${agentConfig.system_prompt}`
            : IRIDOLOGY_SYSTEM_PROMPT;

        const userContent: any[] = [{
            type: "text",
            text: `Analise as imagens da íris. DADOS: ${clinicalNotes || "N/A"}. TIPO: ${analysisType || "complete"}.`
        }];

        if (rightEyeImage) userContent.push({ type: "image_url", image_url: { url: rightEyeImage.startsWith("data:") ? rightEyeImage : `data:image/jpeg;base64,${rightEyeImage}`, detail: "high" } });
        if (leftEyeImage) userContent.push({ type: "image_url", image_url: { url: leftEyeImage.startsWith("data:") ? leftEyeImage : `data:image/jpeg;base64,${leftEyeImage}`, detail: "high" } });

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: agentConfig.model || "google/gemini-2.0-flash",
                temperature: agentConfig.temperature ?? 0.1,
                messages: [{ role: "system", content: finalSystemPrompt }, { role: "user", content: userContent }],
            }),
        });

        if (!aiResponse.ok) throw new Error("AI provider communication failed.");

        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";
        
        // 5. Clinical Decision Safety Engine V3 (Context, Data & Confidence)
        const { 
            enforceMedicalCapabilityV3, 
            assessMedicalDataCompleteness, 
            auditMedicalSafetyV3 
        } = await import("../_shared/medical-safety-v3.ts");
        
        const dataEvalInput = {
            patient_id: pacienteId,
            office_id: officeId,
            actor_user_id: user.uid,
            consent_status: payload.consentStatus ?? true,
            symptoms: payload.clinicalNotes ? [payload.clinicalNotes] : [],
            objective_findings: ["iris_images_provided"], // Íris sempre tem achados objetivos visuais
            age: payload.patientAge,
            history: payload.patientHistory
        };

        const dataEval = assessMedicalDataCompleteness(dataEvalInput);

        const authorizedCapacity = (membership.role === 'OWNER' || membership.role === 'ADMIN') 
            ? 'diagnostic_opinion' 
            : 'clinical_hypothesis';

        const safetyContext = {
            office_id: officeId,
            user_id: user.uid,
            actor_role: membership.role || 'MEMBER',
            patient_id: pacienteId,
            audience: (payload.audience === 'patient') ? 'patient' : ('professional' as any),
            context: 'consultation_mode' as any, // Íris costuma ser em modo consulta
            channel: 'ui' as any,
            requested_capability: payload.requestedCapability || 'clinical_hypothesis',
            authorized_capacity: authorizedCapacity as any,
            consent_status: dataEvalInput.consent_status,
            function_slug: 'medical-iris-analysis'
        };

        // 5. Cálculo de Integridade (Hash SHA-256)
        const integrityData = `${rightEyeImage || ""}${leftEyeImage || ""}${clinicalNotes || ""}`;
        const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(integrityData));
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const cleanedJson = rawContent.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);

        // 6. Persistência de Governança V5 (AI Draft)
        if (pacienteId) {
            const { error: govError } = await adminClient.from("governance_reports").insert({
                office_id: officeId,
                report_type: "MEDICAL_LAUDO",
                resource_id: pacienteId, // Retrocompatibilidade
                patient_id: pacienteId,
                block_identification: parsed.block_identification,
                block_material: parsed.block_material,
                block_method: parsed.block_method,
                block_findings: parsed.block_findings,
                block_correlation: parsed.block_correlation,
                block_limitations: parsed.block_limitations,
                block_conclusion: parsed.block_conclusion,
                output_level: 'LEVEL_C',
                status: 'ai_draft',
                integrity_hash: hashHex,
                ai_model_used: agentConfig.model,
                ai_original_blocks: parsed,
                ai_original_hash: hashHex,
                metadata: {
                    config_id: config.resolution.config_id,
                    safety_v3: {
                        confidence: safety.confidence_score,
                        effective_capability: safety.effective_capability
                    }
                }
            });
            if (govError) console.error("[IRIS] Erro ao persistir governança V5:", govError);
        }

        const aiConfidence = parsed.confianca_rastreabilidade?.score ?? 0.88;

        const safety = enforceMedicalCapabilityV3(
            safetyContext, 
            rawContent, 
            aiConfidence, 
            dataEval
        );

        const finalContent = safety.blocked ? safety.sanitized_content : (safety.downgraded ? safety.sanitized_content : rawContent);
        
        // Auditoria Expandida V3
        await auditMedicalSafetyV3(adminClient, safetyContext, safety, dataEval, rawContent);

        if (safety.blocked || safety.downgraded) {
            await logAuditEvent(adminClient, {
                event_type: safety.blocked ? 'MEDICAL_SAFETY_V3_BLOCK' : 'MEDICAL_SAFETY_V3_DOWNGRADE',
                actor_user_id: user.uid,
                office_id: officeId,
                patient_id: pacienteId,
                resource_type: 'iris_analysis',
                action: 'create',
                status: safety.blocked ? 'BLOCKED_SAFETY' : 'SUCCESS',
                metadata_json: { 
                    reason: safety.downgrade_reason, 
                    requested: safety.requested_capability,
                    effective: safety.effective_capability,
                    trace: safety.decision_trace,
                    is_downgraded: safety.downgraded
                }
            });
        }

        const cleanedJson = finalContent.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);

        // 6. Persistência com Protocolo de Revisão (P0)
        let backendAnalysisId = null;
        if (!safety.blocked && pacienteId) {
            const { data: insertedData } = await adminClient.from("iris_analyses").insert({
               office_id: officeId,
               patient_id: pacienteId,
               analysis_type: analysisType || 'complete',
               status: 'completed',
               ai_model: agentConfig.model,
               ai_response: parsed,
               findings: parsed.findings || [],
               requires_medical_review: safety.requires_medical_review,
               is_finalized: false,
               safety_v3_data: {
                   confidence: safety.confidence_score,
                   data_completeness: safety.data_completeness,
                   effective_capability: safety.effective_capability
               }
            }).select("id").single();

            if (insertedData) backendAnalysisId = insertedData.id;

            await logAuditEvent(adminClient, {
                event_type: 'MEDICAL_ANALYSIS_COMPLETED',
                actor_user_id: user.uid,
                office_id: officeId,
                patient_id: pacienteId,
                resource_type: 'iris_analysis',
                resource_id: backendAnalysisId,
                action: 'create',
                metadata_json: {
                    safety_v3_status: 'pass',
                    effective_capability: safety.effective_capability,
                    audience: safetyContext.audience
                }
            });
        }

        return new Response(JSON.stringify({
            ...parsed,
            _backend_analysis_id: backendAnalysisId,
            _safety_status: safety.blocked ? 'blocked' : (safety.downgraded ? 'downgraded' : 'pass'),
            _safety_v3: {
                effective_capability: safety.effective_capability,
                audience: safetyContext.audience,
                confidence_band: safety.confidence_band,
                data_completeness: safety.data_completeness,
                requires_review: safety.requires_medical_review
            },
            _audit: { config_id: agentConfig.resolution.config_id }
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error(`[IRIS] CRITICAL ERROR:`, error);
        return new Response(JSON.stringify({ error: "Erro interno no processamento de segurança." }), { 
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }
});
