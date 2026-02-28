// src/lib/nija/analysisExporter.ts
// Exportação de análise heurística para PDF/TXT

import { Document, Paragraph, TextRun, HeadingLevel, Packer } from "docx";
import { saveAs } from "file-saver";
import type { EprocExtractionResult } from "@/nija/extraction/mode";
import type { NijaAnalyzerResponse } from "@/nija/core/analyzer";
import type { NijaEngineFinding } from "@/nija/core/pipeline";

/**
 * Gera texto formatado da análise para exportação
 */
export function formatAnalysisForExport(
  extractionResult: EprocExtractionResult,
  analysisResult: NijaAnalyzerResponse,
  config: {
    clientName: string;
    opponentName: string;
    processNumber: string;
    actingSide: "AUTOR" | "REU";
    lawyerName: string;
    oabNumber: string;
  }
): string {
  const lines: string[] = [];
  const PLACEHOLDER = "Não identificado nos documentos analisados";

  // Cabeçalho
  lines.push("=".repeat(70));
  lines.push("NIJA – RELATÓRIO DE ANÁLISE PROCESSUAL");
  lines.push("=".repeat(70));
  lines.push("");
  lines.push(`Data de geração: ${new Date().toLocaleString("pt-BR")}`);
  lines.push("");

  // Dados do processo
  lines.push("-".repeat(70));
  lines.push("DADOS DO PROCESSO");
  lines.push("-".repeat(70));
  
  const cnj = extractionResult.capa.numeroCnj !== PLACEHOLDER 
    ? extractionResult.capa.numeroCnj 
    : config.processNumber || "[não identificado]";
  lines.push(`Número CNJ: ${cnj}`);
  
  const vara = extractionResult.capa.varaJuizo !== PLACEHOLDER 
    ? extractionResult.capa.varaJuizo 
    : "[não identificado]";
  lines.push(`Vara/Juízo: ${vara}`);
  
  const comarca = extractionResult.capa.comarca !== PLACEHOLDER 
    ? extractionResult.capa.comarca 
    : "[não identificado]";
  lines.push(`Comarca: ${comarca}`);
  
  const tipoAcao = extractionResult.capa.tipoAcao !== PLACEHOLDER 
    ? extractionResult.capa.tipoAcao 
    : "[não identificado]";
  lines.push(`Tipo de Ação: ${tipoAcao}`);
  
  lines.push("");

  // Partes
  lines.push("-".repeat(70));
  lines.push("PARTES");
  lines.push("-".repeat(70));
  lines.push(`Cliente (${config.actingSide}): ${config.clientName || "[não identificado]"}`);
  lines.push(`Parte Contrária: ${config.opponentName || "[não identificado]"}`);
  lines.push(`Advogado: ${config.lawyerName || "[não identificado]"} – OAB ${config.oabNumber || "[não identificado]"}`);
  lines.push("");

  // Ramo do direito
  if (analysisResult.ramoFinal) {
    lines.push("-".repeat(70));
    lines.push("RAMO DO DIREITO");
    lines.push("-".repeat(70));
    lines.push(`Ramo identificado: ${analysisResult.ramoFinal}`);
    lines.push("");
  }

  // Resumo tático
  if (analysisResult.recommendation.resumoTatico) {
    lines.push("-".repeat(70));
    lines.push("RESUMO TÁTICO");
    lines.push("-".repeat(70));
    lines.push(analysisResult.recommendation.resumoTatico);
    lines.push("");
  }

  // Vícios detectados
  lines.push("-".repeat(70));
  lines.push("VÍCIOS E IRREGULARIDADES DETECTADOS");
  lines.push("-".repeat(70));

  const findings = analysisResult.recommendation.findings;
  if (findings.length === 0) {
    lines.push("Nenhum vício foi detectado pela análise heurística.");
    lines.push("Recomenda-se revisão manual do processo para verificação completa.");
  } else {
    lines.push(`Total: ${findings.length} vício(s) identificado(s)`);
    lines.push("");

    findings.forEach((finding: NijaEngineFinding, idx: number) => {
      lines.push(`${idx + 1}. ${finding.defect.label}`);
      lines.push(`   Código: ${finding.defect.code}`);
      lines.push(`   Severidade: ${finding.defect.severity}`);
      lines.push(`   Impacto: ${finding.defect.impact}`);
      
      if (finding.tecnico?.fundamentosLegais && finding.tecnico.fundamentosLegais.length > 0) {
        lines.push(`   Fundamentos legais: ${finding.tecnico.fundamentosLegais.join(", ")}`);
      }
      
      if (finding.notas) {
        lines.push(`   Observação: ${finding.notas}`);
      }
      
      lines.push("");
    });
  }

  // Estratégias
  lines.push("-".repeat(70));
  lines.push("ESTRATÉGIAS RECOMENDADAS");
  lines.push("-".repeat(70));

  const mainStrategies = analysisResult.recommendation.mainStrategies;
  if (mainStrategies.length === 0) {
    lines.push("Nenhuma estratégia específica foi identificada.");
  } else {
    lines.push("ESTRATÉGIAS PRINCIPAIS:");
    lines.push("");
    mainStrategies.forEach((strategy, idx) => {
      lines.push(`${idx + 1}. ${strategy.label}`);
      lines.push(`   ${strategy.description}`);
      if (strategy.recommendedWhenDefects && strategy.recommendedWhenDefects.length > 0) {
        lines.push(`   Vícios relacionados: ${strategy.recommendedWhenDefects.join(", ")}`);
      }
      lines.push("");
    });
  }

  const secondaryStrategies = analysisResult.recommendation.secondaryStrategies || [];
  if (secondaryStrategies.length > 0) {
    lines.push("ESTRATÉGIAS SECUNDÁRIAS:");
    lines.push("");
    secondaryStrategies.forEach((strategy, idx) => {
      lines.push(`${idx + 1}. ${strategy.label}`);
      lines.push(`   ${strategy.description}`);
      lines.push("");
    });
  }

  // Timeline resumida
  lines.push("-".repeat(70));
  lines.push("EVENTOS PROCESSUAIS");
  lines.push("-".repeat(70));
  lines.push(`Total de eventos extraídos: ${extractionResult.eventos.length}`);
  lines.push("");

  // Mostrar apenas primeiros 10 eventos
  const eventosResumo = extractionResult.eventos.slice(0, 10);
  eventosResumo.forEach((evento) => {
    const desc = evento.labelEnriquecido || evento.descricaoLiteral || evento.tipoEvento;
    lines.push(`• ${evento.data}: ${desc?.slice(0, 100)}`);
  });

  if (extractionResult.eventos.length > 10) {
    lines.push(`... e mais ${extractionResult.eventos.length - 10} eventos.`);
  }

  lines.push("");

  // Avisos
  if (analysisResult.warnings && analysisResult.warnings.length > 0) {
    lines.push("-".repeat(70));
    lines.push("AVISOS");
    lines.push("-".repeat(70));
    analysisResult.warnings.forEach((warning) => {
      lines.push(`⚠ ${warning}`);
    });
    lines.push("");
  }

  // Footer
  lines.push("=".repeat(70));
  lines.push("NIJA – Central de Análise Processual");
  lines.push("Análise realizada por motor heurístico local, sem uso de IA.");
  lines.push("Os dados foram extraídos dos documentos sem interpretação automática.");
  lines.push("Recomenda-se validação por advogado responsável.");
  lines.push("=".repeat(70));

  return lines.join("\n");
}

