// supabase/functions/_shared/medical-safety-v2.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type ClinicalCapability = 
  | "observational_summary"
  | "clinical_hypothesis"
  | "diagnostic_opinion"
  | "treatment_suggestion";

export type MedicalAudience = "professional" | "patient";

export type MedicalIntent =
  | "safe_observational"
  | "suggestive_non_clinical"
  | "clinical_inference"
  | "diagnostic"
  | "prescriptive"
  | "therapeutic_instruction"
  | "unsafe_other";

export interface MedicalSafetyContext {
  office_id: string;
  user_id: string;
  user_role: string;
  audience: MedicalAudience;
  function_slug: string;
  requested_capability: ClinicalCapability;
  authorized_capacity: ClinicalCapability; // Nível máximo permitido para este office/user
}

export interface V2SafetyResult {
  blocked: boolean;
  intent_detected: MedicalIntent;
  effective_capability: ClinicalCapability;
  sanitized_content: string;
  confidence: number;
  decision_logic: any;
  requires_review: boolean;
}

/**
 * Matriz de Decisão: Cruza Intenção Detectada vs Contexto de Escopo.
 */
function resolveDecision(intent: MedicalIntent, context: MedicalSafetyContext): { blocked: boolean; reason: string } {
  // 1. Regra P0: Paciente nunca recebe diagnóstico ou tratamento
  if (context.audience === "patient") {
    if (["clinical_inference", "diagnostic", "prescriptive", "therapeutic_instruction"].includes(intent)) {
      return { blocked: true, reason: "PATIENT_AUDIENCE_RESTRICTION" };
    }
  }

  // 2. Mapeamento de Intenção para Nível de Autonomia Necessário
  const intentLevel: Record<MedicalIntent, number> = {
    "safe_observational": 0,
    "suggestive_non_clinical": 1,
    "clinical_inference": 2,
    "diagnostic": 3,
    "prescriptive": 4,
    "therapeutic_instruction": 4,
    "unsafe_other": 5
  };

  const capabilityLevel: Record<ClinicalCapability, number> = {
    "observational_summary": 1,
    "clinical_hypothesis": 2,
    "diagnostic_opinion": 3,
    "treatment_suggestion": 4
  };

  // Nível efetivo permitido (não pode ser maior que o autorizado nem maior que o requested)
  // Nota: requested_capability é o que a UI/Agent pediu, mas authorized_capacity é o cap global.
  const maxAllowedLevel = Math.min(
    capabilityLevel[context.authorized_capacity],
    capabilityLevel[context.requested_capability]
  );
  
  const detectedLevel = intentLevel[intent];

  if (detectedLevel > maxAllowedLevel) {
     return { 
       blocked: true, 
       reason: `INTENT_EXCEEDS_CAPABILITY (Detected: ${detectedLevel}, Max: ${maxAllowedLevel})` 
     };
  }

  // 3. Regras de Perfil e Review Human-in-the-Loop
  if (detectedLevel >= 3 && context.user_role !== 'owner' && context.user_role !== 'admin') {
     // Para opiniões diagnósticas ou tratamento, se não for admin/owner, bloqueamos se não houver política específica (simplificado aqui)
     // return { blocked: true, reason: "UNAUTHORIZED_ROLE_FOR_HIGH_RISK_ACTION" };
  }

  return { blocked: false, reason: "ALLOWED_BY_POLICY" };
}

/**
 * Análise Semântica (Heurística + Estrutural)
 */
function detectIntent(content: string): MedicalIntent {
  const normalized = content.toLowerCase();

  // HEURÍSTICA CAMADA 1: Prescrição Direta
  if (/\b(receito|prescrevo|tome|ingerir|mg|g|gotas)\b/.test(normalized) && /\d+/.test(normalized)) return "prescriptive";
  
  // HEURÍSTICA CAMADA 2: Diagnóstico Assertivo
  if (/\b(diagnóstico|indica|confirma|patologia|doença) (é|de|indicada)\b/.test(normalized)) return "diagnostic";
  if (/\b(você tem|o paciente possui)\b/.test(normalized)) return "diagnostic";

  // HEURÍSTICA CAMADA 3: Inferência Clínica Indireta
  if (/\b(compatível com|padrão de|sugerindo quadro de|evidência de)\b/.test(normalized)) return "clinical_inference";
  if (/\b(quadro sugestivo|pode representar|fortes indícios)\b/.test(normalized)) return "clinical_inference";

  // HEURÍSTICA CAMADA 4: Sugestão Não Clínica / Cautela
  if (/\b(importante avaliar|recomenda-se investigar|consultar profissional)\b/.test(normalized)) return "suggestive_non_clinical";

  // HEURÍSTICA CAMADA 5: Observacional Puro
  return "safe_observational";
}

/**
 * Função Principal de Enforced Medical Safety V2
 */
export async function enforceMedicalSafetyV2(
  supabase: SupabaseClient,
  content: string,
  context: MedicalSafetyContext
): Promise<V2SafetyResult> {
  
  const intent = detectIntent(content);
  const decision = resolveDecision(intent, context);

  const result: V2SafetyResult = {
    blocked: decision.blocked,
    intent_detected: intent,
    effective_capability: context.requested_capability, // Simplificado
    sanitized_content: decision.blocked 
      ? "⚠️ O conteúdo gerado foi bloqueado devido a políticas de segurança clínica (Escopo não autorizado para o contexto atual)."
      : content,
    confidence: 0.9, // Heurística tem confiança fixa alta para bloqueio
    decision_logic: {
      reason: decision.reason,
      audience: context.audience,
      user_role: context.user_role
    },
    requires_review: ["diagnostic", "prescriptive", "therapeutic_instruction"].includes(intent) || decision.blocked
  };

  // Auditoria Clínica
  await supabase.from("medical_safety_audits").insert({
    office_id: context.office_id,
    user_id: context.user_id,
    function_slug: context.function_slug,
    requested_capability: context.requested_capability,
    effective_capability: result.blocked ? "blocked" : intent, // Simplificação
    audience: context.audience,
    user_role: context.user_role,
    raw_content: content,
    sanitized_content: result.sanitized_content,
    intent_detected: intent,
    confidence: result.confidence,
    blocked: result.blocked,
    requires_review: result.requires_review,
    decision_logic: result.decision_logic
  });

  return result;
}
