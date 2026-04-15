/**
 * response-refiner.ts
 * Aplica as correções sugeridas pelo Auditor Forense
 */

export async function refineResponse(
  draft: string,
  issues: string[],
  recommendations: string[],
  openai: any
): Promise<string> {
  const prompt = `
### MISSÃO: REFINAMENTO TÉCNICO FINAL ###

Você é um Refinador de Elite. Sua tarefa é aplicar correções em um rascunho jurídico-médico com base nas críticas de um auditor técnico.

[RASCUNHO ORIGINAL]
${draft}

[FALHAS DETECTADAS]
${issues.map(i => `- ${i}`).join("\n")}

[RECOMENDAÇÕES DE AJUSTE]
${recommendations.map(r => `- ${r}`).join("\n")}

[REGRAS DE OURO]
1. Corrija TODOS os erros gramaticais e de digitação.
2. Elimine qualquer ambiguidade ou contradição.
3. Garanta que o tom seja estritamente profissional e adequado ao contexto.
4. Mantenha os dados técnicos corretos, apenas melhore a forma e a precisão.
5. ENTREGUE APENAS O TEXTO REFINADO FINAL. NÃO COMENTE SOBRE AS ALTERAÇÕES.

Saída desejada: Texto completo e revisado.
`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3, // Menor criatividade, maior foco em correção
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("[ResponseRefiner] Erro no refinamento:", error);
    return draft; // Fallback para o draft se o refinamento falhar (último recurso)
  }
}
