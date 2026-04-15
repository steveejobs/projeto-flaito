/**
 * shared/forensic-prompt-builder.ts
 * Constrói o prompt para o Auditor Forense
 */

export interface ErrorRule {
  rule_key: string;
  rule_description: string;
}

export async function buildForensicAuditPrompt(
  supabase: any,
  officeId: string,
  draftContent: string
): Promise<string> {
  // 1. Buscar regras de erro (Globais e Específicas do Escritório)
  const { data: rules } = await supabase
    .from("ai_error_rules")
    .select("rule_key, rule_description")
    .or(`office_id.is.null,office_id.eq.${officeId}`)
    .eq("active", true);

  const rulesList = rules?.map((r: ErrorRule) => `- [${r.rule_key}]: ${r.rule_description}`).join("\n") || "Nenhuma regra específica cadastrada.";

  return `
### PROTOCOLO OBRIGATÓRIO DE AUDITORIA FORENSE ###

Você é um Auditor Técnico de Elite especializado em conformidade jurídico-médica.
Sua missão é revisar criticamente o rascunho abaixo e identificar falhas.

[RASCUNHO A SER REVISADO]
${draftContent}

[CHECKLIST OBRIGATÓRIO DE VERIFICAÇÃO]
1. Erros gramaticais ou de digitação.
2. Imprecisões técnicas ou contradições internas.
3. Coerência argumentativa e clareza semântica.
4. Ausência de termos proibidos ou ambiguidade.
5. Melhor adequação ao tom de voz exigido.

[MEMÓRIA DE ERRO (REGRAS CRÍTICAS)]
${rulesList}

[INSTRUÇÕES DE SAÍDA]
Responda APENAS com um objeto JSON estruturado:
{
  "passed": boolean,
  "score": number (0-100),
  "issues": string[],
  "recommendations": string[]
}
`.trim();
}
