/**
 * shared/office-ai-policy-resolver.ts
 * Resolve a política de IA ativa para um escritório
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export interface OfficeAiPolicy {
  office_id: string;
  forensic_mode_enabled: boolean;
  multi_stage_generation_enabled: boolean;
  block_unreviewed_output: boolean;
  max_refinement_attempts: number;
  low_temperature_mode: boolean;
  strict_grammar_check: boolean;
}

const DEFAULT_POLICY: Partial<OfficeAiPolicy> = {
  forensic_mode_enabled: true,
  multi_stage_generation_enabled: true,
  block_unreviewed_output: true,
  max_refinement_attempts: 2,
  low_temperature_mode: true,
  strict_grammar_check: true,
};

export async function resolveOfficeAiPolicy(
  supabase: any,
  officeId: string
): Promise<OfficeAiPolicy> {
  const { data, error } = await supabase
    .from("office_ai_policies")
    .select("*")
    .eq("office_id", officeId)
    .single();

  if (error || !data) {
    console.warn(`[PolicyResolver] Política não encontrada para office ${officeId}, usando default.`);
    return { office_id: officeId, ...DEFAULT_POLICY } as OfficeAiPolicy;
  }

  return data as OfficeAiPolicy;
}
