/**
 * piece-generation-orchestrator.ts
 * Orquestrador obrigatório para o Protocolo de Validação Interna
 */

import { validateContent } from "./forensic-validator.ts";
import { refineResponse } from "./response-refiner.ts";
import { resolveOfficeAiPolicy } from "../_shared/office-ai-policy-resolver.ts";
import { checkQuota, consumeQuota } from "../_shared/quota-enforcer.ts";

export interface GenerationInput {
  officeId: string;
  pieceType: string;
  requestId?: string;
  draftGenerator: () => Promise<string>;
}

export interface GenerationOutput {
  id: string;
  content: string;
  validationScore: number;
}

export async function orchestrateGeneration(
  supabase: any,
  openai: any,
  input: GenerationInput
): Promise<GenerationOutput> {
  const { officeId, pieceType, requestId, draftGenerator } = input;

  // 1. Resolver Política e Verificar Quota
  const policy = await resolveOfficeAiPolicy(supabase, officeId);
  const { allowed } = await checkQuota(supabase, officeId, "legal_pieces");

  if (!allowed) {
    throw new Error("Quota insuficiente para geração de nova peça.");
  }

  // 2. Geração do Rascunho Bruto (Draft)
  console.log(`[Orchestrator] Gerando rascunho bruto para ${pieceType}...`);
  const draft = await draftGenerator();

  // 3. Auditoria Forense (Validation)
  let finalContent = draft;
  let validationResult = { passed: true, score: 100, issues: [] as string[], recommendations: [] as string[] };
  let refinementAttempts = 0;

  if (policy.forensic_mode_enabled) {
    console.log(`[Orchestrator] Iniciando Auditoria Forense...`);
    validationResult = await validateContent(supabase, officeId, draft, openai);

    // 4. Refinamento Obrigatório se não passar ou se política exigir
    if (!validationResult.passed || (policy.block_unreviewed_output && validationResult.score < 90)) {
      console.log(`[Orchestrator] Refinamento exigido (Score: ${validationResult.score})...`);
      finalContent = await refineResponse(draft, validationResult.issues, validationResult.recommendations, openai);
      refinementAttempts = 1;
      
      // Re-validar a versão refinada se necessário (opcional conforme política)
    }
  }

  // 5. Persistir Logs de Validação (Invisível ao Usuário)
  const { data: logEntry } = await supabase
    .from("ai_validation_logs")
    .insert({
      office_id: officeId,
      piece_type: pieceType,
      request_id: requestId,
      draft_version: draft,
      final_version: finalContent,
      validation_passed: validationResult.passed,
      validation_scores: { score: validationResult.score },
      issues_detected: validationResult.issues,
      refinement_attempts: refinementAttempts,
    })
    .select()
    .single();

  // 6. Consumir Quota
  await consumeQuota(supabase, officeId, "legal_pieces", {
    forensic_reviews: 1,
    refinement_cycles: refinementAttempts
  });

  console.log(`[Orchestrator] Ciclo completo para a peça ${logEntry?.id}`);

  return {
    id: logEntry?.id || "unknown",
    content: finalContent,
    validationScore: validationResult.score
  };
}
