import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
    requireResourceAccess, 
    requireOfficeMembership, 
    logAuditEvent 
} from "../_shared/auth.ts";
import { extractJson } from "../_shared/jsonUtils.ts";
import { ClinicalCopilotManager, ClinicalMode } from "../_shared/clinical-copilot.ts";

const ALLOWED_ORIGINS = Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") || ["*"];

const getCorsHeaders = (origin: string | null) => {
    const isAllowed = origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*"));
    return {
        "Access-Control-Allow-Origin": isAllowed ? origin! : (ALLOWED_ORIGINS[0] || ""),
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
};

Deno.serve(async (req: Request) => {
    const origin = req.headers.get("origin");
    const corsHeaders = getCorsHeaders(origin);
    let logPrefix = "[AGENT][INIT]";

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        const { pacienteId, inputText, tipoAnalise, agentType, imageUrl, clinicalMode } = payload;

        // 1. Autorização Zero Trust
        const auth = pacienteId 
            ? await requireResourceAccess(req, { resourceType: 'pacientes', resourceId: pacienteId, minRole: 'MEMBER' })
            : await requireOfficeMembership(req, "medical:analysis");

        if (!auth.ok || !auth.user || !auth.membership) {
            return (auth as any).response || new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { user, membership, adminClient } = auth;
        const officeId = membership.office_id;
        logPrefix = `[AGENT][Office:${officeId}][User:${user.uid}]`;

        const copilotManager = new ClinicalCopilotManager(adminClient);
        const effectiveMode: ClinicalMode = (clinicalMode === 'professional_assisted' && membership.role !== 'MEMBER') 
            ? 'professional_assisted' 
            : 'standard';

        // AUDIT: Início da análise
        await logAuditEvent(adminClient, {
            event_type: 'MEDICAL_AGENT_STARTED',
            actor_user_id: user.uid,
            office_id: officeId,
            patient_id: pacienteId,
            resource_type: 'medical_agent_analysis',
            action: 'create',
            metadata_json: { agent_type: agentType }
        });

        // 3. Resolver Configurações do Agente
        const { getAgentConfig } = await import("../_shared/agent-resolver.ts");
        const agentSlug = agentType === 'iridology' ? 'medical-iridology' : 'medical-clinical';
        
        const config = await getAgentConfig(adminClient, agentSlug, {
            office_id: officeId
        });

        if (!config || !config.is_active || config.resolution.is_blocked) {
            return new Response(JSON.stringify({ error: "Este agente médico está desativado." }), { 
                status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('VITE_OPENAI_API_KEY');
        if (!apiKey) throw new Error("IA Provider key missing.");

        // 4. Prompt System (Base + Config + Hardening)
        const P0_RULES = `
        ⚠️ REGRAS ÉTICAS MANDATÓRIAS (P0):
        1. VOCÊ É UM ASSISTENTE DE APOIO, NÃO É MÉDICO.
        2. PROIBIÇÃO DE DIAGNÓSTICO: Nunca afirme que o paciente "tem" uma doença. Use "quadro compatível com", "sugere necessidade de investigar".
        3. PROIBIÇÃO DE PRESCRIÇÃO: Nunca sugira doses ou tratamentos específicos.`;

        let baseSystemPrompt = (agentType === 'clinical') 
            ? `Atue como um Motor de Apoio Multidisciplinar. ${P0_RULES}`
            : `Você é um Analista de Padrões Iridológicos. ${P0_RULES}`;

        const finalSystemPrompt = config.system_prompt 
            ? `${baseSystemPrompt}\n\n=== INSTRUÇÕES ADICIONAIS ===\n${config.system_prompt}`
            : baseSystemPrompt;

        // 5. Chamar OpenAI
        const messages: any[] = [{ role: "system", content: finalSystemPrompt }];
        if (imageUrl) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: `Analise: ${inputText || 'Analise visual'}` },
                    { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
                ]
            });
        } else {
            messages.push({ role: "user", content: `Analise: ${inputText || 'Analise clínica.'}\nContexto: ${tipoAnalise || 'Geral'}` });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model || 'gpt-4o',
                messages: messages,
                temperature: config.temperature ?? 0.1,
                max_tokens: config.max_tokens ?? 4096,
            }),
        });

        if (!response.ok) throw new Error(`OpenAI Error: ${await response.text()}`);

        const openAiData = await response.json();
        const rawOutput = openAiData.choices[0]?.message?.content || "";
        
        // 6. Clinical Decision Safety Engine V3 + Governance Logic V4
        const { 
            enforceMedicalCapabilityV3, 
            assessMedicalDataCompleteness, 
            auditMedicalSafetyV3 
        } = await import("../_shared/medical-safety-v3.ts");

        const { fetchActiveGovernanceRestrictions } = await import("../_shared/medical-governance.ts");
        
        // Busca restrições ativas para este contexto (V4)
        const { severity: govSeverity, restrictions: activeRestrictions } = await fetchActiveGovernanceRestrictions(
            adminClient,
            officeId,
            user.uid,
            'ui'
        );
        
        // Avaliação de completude de dados
        const dataEvalInput = {
            patient_id: pacienteId,
            office_id: officeId,
            actor_user_id: user.uid,
            consent_status: payload.consentStatus ?? true,
            symptoms: payload.symptoms || (inputText ? [inputText] : []),
            age: payload.patientAge,
            duration: payload.symptomsDuration,
            history: payload.patientHistory,
            medications: payload.patientMedications,
            allergies: payload.patientAllergies,
            objective_findings: payload.objectiveFindings
        };

        const dataEval = assessMedicalDataCompleteness(dataEvalInput);

        const authorizedCapacity = (membership.role === 'OWNER' || membership.role === 'ADMIN') 
            ? 'treatment_suggestion' 
            : 'clinical_hypothesis';

        const safetyContext = {
            office_id: officeId,
            user_id: user.uid,
            actor_role: membership.role || 'MEMBER',
            patient_id: pacienteId,
            audience: (payload.audience === 'patient') ? 'patient' : ('professional' as any),
            context: (effectiveMode === 'professional_assisted' ? 'professional_assisted_mode' : (tipoAnalise === 'triage' ? 'triage_mode' : 'analysis_mode')) as any,
            channel: 'ui' as any,
            requested_capability: payload.requestedCapability || 'observational_summary',
            authorized_capacity: authorizedCapacity as any,
            consent_status: dataEvalInput.consent_status,
            function_slug: 'medical-agent-analysis'
        };

        // Extraímos confiança da IA se ela retornar no JSON
        const jsonOutput = extractJson(rawOutput);
        const aiConfidence = jsonOutput?.confidence ?? 0.85; // Default 0.85 se não especificado pela IA

        const safety = enforceMedicalCapabilityV3(
            safetyContext, 
            rawOutput, 
            aiConfidence, 
            dataEval
        );

        // Clinical Copilot V6: Preparar metadados de rascunho
        const draftMetadata = copilotManager.prepareProfessionalDraft(
            rawOutput,
            safety.requested_capability,
            effectiveMode
        );

        const finalContent = safety.blocked ? safety.sanitized_content : (safety.downgraded ? safety.sanitized_content : rawOutput);

        // Auditoria Expandida V3 + Copilot V6
        const { data: auditData } = await auditMedicalSafetyV3(adminClient, safetyContext, safety, dataEval, rawOutput);
        
        // Se temos rascunho, atualizar auditoria com metadados HITL
        if (auditData?.id) {
            await copilotManager.logDraftAudit(auditData.id, draftMetadata, finalContent);
        }

        if (safety.blocked || safety.downgraded) {
            await logAuditEvent(adminClient, {
                event_type: safety.blocked ? 'MEDICAL_SAFETY_V3_BLOCK' : 'MEDICAL_SAFETY_V3_DOWNGRADE',
                actor_user_id: user.uid,
                office_id: officeId,
                patient_id: pacienteId,
                resource_type: 'medical_agent_analysis',
                action: 'create',
                status: safety.blocked ? 'BLOCKED_SAFETY' : 'SUCCESS',
                metadata_json: { 
                    reason: safety.downgrade_reason, 
                    requested: safety.requested_capability,
                    effective: safety.effective_capability,
                    confidence: safety.confidence_score,
                    data_level: safety.data_completeness,
                    trace: safety.decision_trace,
                    is_downgraded: safety.downgraded
                }
            });
        }

        const finalJsonOutput = extractJson(finalContent);

        // 7. Persistência de Auditoria e Análise Clínica
        let backendAnalysisId = null;
        if (!safety.blocked && pacienteId) {
            const { data: insertedData } = await adminClient.from("medical_agent_analyses").insert({
                office_id: officeId,
                patient_id: pacienteId,
                agent_slug: agentSlug,
                input_text: inputText,
                ai_response: finalJsonOutput,
                requires_medical_review: safety.requires_medical_review,
                is_finalized: false,
                safety_v3_data: {
                    confidence: safety.confidence_score,
                    data_completeness: safety.data_completeness,
                    effective_capability: safety.effective_capability,
                    downgraded: safety.downgraded
                }
            }).select("id").single();

            if (insertedData) backendAnalysisId = insertedData.id;

            await logAuditEvent(adminClient, {
                event_type: 'MEDICAL_AGENT_COMPLETED',
                actor_user_id: user.uid,
                office_id: officeId,
                patient_id: pacienteId,
                resource_type: 'medical_agent_analysis',
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
            resultado: finalJsonOutput,
            _backend_analysis_id: backendAnalysisId,
            _safety_status: safety.blocked ? 'blocked' : (safety.downgraded ? 'downgraded' : 'pass'),
            _safety_v3: {
                effective_capability: safety.effective_capability,
                audience: safetyContext.audience,
                confidence_band: safety.confidence_band,
                data_completeness: safety.data_completeness,
                requires_review: safety.requires_medical_review || draftMetadata.review_status === 'pending',
                downgrade_reason: safety.downgrade_reason
            },
            _copilot: {
                mode: effectiveMode,
                review_status: draftMetadata.review_status,
                is_ai_generated: draftMetadata.is_ai_generated
            },
            _audit: { config_id: config.resolution.config_id }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(`${logPrefix} CRITICAL ERROR:`, error);
        return new Response(JSON.stringify({ error: "Erro interno no processamento de segurança clínica." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});

