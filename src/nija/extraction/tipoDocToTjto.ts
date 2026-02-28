// src/nija/extraction/tipoDocToTjto.ts
// Mapeamento de tipos de documento PDF para códigos TJTO

/**
 * Mapeamento de tipoDocumento (do bookmark PDF) para código TJTO
 * Usado para enriquecer eventos extraídos de bookmarks
 */
export const TIPO_DOC_TO_TJTO_CODE: Record<string, { code: string; label: string }> = {
  // Petições
  "PETIÇÃO": { code: "PETI1", label: "Petição" },
  "PETIÇÃO INICIAL": { code: "INIC1", label: "Petição Inicial" },
  "PETIÇÃO INTERMEDIÁRIA": { code: "PETI2", label: "Petição Intermediária" },
  "PETIÇÃO SIMPLES": { code: "PETI3", label: "Petição Simples" },
  "PETIÇÃO DIVERSA": { code: "PETI4", label: "Petição Diversa" },
  "PETICAO INICIAL": { code: "INIC1", label: "Petição Inicial" },
  "PETICAO": { code: "PETI1", label: "Petição" },
  
  // Contestação/Defesa
  "CONTESTAÇÃO": { code: "CONT1", label: "Contestação" },
  "CONTESTACAO": { code: "CONT1", label: "Contestação" },
  "DEFESA": { code: "CONT1", label: "Defesa/Contestação" },
  "RESPOSTA": { code: "CONT2", label: "Resposta" },
  "RÉPLICA": { code: "REPL1", label: "Réplica" },
  "REPLICA": { code: "REPL1", label: "Réplica" },
  "TRÉPLICA": { code: "REPL2", label: "Tréplica" },
  "IMPUGNAÇÃO": { code: "IMPU1", label: "Impugnação" },
  "IMPUGNACAO": { code: "IMPU1", label: "Impugnação" },
  
  // Decisões
  "DECISÃO": { code: "DECI1", label: "Decisão" },
  "DECISAO": { code: "DECI1", label: "Decisão" },
  "DESPACHO": { code: "DESP1", label: "Despacho" },
  "DECISÃO/DESPACHO": { code: "DECI1", label: "Decisão/Despacho" },
  "DECISAO/DESPACHO": { code: "DECI1", label: "Decisão/Despacho" },
  "DECISÃO INTERLOCUTÓRIA": { code: "DECI2", label: "Decisão Interlocutória" },
  "DECISAO INTERLOCUTORIA": { code: "DECI2", label: "Decisão Interlocutória" },
  "SENTENÇA": { code: "SENT1", label: "Sentença" },
  "SENTENCA": { code: "SENT1", label: "Sentença" },
  "ACÓRDÃO": { code: "ACOR1", label: "Acórdão" },
  "ACORDAO": { code: "ACOR1", label: "Acórdão" },
  
  // Comunicações
  "INTIMAÇÃO": { code: "INTM1", label: "Intimação" },
  "INTIMACAO": { code: "INTM1", label: "Intimação" },
  "NOTIFICAÇÃO": { code: "NOTI1", label: "Notificação" },
  "NOTIFICACAO": { code: "NOTI1", label: "Notificação" },
  "CITAÇÃO": { code: "CITA1", label: "Citação" },
  "CITACAO": { code: "CITA1", label: "Citação" },
  "MANDADO": { code: "MAND1", label: "Mandado" },
  "OFÍCIO": { code: "OFIC1", label: "Ofício" },
  "OFICIO": { code: "OFIC1", label: "Ofício" },
  "CARTA PRECATÓRIA": { code: "CPRE1", label: "Carta Precatória" },
  "CARTA PRECATORIA": { code: "CPRE1", label: "Carta Precatória" },
  
  // Certidões
  "CERTIDÃO": { code: "CERT1", label: "Certidão" },
  "CERTIDAO": { code: "CERT1", label: "Certidão" },
  "ATA": { code: "ATA1", label: "Ata" },
  "TERMO": { code: "TERM1", label: "Termo" },
  
  // Audiência
  "AUDIÊNCIA": { code: "AUDI1", label: "Audiência" },
  "AUDIENCIA": { code: "AUDI1", label: "Audiência" },
  "ATA DE AUDIÊNCIA": { code: "AUDI2", label: "Ata de Audiência" },
  "ATA DE AUDIENCIA": { code: "AUDI2", label: "Ata de Audiência" },
  
  // Documentos probatórios
  "DOCUMENTO": { code: "DOC1", label: "Documento" },
  "COMPROVANTE": { code: "COMP1", label: "Comprovante" },
  "LAUDO": { code: "LAUD1", label: "Laudo" },
  "LAUDO PERICIAL": { code: "LAUD2", label: "Laudo Pericial" },
  "PERÍCIA": { code: "PERI1", label: "Perícia" },
  "PERICIA": { code: "PERI1", label: "Perícia" },
  "PROVA": { code: "PROV1", label: "Prova" },
  "FOTO": { code: "FOTO1", label: "Foto" },
  "IMAGEM": { code: "IMAG1", label: "Imagem" },
  "PRINT": { code: "PRIN1", label: "Print/Captura de Tela" },
  
  // Procurações
  "PROCURAÇÃO": { code: "PROC1", label: "Procuração" },
  "PROCURACAO": { code: "PROC1", label: "Procuração" },
  "SUBSTABELECIMENTO": { code: "SUBS1", label: "Substabelecimento" },
  
  // Anexos
  "ANEXO": { code: "ANEX1", label: "Anexo" },
  "OUTROS": { code: "OUTR1", label: "Outros" },
  "JUNTADA": { code: "JUNT1", label: "Juntada" },
  
  // Recursos
  "RECURSO": { code: "RECU1", label: "Recurso" },
  "APELAÇÃO": { code: "APEL1", label: "Apelação" },
  "APELACAO": { code: "APEL1", label: "Apelação" },
  "AGRAVO": { code: "AGRA1", label: "Agravo" },
  "EMBARGOS": { code: "EMBA1", label: "Embargos" },
  "EMBARGOS DE DECLARAÇÃO": { code: "EMBA2", label: "Embargos de Declaração" },
  "EMBARGOS DE DECLARACAO": { code: "EMBA2", label: "Embargos de Declaração" },
  
  // Execução
  "CÁLCULO": { code: "CALC1", label: "Cálculo" },
  "CALCULO": { code: "CALC1", label: "Cálculo" },
  "PLANILHA": { code: "PLAN1", label: "Planilha" },
  "DEMONSTRATIVO": { code: "DEMO1", label: "Demonstrativo" },
  "PENHORA": { code: "PENH1", label: "Penhora" },
  "ARRESTO": { code: "ARRE1", label: "Arresto" },
  "BLOQUEIO": { code: "BLOQ1", label: "Bloqueio" },
};

