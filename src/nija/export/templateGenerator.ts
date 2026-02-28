// src/lib/nija/templateGenerator.ts
// Geração de minutas template a partir de dados extraídos SEM IA

import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from "docx";
import { saveAs } from "file-saver";
import type { EprocExtractionResult } from "@/nija/extraction/mode";
import type { NijaAnalyzerResponse } from "@/nija/core/analyzer";
import type { NijaEngineFinding } from "@/nija/core/pipeline";

export interface GenerateMinutaConfig {
  actingSide: "AUTOR" | "REU";
  lawyerName: string;
  oabNumber: string;
  clientName: string;
  opponentName: string;
}

/**
 * Gera uma minuta de contestação/petição baseada nos dados extraídos e análise heurística
 */
export function generateMinutaFromExtraction(
  extractionResult: EprocExtractionResult,
  analysisResult: NijaAnalyzerResponse,
  config: GenerateMinutaConfig
): string {
  const { actingSide, lawyerName, oabNumber, clientName, opponentName } = config;
  const PLACEHOLDER = "Não identificado nos documentos analisados";

  const lines: string[] = [];

  // Cabeçalho do juízo
  const vara = extractionResult.capa.varaJuizo !== PLACEHOLDER 
    ? extractionResult.capa.varaJuizo 
    : "[VARA/JUÍZO]";
  const comarca = extractionResult.capa.comarca !== PLACEHOLDER 
    ? extractionResult.capa.comarca 
    : "[COMARCA]";

  lines.push(`EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ${vara.toUpperCase()}`);
  lines.push(`COMARCA DE ${comarca.toUpperCase()}`);
  lines.push("");
  lines.push("");

  // Número do processo
  const cnj = extractionResult.capa.numeroCnj !== PLACEHOLDER 
    ? extractionResult.capa.numeroCnj 
    : "[NÚMERO DO PROCESSO]";
  lines.push(`Processo nº: ${cnj}`);
  lines.push("");
  lines.push("");

  // Partes
  const nomeCliente = clientName || "[NOME DO CLIENTE]";
  const nomeOponente = opponentName || "[NOME DA PARTE CONTRÁRIA]";

  if (actingSide === "REU") {
    lines.push(`${nomeCliente.toUpperCase()}, já qualificado nos autos do processo em epígrafe, vem, respeitosamente, por seu advogado infra-assinado, apresentar`);
    lines.push("");
    lines.push("CONTESTAÇÃO");
    lines.push("");
    lines.push(`em face de ${nomeOponente.toUpperCase()}, pelos fatos e fundamentos a seguir expostos.`);
  } else {
    lines.push(`${nomeCliente.toUpperCase()}, já qualificado nos autos do processo em epígrafe, vem, respeitosamente, por seu advogado infra-assinado, apresentar`);
    lines.push("");
    lines.push("PETIÇÃO INICIAL");
    lines.push("");
    lines.push(`em face de ${nomeOponente.toUpperCase()}, pelos fatos e fundamentos a seguir expostos.`);
  }

  lines.push("");
  lines.push("");

  // I - DOS FATOS
  lines.push("I – DOS FATOS");
  lines.push("");

  // Resumo baseado na extração
  const tipoAcao = extractionResult.capa.tipoAcao !== PLACEHOLDER 
    ? extractionResult.capa.tipoAcao 
    : "ação judicial";
  
  lines.push(`Trata-se de ${tipoAcao} proposta por ${nomeOponente} contra ${nomeCliente}.`);
  lines.push("");

  // Eventos relevantes (primeiros 5)
  if (extractionResult.eventos.length > 0) {
    lines.push("Conforme se verifica dos autos, destacam-se os seguintes fatos processuais:");
    lines.push("");
    const eventosRelevantes = extractionResult.eventos.slice(0, 5);
    eventosRelevantes.forEach((ev) => {
      const desc = ev.labelEnriquecido || ev.descricaoLiteral || ev.tipoEvento;
      lines.push(`• ${ev.data}: ${desc}`);
    });
    lines.push("");
  }

  lines.push("[COMPLEMENTAR COM OS FATOS ESPECÍFICOS DO CASO]");
  lines.push("");
  lines.push("");

  // II - DO DIREITO (baseado nos vícios detectados)
  lines.push("II – DO DIREITO");
  lines.push("");

  const findings = analysisResult.recommendation.findings;

  if (findings.length > 0) {
    findings.forEach((finding: NijaEngineFinding, idx: number) => {
      lines.push(`${idx + 1}. ${finding.defect.label.toUpperCase()}`);
      lines.push("");
      
      // Adicionar trecho se disponível
      if (finding.trecho) {
        lines.push(`Conforme se verifica do trecho: "${finding.trecho}"`);
        lines.push("");
      }

      // Fundamentação legal baseada no tecnico
      if (finding.tecnico?.fundamentosLegais && finding.tecnico.fundamentosLegais.length > 0) {
        lines.push("Fundamentação legal:");
        finding.tecnico.fundamentosLegais.forEach((base: string) => {
          lines.push(`• ${base}`);
        });
        lines.push("");
      }

      // Notas/observações
      if (finding.notas) {
        lines.push(finding.notas);
        lines.push("");
      }

      lines.push("[DESENVOLVER ARGUMENTAÇÃO ESPECÍFICA]");
      lines.push("");
    });
  } else {
    lines.push("[DESENVOLVER FUNDAMENTAÇÃO JURÍDICA]");
    lines.push("");
  }

  lines.push("");

  // III - DOS PEDIDOS
  lines.push("III – DOS PEDIDOS");
  lines.push("");
  lines.push("Diante do exposto, requer:");
  lines.push("");

  // Pedidos baseados nas estratégias
  const strategies = analysisResult.recommendation.mainStrategies;
  if (strategies.length > 0) {
    strategies.forEach((strategy, idx) => {
      lines.push(`${String.fromCharCode(97 + idx)}) ${strategy.label};`);
    });
  } else {
    lines.push("a) [INSERIR PEDIDOS ESPECÍFICOS];");
    lines.push("b) [INSERIR PEDIDOS ESPECÍFICOS];");
  }

  lines.push("");
  lines.push("c) A condenação da parte adversa ao pagamento das custas processuais e honorários advocatícios;");
  lines.push("");
  lines.push("d) A produção de todas as provas admitidas em direito, especialmente documental, testemunhal e pericial, se necessário.");
  lines.push("");
  lines.push("");

  // Valor da causa
  lines.push(`Dá-se à causa o valor de [VALOR DA CAUSA].`);
  lines.push("");
  lines.push("");

  // Termos de praxe
  lines.push("Nestes termos,");
  lines.push("Pede deferimento.");
  lines.push("");
  lines.push("");

  // Local e data
  lines.push(`${comarca}, ${new Date().toLocaleDateString("pt-BR")}.`);
  lines.push("");
  lines.push("");
  lines.push("");

  // Advogado
  const advNome = lawyerName || "[NOME DO ADVOGADO]";
  const advOab = oabNumber || "[OAB]";
  lines.push(`${advNome}`);
  lines.push(`OAB ${advOab}`);

  return lines.join("\n");
}

