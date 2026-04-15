// supabase/functions/_shared/medical-safety-v3.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Níveis de Capacidade Clínica (Hierarquia de Risco)
 */
export type MedicalCapability =
  | "observational_summary" // Nível 1: Apenas fatos observados
  | "clinical_hypothesis"  // Nível 2: Hipóteses e diferenciais
  | "diagnostic_opinion"   // Nível 3: Opinião diagnóstica assertiva (P0 Risk)
  | "treatment_suggestion" // Nível 4: Sugestão de conduta/tratamento (Extreme Risk)
  | "report_draft"         // V6: Rascunho de laudo profissional
  | "prescription_draft"   // V6: Rascunho de prescrição profissional
  | "followup_plan";      // V6: Rascunho de plano de acompanhamento

/**
 * Contextos de Execução Clínica
 */
export type ClinicalContext =
  | "analysis_mode"
  | "consultation_mode"
  | "triage_mode"
  | "administrative_mode"
  | "voice_quick_action"
  | "patient_self_view"
  | "medical_review_queue"
  | "professional_assisted_mode"; // V6: Modo Copiloto Assistido

/**
 * Canais de Entrega
 */
export type DeliveryChannel =
  | "ui"
  | "voice"
  | "internal_api"
  | "patient_portal"
  | "whatsapp"
  | "report_export";

/**
 * Níveis de Confiança da IA
 */
export type ConfidenceBand = "low" | "medium" | "high";

/**
 * Níveis de Completude de Dados
 */
export type DataCompleteness =
  | "insufficient"
  | "partial"
  | "sufficient"
  | "rich";

export interface GovernanceRestriction {
  type: 'restrict_capability' | 'suspend_channel' | 'force_review';
  capability?: MedicalCapability;
  channel?: DeliveryChannel;
  reason: string;
}

export interface MedicalSafetyContextV3 {
  office_id: string;
  user_id: string;
  actor_role: string;
  patient_id?: string;
  audience: "professional" | "patient";
  context: ClinicalContext;
  channel: DeliveryChannel;
  requested_capability: MedicalCapability;
  authorized_capacity: MedicalCapability;
  consent_status: boolean;
  function_slug: string;
  active_restrictions?: GovernanceRestriction[];
  governance_severity?: "info" | "warning" | "high" | "critical" | "operational";
}

export interface SafetyDecisionV3 {
  blocked: boolean;
  requested_capability: MedicalCapability;
  effective_capability: MedicalCapability | "blocked";
  sanitized_content: string;
  confidence_score: number;
  confidence_band: ConfidenceBand;
  data_completeness: DataCompleteness;
  requires_medical_review: boolean;
  downgraded: boolean;
  downgrade_reason?: string;
  decision_trace: string[];
  flags: string[];
}

/**
 * 1. Avaliação de Completude de Dados (Gates de Segurança)
 */
export function assessMedicalDataCompleteness(payload: any): { 
  level: DataCompleteness; 
  score: number; 
  missing_fields: string[];
} {
  const missing_fields: string[] = [];
  let score = 0;

  // Critérios Base (Essenciais)
  const hasBase = payload.patient_id && payload.office_id && payload.actor_user_id && payload.consent_status;
  if (!hasBase) missing_fields.push("base_metadata");
  
  const hasSymptoms = payload.symptoms && payload.symptoms.length > 0;
  if (!hasSymptoms) missing_fields.push("symptoms");

  // Se não tem base ou sintomas, é insuficiente
  if (!hasBase || !hasSymptoms) {
     return { level: "insufficient", score: 0.1, missing_fields };
  }

  // Pesos para escalonamento
  if (hasSymptoms) score += 0.2;
  if (payload.age) score += 0.1;
  if (payload.duration || payload.temporal_context) score += 0.1;
  if (payload.history) score += 0.1;
  if (payload.medications) score += 0.1;
  if (payload.allergies) score += 0.1;
  if (payload.objective_findings) score += 0.2;
  if (payload.context_richness) score += 0.1;

  // Determinar Nível
  let level: DataCompleteness = "insufficient";
  
  // Gate clinical_hypothesis: sintomas, idade, duração, histórico
  const hasHypothesisReqs = hasSymptoms && payload.age && (payload.duration || payload.temporal_context) && payload.history;
  
  // Gate diagnostic_opinion: hypothesis reqs + medicações/alergias + achados objetivos
  const hasDiagnosticReqs = hasHypothesisReqs && payload.medications && payload.allergies && payload.objective_findings;

  if (hasDiagnosticReqs && score >= 0.8) level = "rich";
  else if (hasDiagnosticReqs) level = "sufficient";
  else if (hasHypothesisReqs) level = "partial";
  else level = "insufficient";

  return { level, score, missing_fields };
}

/**
 * 2. Motor de Decisão e Enforcement V3 + Governance Logic V4
 */