/**
 * Busca código TJTO e label a partir do tipo de documento
 * Faz busca case-insensitive e com normalização
 */
export function getTjtoFromTipoDoc(tipoDocumento: string): { code: string; label: string } | null {
  if (!tipoDocumento) return null;
  
  // Normalizar entrada
  const normalized = tipoDocumento
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove acentos
  
  // Busca direta
  if (TIPO_DOC_TO_TJTO_CODE[tipoDocumento.trim().toUpperCase()]) {
    return TIPO_DOC_TO_TJTO_CODE[tipoDocumento.trim().toUpperCase()];
  }
  
  // Busca sem acentos
  for (const [key, value] of Object.entries(TIPO_DOC_TO_TJTO_CODE)) {
    const keyNormalized = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (keyNormalized === normalized) {
      return value;
    }
  }
  
  // Busca parcial (início da string)
  for (const [key, value] of Object.entries(TIPO_DOC_TO_TJTO_CODE)) {
    if (normalized.startsWith(key.toUpperCase())) {
      return value;
    }
  }
  
  // Busca por keywords
  if (/PETI[CÇ][AÃ]O\s*INICIAL/i.test(tipoDocumento)) {
    return { code: "INIC1", label: "Petição Inicial" };
  }
  if (/PETI[CÇ][AÃ]O/i.test(tipoDocumento)) {
    return { code: "PETI1", label: "Petição" };
  }
  if (/SENTEN[CÇ]A/i.test(tipoDocumento)) {
    return { code: "SENT1", label: "Sentença" };
  }
  if (/DECIS[AÃ]O/i.test(tipoDocumento)) {
    return { code: "DECI1", label: "Decisão" };
  }
  if (/DESPACHO/i.test(tipoDocumento)) {
    return { code: "DESP1", label: "Despacho" };
  }
  if (/CONTESTA[CÇ][AÃ]O/i.test(tipoDocumento)) {
    return { code: "CONT1", label: "Contestação" };
  }
  if (/CERTID[AÃ]O/i.test(tipoDocumento)) {
    return { code: "CERT1", label: "Certidão" };
  }
  if (/INTIMA[CÇ][AÃ]O/i.test(tipoDocumento)) {
    return { code: "INTM1", label: "Intimação" };
  }
  if (/MANDADO/i.test(tipoDocumento)) {
    return { code: "MAND1", label: "Mandado" };
  }
  if (/PROCURA[CÇ][AÃ]O/i.test(tipoDocumento)) {
    return { code: "PROC1", label: "Procuração" };
  }
  if (/AUDI[EÊ]NCIA/i.test(tipoDocumento)) {
    return { code: "AUDI1", label: "Audiência" };
  }
  
  return null;
}

/**
 * Verifica se um código é um código TJTO válido
 */
export function isValidTjtoCode(code: string): boolean {
  if (!code) return false;
  // Códigos TJTO têm formato: 3-4 letras + 1-2 dígitos
  return /^[A-Z]{3,5}\d{1,2}[A-Z]?$/i.test(code);
}
