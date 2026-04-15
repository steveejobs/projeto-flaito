import { describe, it, expect } from "vitest";
import { 
  normalizeEscavadorProcess, 
  renderEscavadorProcessMarkdown,
  NormalizedEscavadorProcess
} from "../../../../supabase/functions/_shared/escavador-transformer";

describe("Escavador Transformer - Normalization Core", () => {
  const mockRawPayload = {
    processo: {
      id: 12345,
      numero_cnj: "0000000-00.2024.8.27.2706",
      tribunal: { nome: "TJ-TO" },
      valor_causa: 50000,
      envolvidos: [
        {
          nome: "JOAO DA SILVA",
          tipo: "AUTOR",
          cpf_cnpj: "123.456.789-00",
          advogados: [
            { nome: "MARIA ADVOGADA", oab: "12345", uf: "TO" }
          ]
        },
        {
          nome: "BANCO MOCK",
          tipo: "REU",
          advogados: [
            { nome: "CARLOS DEFENDA", oab: "67890", uf: "SP" }
          ]
        }
      ],
      movimentacoes: [
        {
          data: "2024-01-01",
          titulo: "Sentença Proferida",
          texto: "O juiz decidiu a favor do autor."
        },
        {
          data: "2024-01-02",
          titulo: "Movimentação Genérica",
          texto: "Processo aguardando..."
        }
      ]
    }
  };

  it("should correctly map identification fields", () => {
    const normalized = normalizeEscavadorProcess(mockRawPayload);
    expect(normalized.identification.numeroProcesso).toBe("0000000-00.2024.8.27.2706");
  });

  describe("Markdown Rendering Profiles", () => {
    it("should render MINIMAL profile with reduced content", () => {
      const normalized = normalizeEscavadorProcess(mockRawPayload) as any;
      const p: NormalizedEscavadorProcess = {
        ...normalized,
        metadata: { normalizedAt: new Date().toISOString(), tokenOptimizationProfile: "MINIMAL" }
      };
      const md = renderEscavadorProcessMarkdown(p);
      
      expect(md).toContain("# Processo: 0000000-00.2024.8.27.2706");
      expect(md).toContain("**Partes:** JOAO DA SILVA × BANCO MOCK");
      expect(md).not.toContain("## Advogados"); // Omitted in MINIMAL
    });

    it("should render STANDARD profile with parties and lawyers", () => {
      const normalized = normalizeEscavadorProcess(mockRawPayload) as any;
      const p: NormalizedEscavadorProcess = {
        ...normalized,
        metadata: { normalizedAt: new Date().toISOString(), tokenOptimizationProfile: "STANDARD" }
      };
      const md = renderEscavadorProcessMarkdown(p);
      
      expect(md).toContain("## Partes");
      expect(md).toContain("## Advogados");
      expect(md).toContain("MARIA ADVOGADA");
    });

    it("should render DETAILED profile with full descriptions", () => {
      const normalized = normalizeEscavadorProcess(mockRawPayload) as any;
      const p: NormalizedEscavadorProcess = {
        ...normalized,
        metadata: { normalizedAt: new Date().toISOString(), tokenOptimizationProfile: "DETAILED" }
      };
      const md = renderEscavadorProcessMarkdown(p);
      
      expect(md).toContain("> O juiz decidiu a favor do autor.");
    });
  });
});