export function enforceMedicalCapabilityV3(
  context: MedicalSafetyContextV3,
  raw_content: string,
  ai_confidence: number,
  data_eval: { level: DataCompleteness; score: number }
): SafetyDecisionV3 {
  const trace: string[] = [];
  const flags: string[] = [];
  let effective: MedicalCapability | "blocked" = context.requested_capability;
  let downgraded = false;
  let downgrade_reason = "";
  let blocked = false;

  // Níveis numéricos para comparação
  const levels: Record<MedicalCapability, number> = {
    "observational_summary": 1,
    "clinical_hypothesis": 2,
    "diagnostic_opinion": 3,
    "treatment_suggestion": 4,
    "report_draft": 3,      // Equivalente a opinião diagnóstica em risco
    "prescription_draft": 4, // Equivalente a sugestão de tratamento em risco
    "followup_plan": 2      // Equivalente a hipótese clínica
  };

  // Resolvendo Banda de Confiança
  let confidence_band: ConfidenceBand = "low";
  if (ai_confidence >= 0.75) confidence_band = "high";
  else if (ai_confidence >= 0.45) confidence_band = "medium";

  // ─────────────────────────────────────────────────────────────────
  // REGRA 0: Governança V4 - Restrições Temporárias Ativas
  // ─────────────────────────────────────────────────────────────────
  if (context.active_restrictions && context.active_restrictions.length > 0) {
    for (const restriction of context.active_restrictions) {
      // Bloqueio de Canal
      if (restriction.type === 'suspend_channel' && restriction.channel === context.channel) {
        effective = "blocked";
        blocked = true;
        downgraded = true;
        downgrade_reason = "GOVERNANCE_CHANNEL_SUSPENSION";
        trace.push(`Critical: Channel ${context.channel} is temporarily suspended for this scope.`);
      }
      
      // Restrição de Capability
      if (restriction.type === 'restrict_capability' && restriction.capability) {
        if (levels[effective as MedicalCapability] > levels[restriction.capability]) {
          effective = restriction.capability;
          downgraded = true;
          downgrade_reason = `GOVERNANCE_CAPABILITY_RESTRICTION_${restriction.capability.toUpperCase()}`;
          trace.push(`Governance: Downgraded to ${restriction.capability} due to temporary risk restriction.`);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // REGRA 1: Consentimento Ativo
  // ─────────────────────────────────────────────────────────────────
  if (!context.consent_status) {
    flags.push("NO_CONSENT");
    if (levels[effective as MedicalCapability] > 1) {
      effective = "observational_summary";
      downgraded = true;
      downgrade_reason = "LACK_OF_ACTIVE_CONSENT";
      trace.push("Downgrade to observational due to no consent.");
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // REGRA 2: Restrições de Canal e Contexto Administrativo
  // ─────────────────────────────────────────────────────────────────
  if (context.channel === "patient_portal" || context.context === "patient_self_view" || context.context === "administrative_mode") {
    if (levels[effective as MedicalCapability] > 1) {
      effective = "observational_summary";
      downgraded = true;
      downgrade_reason = "CHANNEL_RESTRICTION_PATIENT_OR_ADMIN";
      trace.push(`Restricting to observational for channel: ${context.channel} or context: ${context.context}`);
    }
  }

  if (context.channel === "voice" || context.channel === "whatsapp") {
    // Max observational; Clinical Hypothesis só interno e com review
    if (effective !== "blocked" && levels[effective as MedicalCapability] > 2) {
      effective = "clinical_hypothesis";
      downgraded = true;
      downgrade_reason = "VOICE_WHATSAPP_RESTRICTION";
      trace.push("Restricting to clinical_hypothesis for high-risk channels (Voice/WhatsApp).");
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // REGRA 3: Gates de Completude de Dados
  // ─────────────────────────────────────────────────────────────────
  if (effective !== "blocked") {
    const isProfessionalAssisted = context.context === "professional_assisted_mode";

    if (data_eval.level === "insufficient") {
      if (levels[effective as MedicalCapability] > 1) {
        if (isProfessionalAssisted && context.audience === "professional") {
          // No modo assistido para profissionais, permitimos o rascunho com flag de review crítico
          flags.push("COPILOT_DRAFT_INSUFFICIENT_DATA");
          trace.push("Copilot: Allowing draft despite insufficient data (Professional Mode).");
        } else {
          effective = "observational_summary";
          downgraded = true;
          downgrade_reason = "INSUFFICIENT_DATA_FOR_CLINICAL_INFERENCE";
        }
      }
    } else if (data_eval.level === "partial") {
      if (levels[effective as MedicalCapability] > 2) {
        if (isProfessionalAssisted && context.audience === "professional") {
          flags.push("COPILOT_DRAFT_PARTIAL_DATA");
          trace.push("Copilot: Allowing draft with partial data (Professional Mode).");
        } else {
          effective = "clinical_hypothesis";
          downgraded = true;
          downgrade_reason = "PARTIAL_DATA_DOWNGRADE";
        }
      }
    } else if (data_eval.level === "sufficient") {
      if (levels[effective as MedicalCapability] > 3) {
        if (isProfessionalAssisted && context.audience === "professional") {
          flags.push("COPILOT_DRAFT_SUFFICIENT_DATA");
        } else {
          effective = "diagnostic_opinion";
          downgraded = true;
          downgrade_reason = "DATA_NOT_RICH_FOR_TREATMENT";
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // REGRA 4: Confiança da IA
  // ─────────────────────────────────────────────────────────────────
  if (effective !== "blocked") {
    if (confidence_band === "low") {
      if (levels[effective as MedicalCapability] > 1) {
        effective = "observational_summary";
        downgraded = true;
        downgrade_reason = "LOW_AI_CONFIDENCE";
      }
    } else if (confidence_band === "medium") {
      if (levels[effective as MedicalCapability] > 2) {
        effective = "clinical_hypothesis";
        downgraded = true;
        downgrade_reason = "MEDIUM_AI_CONFIDENCE_LIMIT";
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // REGRA 5: Autorização Global (Authorized Capacity)
  // ─────────────────────────────────────────────────────────────────
  if (effective !== "blocked" && levels[effective as MedicalCapability] > levels[context.authorized_capacity]) {
    effective = context.authorized_capacity;
    downgraded = true;
    downgrade_reason = "USER_ROLE_CAPACITY_LIMIT";
  }

  // ─────────────────────────────────────────────────────────────────
  // REGRA 6: Consult Mode para Tratamento
  // ─────────────────────────────────────────────────────────────────
  if (effective === "treatment_suggestion" && context.context !== "consultation_mode") {
    effective = "clinical_hypothesis";
    downgraded = true;
    downgrade_reason = "TREATMENT_ONLY_ALLOWED_IN_CONSULTATION_MODE";
  }

  // ─────────────────────────────────────────────────────────────────
  // FINALIZAÇÃO: Bloqueio e Review
  // ─────────────────────────────────────────────────────────────────
  
  // Se após todos os downgrades ainda estamos tentando algo perigoso para o canal/audiência
  if (context.audience === "patient" && effective !== "blocked" && levels[effective as MedicalCapability] > 1) {
    effective = "blocked";
    blocked = true;
    trace.push("Critical: Patient audience cannot receive clinical inference.");
  }

  const decision: SafetyDecisionV3 = {
    blocked: effective === "blocked" || blocked,
    requested_capability: context.requested_capability,
    effective_capability: effective,
    sanitized_content: (effective === "blocked") 
      ? "⚠️ Conteúdo bloqueado por política de segurança clínica."
      : (downgraded ? `⚠️ Conteúdo ajustado por política de segurança clínica.\n\n${raw_content}` : raw_content),
    confidence_score: ai_confidence,
    confidence_band,
    data_completeness: data_eval.level,
    requires_medical_review: effective !== "observational_summary" && effective !== "blocked",
    downgraded,
    downgrade_reason,
    decision_trace: trace,
    flags
  };

  // AJUSTE GOVERNANÇA HIGH (V4 Ajuste Obrigatório 1): Review Adicional apenas para Sensíveis
  if (context.governance_severity === "high") {
    const isSensitive = ["clinical_hypothesis", "diagnostic_opinion", "treatment_suggestion"].includes(effective);
    if (isSensitive) {
      decision.requires_medical_review = true;
      decision.flags.push("GOVERNANCE_HIGH_MANDATORY_REVIEW");
    }
  }

  // Review Obrigatório específico por Canal
  if ((context.channel === "voice" || context.channel === "whatsapp") && effective === "clinical_hypothesis") {
    decision.requires_medical_review = true;
  }

  return decision;
}

/**
 * 3. Função de Auditoria Expandida
 */
export async function auditMedicalSafetyV3(
  supabase: SupabaseClient,
  context: MedicalSafetyContextV3,
  decision: SafetyDecisionV3,
  data_eval: any,
  raw_content: string
) {
  return await supabase.from("medical_safety_audits").insert({
    office_id: context.office_id,
    user_id: context.user_id,
    patient_id: context.patient_id,
    function_slug: context.function_slug,
    requested_capability: context.requested_capability,
    effective_capability: decision.effective_capability,
    audience: context.audience,
    channel: context.channel,
    clinical_context: context.context,
    confidence_score: decision.confidence_score,
    confidence_band: decision.confidence_band,
    data_completeness: decision.data_completeness,
    data_completeness_score: data_eval.score,
    missing_fields: data_eval.missing_fields,
    blocked: decision.blocked,
    downgraded: decision.downgraded,
    downgrade_reason: decision.downgrade_reason,
    requires_medical_review: decision.requires_medical_review,
    actor_role: context.actor_role,
    consent_status: context.consent_status,
    raw_content: raw_content,
    sanitized_content: decision.sanitized_content,
    decision_trace: decision.decision_trace,
    flags: decision.flags
  });
}
