import { describe, it, expect } from "vitest";
import { normalizeJudicialText, extractSeparadorData, extractPecasFromHeaders } from "../extraction/patterns";

describe("NIJA Smoke Test - End-to-End Pipeline Logic", () => {
  
  it("should complete the extraction flow from raw text to structured map without crash", () => {
    const rawContent = `
      PÁGINA DE SEPARAÇÃO
      Evento 1
      Evento: PETICAO_INICIAL
      Data: 01/01/2024
      
      Processo 0000000-00.2024.8.27.2706/TO, Evento 1, INIC1, Página 1
      Conteúdo da petição inicial...
      
      PÁGINA DE SEPARAÇÃO
      Evento 2
      Evento: DECISAO
      Data: 02/01/2024
      
      Processo 0000000-00.2024.8.27.2706/TO, Evento 2, DEC1, Página 5
    `;

    // 1. Normalização
    const normalized = normalizeJudicialText(rawContent);
    expect(normalized).toBeDefined();

    // 2. Extração de Separadores
    const separadores = extractSeparadorData(normalized);
    expect(separadores.size).toBe(2);
    expect(separadores.get(1)?.tipoEvento).toBe("PETICAO_INICIAL");

    // 3. Extração de Peças
    const pecas = extractPecasFromHeaders(normalized);
    expect(pecas.size).toBe(2);
    expect(pecas.get(1)?.[0].codigo).toBe("INIC1");

    // 4. Estrutura Final Inteira
    const finalStructure = {
      separadores: Array.from(separadores.entries()),
      pecas: Array.from(pecas.entries())
    };

    expect(finalStructure.separadores.length).toBe(2);
    expect(finalStructure.pecas.length).toBe(2);
  });
});
