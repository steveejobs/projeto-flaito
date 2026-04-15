/**
 * Utilitários puros para o domínio jurídico do Flaito
 */

/**
 * Mapeia faseProcessual da NIJA para o stage (pipeline) do sistema
 */
export function mapFaseToStage(fase?: string): string | null {
  if (!fase) return null;
  const lower = fase.toLowerCase();
  if (lower.includes("pré") || lower.includes("extra") || lower.includes("administrativ")) return "pre_processual";
  if (lower.includes("conhecimento") || lower.includes("instrução") || lower.includes("inicial")) return "conhecimento";
  if (lower.includes("recurso") || lower.includes("recursal") || lower.includes("apelação")) return "recursal";
  if (lower.includes("execução") || lower.includes("cumprimento")) return "execucao";
  return null;
}

/**
 * Mapeia poloAtuacao da NIJA para o side (ATAQUE/DEFESA) do sistema
 */
export function mapPoloToSide(polo?: string): "ATAQUE" | "DEFESA" | null {
  if (!polo) return null;
  const normalized = polo.toUpperCase();
  if (normalized === "AUTOR") return "ATAQUE";
  if (normalized === "REU") return "DEFESA";
  return null;
}

/**
 * Verifica se um nome extraído contém ruído (termos processuais, endereço, etc)
 * Útil para filtrar resultados de IA/Regex que capturam texto demais do documento.
 */
export function hasNoiseInName(name: string | undefined | null): boolean {
  if (!name) return true;
  const normalized = name.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return true;
  
  // Regra de ouro: se for curto demais, é provavelmente ruído ou abreviação incompleta
  if (normalized.length < 8) return true;

  const noiseTerms = [
    "senhor", "juiz", "doutor", "vara", "comarca", "excelent", "página", "pagina", 
    "evento", "direito", "direitos", "processo", "eletrônico", "eletronico", 
    "através", "atraves", "mediante", "procurador", "endereço", "endereco", 
    "conforme", "respeitosamente", "presença", "presenca", "subscreve", "pessoa", 
    "jurídica", "juridica", "inscrita", "bairro", "cep", "estado", "jardim", 
    "campo grande", "rua bahia", "profissional", "fundações", "fundacoes", 
    "comunicações", "comunicacoes", "estilo", "mandato", "incluso", "abaixo", 
    "assinados", "propor", "presente"
  ];

  const regex = new RegExp(`(${noiseTerms.join("|")})`, "i");
  return regex.test(normalized);
}

/**
 * Verifica se o valor é uma palavra única (provavelmente nome incompleto)
 */
export function isSingleWord(val: string | undefined | null): boolean {
  if (!val) return true;
  const words = val.replace(/\s+/g, " ").trim().split(" ").filter(w => w.length > 2);
  return words.length <= 1;
}
