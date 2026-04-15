/**
 * forensic-validator.ts
 * Realiza a auditoria técnica do conteúdo gerado
 */

import { buildForensicAuditPrompt } from "../_shared/forensic-prompt-builder.ts";

export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
}

export async function validateContent(
  supabase: any,
  officeId: string,
  content: string,
  openai: any
): Promise<ValidationResult> {
  const prompt = await buildForensicAuditPrompt(supabase, officeId, content);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1, // Rigor máximo
    });

    const result = JSON.parse(response.choices[0].message.content) as ValidationResult;
    
    console.log(`[ForensicValidator] Auditoria concluída. Score: ${result.score}, Passou: ${result.passed}`);
    
    return result;
  } catch (error) {
    console.error("[ForensicValidator] Erro na auditoria forense:", error);
    // Em caso de erro técnico na auditoria, reprovamos por precaução
    return {
      passed: false,
      score: 0,
      issues: ["Erro técnico durante o processo de auditoria forense."],
      recommendations: ["Repetir a geração ou verificar logs do sistema."]
    };
  }
}
