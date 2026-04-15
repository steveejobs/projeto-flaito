// supabase/functions/_shared/jsonUtils.ts
/**
 * Utilitário robusco para extrair e parsear JSON de respostas de IA (GPT-4o, Gemini, etc.)
 */

export function extractJson(content: string): any {
  if (!content) return null;

  try {
    // 1. Limpeza rápida de blocos de código markdown
    const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Tenta parsear diretamente
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // 2. Fallback: Localizar o primeiro '{' e o último '}'
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonOnly = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonOnly);
      }
      
      // 3. Fallback final: Tentar localizar colchetes se for array
      const firstBracket = cleaned.indexOf("[");
      const lastBracket = cleaned.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket !== -1) {
        const jsonOnly = cleaned.substring(firstBracket, lastBracket + 1);
        return JSON.parse(jsonOnly);
      }
      
      throw e;
    }
  } catch (err: any) {
    console.error("[JSON-UTILS] Erro ao extrair JSON:", err.message);
    console.error("[JSON-UTILS] Conteúdo bruto:", content.substring(0, 500));
    throw new Error("A IA não retornou um formato JSON válido.");
  }
}
