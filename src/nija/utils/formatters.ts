// src/nija/utils/formatters.ts
// Utilitários de formatação para o módulo NIJA

import type { EprocExtractionResult } from "@/types/nija-contracts";

/**
 * Frase final padrão para rodapé de extração
 */
export const FRASE_FINAL_EXTRACAO = "Importante: Esta é uma extração literal de dados estruturados para conferência visual. Não houve análise jurídica automatizada nestes campos.";

/**
 * Formata um resultado de extração EPROC para exibição em texto (para cópia)
 */
export function formatExtractionForDisplay(result: EprocExtractionResult | null | undefined): string {
  if (!result) return "Nenhum dado extraído.";

  let text = "--- EXTRAÇÃO DE DADOS EPROC ---\n\n";

  // Cabeçalho / Metadados Básicos
  text += `Processo: ${result.processo || "Não identificado"}\n`;
  text += `Sistema: ${result.sistema || "EPROC"}\n`;
  text += `Total de Eventos: ${result.eventos?.length || 0}\n\n`;

  // Partes
  if (result.partes && result.partes.length > 0) {
    text += "PARTES:\n";
    result.partes.forEach(p => {
      text += `- ${p.nome || "Não identificado"} (${p.papel || "Papel não id."})\n`;
    });
    text += "\n";
  }

  // Eventos (Limitados aos 20 mais recentes para não poluir demais)
  if (result.eventos && result.eventos.length > 0) {
    text += "EVENTOS RECENTES:\n";
    const eventos = [...result.eventos].slice(0, 20);
    eventos.forEach(e => {
      text += `[${e.data || "S/D"}] Evento ${e.eventoNumero || "?"}: ${e.tipoEvento || "Movimentação"}\n`;
      if (e.descricaoLiteral) {
        text += `  Descrição: ${e.descricaoLiteral}\n`;
      }
    });
    text += "\n";
  }

  text += FRASE_FINAL_EXTRACAO;
  
  return text;
}
