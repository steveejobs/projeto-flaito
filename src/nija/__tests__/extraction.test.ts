import { describe, it, expect } from "vitest";
import { 
  extractSeparadorData, 
  extractPecasFromHeaders, 
  normalizeJudicialText 
} from "../extraction/patterns";
import { EPROC } from "../extraction/patterns";

describe("NIJA Extraction Engine - Critical Scenarios", () => {
  
  it("should handle consecutive EPROC separators without duplicate capture", () => {
    const rawText = `
      PÁGINA DE SEPARAÇÃO
      Evento 1
      Evento: DISTRIBUIDO_POR_SORTEIO
      Data: 16/03/2018 10:00:00
      Usuário: ADMIN
      
      PÁGINA DE SEPARAÇÃO
      Evento 1
      Evento: DISTRIBUIDO_POR_SORTEIO
      Data: 16/03/2018 10:00:00
      Usuário: ADMIN
    `;
    
    const normalized = normalizeJudicialText(rawText);
    const data = extractSeparadorData(normalized);
    
    // Deve capturar apenas uma vez o evento 1 ou sobrescrever de forma segura
    expect(data.size).toBe(1);
    expect(data.get(1)?.tipoEvento).toBe("DISTRIBUIDO_POR_SORTEIO");
  });

  it("should detect EPROC headers in block format (OCR match)", () => {
    const blockHeader = `
      # Processo 0014085-38.2016.8.27.2706/TO
      # Evento 1
      # INIC1
      Página 1
    `;
    
    const normalized = normalizeJudicialText(blockHeader);
    const pecas = extractPecasFromHeaders(normalized);
    
    expect(pecas.has(1)).toBe(true);
    const peca = pecas.get(1)?.[0];
    expect(peca?.codigo).toBe("INIC1");
    expect(peca?.paginaMax).toBe(1);
  });

  it("should be resilient to non-EPROC documents (Fail-Safe)", () => {
    const randomText = "Este é um documento aleatório que não segue o padrão EPROC.";
    const data = extractSeparadorData(randomText);
    const pecas = extractPecasFromHeaders(randomText);
    
    expect(data.size).toBe(0);
    expect(pecas.size).toBe(0);
  });

  it("should handle OCR noise in dates while maintaining structure", () => {
    const noisyText = `
      PÁGINA DE SEPARAÇÃO
      Evento 5
      Evento: DECISAO
      Data: 16/O3/2018 (Noisy O instead of 0)
    `;
    
    const data = extractSeparadorData(noisyText);
    const event5 = data.get(5);
    
    expect(event5).toBeDefined();
    expect(event5?.tipoEvento).toBe("DECISAO");
    // A data pode vir nula se o validador falhar (correto conforme plano: degradar mas não quebrar)
    expect(event5?.data).toBeNull();
  });
});