/**
 * Exporta a minuta para DOCX
 */
export async function exportMinutaToDocx(
  minutaText: string,
  processNumber: string
): Promise<void> {
  const paragraphs = minutaText.split("\n").map((line) => {
    // Detectar títulos (linhas em maiúsculas ou com "I –", "II –", etc.)
    const isTitulo = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\s*[–\-]/.test(line.trim()) ||
                     line === line.toUpperCase() && line.trim().length > 5;

    if (isTitulo && line.trim()) {
      return new Paragraph({
        children: [new TextRun({ text: line, bold: true })],
        spacing: { before: 400, after: 200 },
      });
    }

    if (line.trim() === "") {
      return new Paragraph({ children: [] });
    }

    return new Paragraph({
      children: [new TextRun({ text: line })],
      spacing: { after: 100 },
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cnj = processNumber?.replace(/[^0-9]/g, "") || "caso";
  const filename = `MINUTA_${cnj}_${new Date().toISOString().split("T")[0]}.docx`;
  saveAs(blob, filename);
}

/**
 * Copia o texto da minuta para o clipboard
 */
export async function copyMinutaToClipboard(minutaText: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(minutaText);
    return true;
  } catch {
    return false;
  }
}

/**
 * Exporta a minuta como arquivo TXT
 */
export function exportMinutaToTxt(minutaText: string, processNumber: string): void {
  const blob = new Blob([minutaText], { type: "text/plain;charset=utf-8" });
  const cnj = processNumber?.replace(/[^0-9]/g, "") || "caso";
  const filename = `MINUTA_${cnj}_${new Date().toISOString().split("T")[0]}.txt`;
  saveAs(blob, filename);
}
