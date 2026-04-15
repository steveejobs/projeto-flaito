// src/nija/extraction/timelineSummary.ts
// Geração automática de resumo dos andamentos processuais

import type { 
  EprocEventoExtraido,
  TimelineSummary
} from "@/types/nija-contracts";


// ======================================================
// HELPERS
// ======================================================

export const PLACEHOLDER_NAO_IDENTIFICADO = "Não identificado nos documentos analisados";

/**
 * Verifica se uma data é válida (não placeholder)
 */
function isValidDate(data: string | null | undefined): boolean {
  if (!data) return false;
  if (data === PLACEHOLDER_NAO_IDENTIFICADO) return false;
  if (data.toLowerCase().includes("não identificado")) return false;
  // Verificar formato DD/MM/YYYY
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(data.trim());
}

/**
 * Normaliza tipo de evento para agrupamento
 */
function normalizeEventType(tipo: string | null | undefined): string {
  if (!tipo) return "Outros";
  
  const upper = tipo.toUpperCase();
  
  if (/PET|INIC/.test(upper)) return "Petições";
  if (/SENT/.test(upper)) return "Sentenças";
  if (/DEC|DESP/.test(upper)) return "Decisões/Despachos";
  if (/CERT/.test(upper)) return "Certidões";
  if (/INT|MAND|NOT|CITA/.test(upper)) return "Comunicações";
  if (/AUDI/.test(upper)) return "Audiências";
  if (/CONT/.test(upper)) return "Contestações";
  if (/DOC|ANX|COMP/.test(upper)) return "Documentos/Anexos";
  if (/PROC|SUBS/.test(upper)) return "Procurações";
  
  return "Outros";
}

/**
 * Detecta decisões-chave no processo
 */
function detectKeyDecisions(eventos: EprocEventoExtraido[]): string[] {
  const decisoesChave: string[] = [];
  
  for (const evento of eventos) {
    const tipo = (evento.tipoEvento || "").toUpperCase();
    const descricao = (evento.descricaoLiteral || "").toUpperCase();
    const label = (evento.labelEnriquecido || "").toUpperCase();
    const data = isValidDate(evento.data) ? ` em ${evento.data}` : "";
    
    // Sentença
    if (/SENTEN[ÇC]A/.test(tipo) || /SENTEN[ÇC]A/.test(descricao) || /SENTEN[ÇC]A/.test(label)) {
      decisoesChave.push(`Sentença proferida${data}`);
      continue;
    }
    
    // Liminar/Tutela
    if (/LIMINAR|TUTELA|ANTECIPA/.test(descricao) || /LIMINAR|TUTELA|ANTECIPA/.test(label)) {
      if (/DEFERIDA|CONCEDIDA/.test(descricao) || /DEFERIDA|CONCEDIDA/.test(label)) {
        decisoesChave.push(`Tutela/Liminar deferida${data}`);
      } else if (/INDEFERIDA|NEGADA/.test(descricao) || /INDEFERIDA|NEGADA/.test(label)) {
        decisoesChave.push(`Tutela/Liminar indeferida${data}`);
      }
      continue;
    }
    
    // Arquivamento
    if (/ARQUIV|BAIXA/.test(descricao) || /ARQUIV|BAIXA/.test(label)) {
      decisoesChave.push(`Arquivamento${data}`);
      continue;
    }
    
    // Citação realizada
    if (/CITA[ÇC][ÃA]O.*REALIZADA|CITADO/.test(descricao) || /CITA[ÇC][ÃA]O.*REALIZADA|CITADO/.test(label)) {
      decisoesChave.push(`Citação realizada${data}`);
      continue;
    }
    
    // Audiência
    if (/AUDI[ÊE]NCIA.*REALIZADA/.test(descricao) || /AUDI[ÊE]NCIA.*REALIZADA/.test(label)) {
      decisoesChave.push(`Audiência realizada${data}`);
    }
  }
  
  return decisoesChave;
}

/**
 * Ordena eventos por data (mais antigo primeiro)
 */
