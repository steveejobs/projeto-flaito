import { normalizeEscavadorProcess, renderEscavadorProcessMarkdown } from "../supabase/functions/_shared/escavador-transformer";
import * as fs from 'fs';

// Simulação de um payload real grande (exemplo reduzido para o script)
const mockLargePayload = {
  processo: {
    numero_cnj: "0000000-00.2024.8.27.2706",
    tribunal: { nome: "Tribunal de Justiça do Estado do Tocantins" },
    envolvidos: Array(10).fill({
      nome: "PARTE DE TESTE REPETITIVA E LONGA PARA TESTAR COMPRESSAO",
      tipo: "AUTOR",
      advogados: [{ nome: "ADVOGADO COM NOME EXTENSO E OAB REPETIDA", oab: "12345/TO" }]
    }),
    movimentacoes: Array(50).fill({
      data: "2024-01-01",
      titulo: "MOVIMENTACAO REPETITIVA DE TESTE",
      texto: "LOREM IPSUM DOLOR SIT AMET CONSECTETUR ADIPISCING ELIT SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET DOLORE MAGNA ALIQUA."
    })
  }
};

const rawJson = JSON.stringify(mockLargePayload);
const normalized = normalizeEscavadorProcess(mockLargePayload);

const profiles = ["MINIMAL", "STANDARD", "DETAILED"] as const;

console.log("=== RELATÓRIO DE ECONOMIA DE TOKENS (ESTIMADO) ===");
console.log(`Payload Bruto (JSON): ${rawJson.length} caracteres (~${Math.ceil(rawJson.length / 4)} tokens)`);
console.log("---------------------------------------------------");

profiles.forEach(profile => {
  const md = renderEscavadorProcessMarkdown({
    ...normalized,
    metadata: { normalizedAt: new Date().toISOString(), tokenOptimizationProfile: profile }
  });
  const saved = ((rawJson.length - md.length) / rawJson.length * 100).toFixed(2);
  console.log(`Perfil: ${profile}`);
  console.log(`Tamanho: ${md.length} caracteres (~${Math.ceil(md.length / 4)} tokens)`);
  console.log(`Economia: ${saved}%`);
  console.log("---------------------------------------------------");
});
