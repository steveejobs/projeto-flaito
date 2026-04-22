export interface ClientStudyContext {
  id: string;
  client_id: string;
  office_id: string;

  case_summary: string | null;
  current_objective: string | null;
  office_strategy: string | null;
  sensitive_facts: string | null;
  opposing_counsel_profile: string | null;
  judge_profile: string | null;
  procedural_posture: string | null;
  communication_recommendations: string | null;
  risk_notes: string | null;
  internal_observations: string | null;
  vertical_notes: string | null;
  vertical_type: "legal" | "medical";
  attachments_metadata: Record<string, unknown>[];

  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type ClientStudyContextUpsert = Omit<
  ClientStudyContext,
  "id" | "created_at" | "updated_at" | "created_by" | "updated_by"
>;

/** Fields that are injected into Athena's system prompt */
export const STUDY_CONTEXT_PROMPT_FIELDS = [
  { key: "case_summary", label: "Resumo do caso" },
  { key: "current_objective", label: "Objetivo atual" },
  { key: "office_strategy", label: "Estratégia do escritório" },
  { key: "sensitive_facts", label: "Fatos sensíveis" },
  { key: "opposing_counsel_profile", label: "Perfil da parte contrária" },
  { key: "judge_profile", label: "Perfil do juiz" },
  { key: "procedural_posture", label: "Postura processual" },
  { key: "communication_recommendations", label: "Recomendações de comunicação" },
  { key: "risk_notes", label: "Notas de risco" },
  { key: "internal_observations", label: "Observações internas" },
  { key: "vertical_notes", label: "Notas contextuais (jurídico/médico)" },
] as const;

/** Build a compact context string from study context, skipping empty fields */
export function buildCompactStudyContext(
  ctx: Partial<ClientStudyContext>
): Record<string, string> {
  const compact: Record<string, string> = {};
  for (const { key, label } of STUDY_CONTEXT_PROMPT_FIELDS) {
    const value = ctx[key as keyof ClientStudyContext];
    if (typeof value === "string" && value.trim()) {
      compact[label] = value.trim();
    }
  }
  return compact;
}