function sortEventsByDate(eventos: EprocEventoExtraido[]): EprocEventoExtraido[] {
  return [...eventos].sort((a, b) => {
    const parseDate = (d: string | null | undefined): number => {
      if (!d || !isValidDate(d)) return Infinity;
      const [day, month, year] = d.split("/").map(Number);
      return new Date(year, month - 1, day).getTime();
    };
    return parseDate(a.data) - parseDate(b.data);
  });
}

// ======================================================
// MAIN FUNCTION
// ======================================================

/**
 * Gera resumo automático dos andamentos do processo
 */
export function generateTimelineSummary(
  eventos: EprocEventoExtraido[]
): TimelineSummary {
  if (!eventos || eventos.length === 0) {
    return {
      totalEventos: 0,
      primeiroEvento: null,
      ultimoEvento: null,
      contagemPorTipo: {},
      decisoesChave: [],
      resumoTexto: "Nenhum andamento detectado no processo.",
      qualidade: "BAIXA",
      percentualComData: 0,
    };
  }

  // Ordenar por data
  const sortedEvents = sortEventsByDate(eventos);
  
  // Contar eventos com data válida
  const eventosComData = eventos.filter(e => isValidDate(e.data));
  const percentualComData = Math.round((eventosComData.length / eventos.length) * 100);
  
  // Determinar qualidade
  let qualidade: "ALTA" | "MEDIA" | "BAIXA";
  if (percentualComData >= 70) qualidade = "ALTA";
  else if (percentualComData >= 30) qualidade = "MEDIA";
  else qualidade = "BAIXA";
  
  // Primeiro e último evento COM DATA
  const sortedWithDate = sortedEvents.filter(e => isValidDate(e.data));
  const primeiroEvento = sortedWithDate.length > 0 
    ? { data: sortedWithDate[0].data, tipo: sortedWithDate[0].labelEnriquecido || sortedWithDate[0].tipoEvento || "Evento" }
    : null;
  const ultimoEvento = sortedWithDate.length > 0 
    ? { data: sortedWithDate[sortedWithDate.length - 1].data, tipo: sortedWithDate[sortedWithDate.length - 1].labelEnriquecido || sortedWithDate[sortedWithDate.length - 1].tipoEvento || "Evento" }
    : null;
  
  // Contagem por tipo normalizado
  const contagemPorTipo: Record<string, number> = {};
  for (const evento of eventos) {
    const tipoNorm = normalizeEventType(evento.codigoTjto || evento.tipoEvento);
    contagemPorTipo[tipoNorm] = (contagemPorTipo[tipoNorm] || 0) + 1;
  }
  
  // Decisões-chave
  const decisoesChave = detectKeyDecisions(eventos);
  
  // Construir resumo textual
  const partes: string[] = [];
  
  if (primeiroEvento) {
    partes.push(`Processo iniciado em ${primeiroEvento.data}`);
  } else {
    partes.push(`Processo com ${eventos.length} evento${eventos.length !== 1 ? "s" : ""} detectado${eventos.length !== 1 ? "s" : ""}`);
  }
  
  // Adicionar contagem por tipo (top 3)
  const tiposSorted = Object.entries(contagemPorTipo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  if (tiposSorted.length > 0) {
    const tiposStr = tiposSorted.map(([tipo, count]) => `${count} ${tipo.toLowerCase()}`).join(", ");
    partes.push(tiposStr);
  }
  
  // Adicionar decisões-chave (max 2)
  if (decisoesChave.length > 0) {
    const decisoesStr = decisoesChave.slice(0, 2).join("; ");
    partes.push(decisoesStr);
  }
  
  // Adicionar última movimentação
  if (ultimoEvento && ultimoEvento.data !== primeiroEvento?.data) {
    partes.push(`Última movimentação: ${ultimoEvento.tipo} em ${ultimoEvento.data}`);
  }
  
  const resumoTexto = partes.join(". ").replace(/\.\./g, ".") + ".";
  
  return {
    totalEventos: eventos.length,
    primeiroEvento,
    ultimoEvento,
    contagemPorTipo,
    decisoesChave,
    resumoTexto,
    qualidade,
    percentualComData,
  };
}

/**
 * Formata contagem de tipos para exibição
 */
export function formatContagemPorTipo(contagem: Record<string, number>): string {
  return Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, count]) => `${tipo}: ${count}`)
    .join(" | ");
}