/**
 * Exporta análise para arquivo TXT
 */
export function exportAnalysisToTxt(
  extractionResult: EprocExtractionResult,
  analysisResult: NijaAnalyzerResponse,
  config: {
    clientName: string;
    opponentName: string;
    processNumber: string;
    actingSide: "AUTOR" | "REU";
    lawyerName: string;
    oabNumber: string;
  }
): void {
  const content = formatAnalysisForExport(extractionResult, analysisResult, config);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const cnjClean = (config.processNumber || "analise").replace(/[^0-9]/g, "");
  const filename = `NIJA_ANALISE_${cnjClean}_${new Date().toISOString().split("T")[0]}.txt`;
  saveAs(blob, filename);
}

/**
 * Exporta análise para DOCX
 */
export async function exportAnalysisToDocx(
  extractionResult: EprocExtractionResult,
  analysisResult: NijaAnalyzerResponse,
  config: {
    clientName: string;
    opponentName: string;
    processNumber: string;
    actingSide: "AUTOR" | "REU";
    lawyerName: string;
    oabNumber: string;
  }
): Promise<void> {
  const PLACEHOLDER = "Não identificado nos documentos analisados";
  const children: Paragraph[] = [];

  // Título
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "NIJA – RELATÓRIO DE ANÁLISE PROCESSUAL", bold: true, size: 32 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 },
    })
  );

  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Gerado em: ${new Date().toLocaleString("pt-BR")}`, italics: true })],
      spacing: { after: 300 },
    })
  );

  // Dados do processo
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "DADOS DO PROCESSO", bold: true })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 200 },
    })
  );

  const cnj = extractionResult.capa.numeroCnj !== PLACEHOLDER 
    ? extractionResult.capa.numeroCnj 
    : config.processNumber || "[não identificado]";
  children.push(new Paragraph({ children: [new TextRun({ text: `Número CNJ: ${cnj}` })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Cliente: ${config.clientName || "[não identificado]"}` })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Parte Contrária: ${config.opponentName || "[não identificado]"}` })] }));

  // Vícios
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "VÍCIOS DETECTADOS", bold: true })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
    })
  );

  const findings = analysisResult.recommendation.findings;
  if (findings.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "Nenhum vício detectado pela análise heurística." })] }));
  } else {
    findings.forEach((finding: NijaEngineFinding, idx: number) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${idx + 1}. ${finding.defect.label}`, bold: true })],
          spacing: { before: 200 },
        })
      );
      children.push(new Paragraph({ children: [new TextRun({ text: `Severidade: ${finding.defect.severity} | Impacto: ${finding.defect.impact}` })] }));
      if (finding.notas) {
        children.push(new Paragraph({ children: [new TextRun({ text: finding.notas, italics: true })] }));
      }
    });
  }

  // Estratégias
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "ESTRATÉGIAS RECOMENDADAS", bold: true })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
    })
  );

  const mainStrategies = analysisResult.recommendation.mainStrategies;
  if (mainStrategies.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "Nenhuma estratégia específica identificada." })] }));
  } else {
    mainStrategies.forEach((strategy, idx) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${idx + 1}. ${strategy.label}`, bold: true })],
          spacing: { before: 200 },
        })
      );
      children.push(new Paragraph({ children: [new TextRun({ text: strategy.description })] }));
    });
  }

  // Footer
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "NIJA – Central de Análise Processual", italics: true })],
      spacing: { before: 600 },
    })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Análise heurística local, sem uso de IA. Validação por advogado recomendada.", italics: true, size: 20 })],
    })
  );

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const cnjClean = (config.processNumber || "analise").replace(/[^0-9]/g, "");
  const filename = `NIJA_ANALISE_${cnjClean}_${new Date().toISOString().split("T")[0]}.docx`;
  saveAs(blob, filename);
}

/**
 * Copia análise para clipboard
 */
export async function copyAnalysisToClipboard(
  extractionResult: EprocExtractionResult,
  analysisResult: NijaAnalyzerResponse,
  config: {
    clientName: string;
    opponentName: string;
    processNumber: string;
    actingSide: "AUTOR" | "REU";
    lawyerName: string;
    oabNumber: string;
  }
): Promise<boolean> {
  try {
    const content = formatAnalysisForExport(extractionResult, analysisResult, config);
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}
