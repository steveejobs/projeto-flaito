// src/lib/nija/timelineExporter.ts
// Exportação de timeline para DOCX

import { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, Packer, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import type { EprocExtractionResult } from "@/nija/extraction/mode";

/**
 * Exporta a timeline de eventos para um arquivo DOCX formatado
 */
export async function exportTimelineToDocx(
  extractionResult: EprocExtractionResult,
  processNumber: string,
  clientName?: string
): Promise<void> {
  const PLACEHOLDER = "Não identificado nos documentos analisados";
  const cnj = extractionResult.capa.numeroCnj !== PLACEHOLDER 
    ? extractionResult.capa.numeroCnj 
    : processNumber || "[PROCESSO]";

  // Cabeçalho
  const headerParagraphs = [
    new Paragraph({
      children: [new TextRun({ text: "LINHA DO TEMPO PROCESSUAL", bold: true, size: 32 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Processo: ${cnj}`, size: 24 })],
      spacing: { after: 100 },
    }),
  ];

  if (clientName) {
    headerParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `Cliente: ${clientName}`, size: 24 })],
        spacing: { after: 100 },
      })
    );
  }

  headerParagraphs.push(
    new Paragraph({
      children: [new TextRun({ text: `Gerado em: ${new Date().toLocaleString("pt-BR")}`, size: 20, italics: true })],
      spacing: { after: 400 },
    })
  );

  // Sumário
  headerParagraphs.push(
    new Paragraph({
      children: [new TextRun({ text: `Total de eventos: ${extractionResult.eventos.length}`, size: 22 })],
      spacing: { after: 300 },
    })
  );

  // Tabela de eventos
  const tableRows: TableRow[] = [];

  // Header da tabela
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Nº", bold: true })] })],
          width: { size: 800, type: WidthType.DXA },
          shading: { fill: "E0E0E0" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Data", bold: true })] })],
          width: { size: 1500, type: WidthType.DXA },
          shading: { fill: "E0E0E0" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Evento", bold: true })] })],
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: "E0E0E0" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Descrição", bold: true })] })],
          width: { size: 5000, type: WidthType.DXA },
          shading: { fill: "E0E0E0" },
        }),
      ],
    })
  );

  // Linhas de eventos
  extractionResult.eventos.forEach((evento, idx) => {
    const descricao = evento.labelEnriquecido || evento.descricaoLiteral || "-";
    
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(evento.numeroEvento || idx + 1) })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: evento.data || "-" })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: evento.tipoEvento || "-" })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: descricao.slice(0, 300) })] })],
          }),
        ],
      })
    );
  });

  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  // Footer
  const footerParagraphs = [
    new Paragraph({
      children: [],
      spacing: { before: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({ 
          text: "Documento gerado automaticamente pelo NIJA – Central de Análise Processual", 
          italics: true, 
          size: 18 
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ 
          text: "Os dados foram extraídos dos documentos processuais sem interpretação ou inferência automática.", 
          italics: true, 
          size: 18 
        }),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [...headerParagraphs, table, ...footerParagraphs],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cnjClean = (processNumber || "processo").replace(/[^0-9]/g, "");
  const filename = `TIMELINE_${cnjClean}_${new Date().toISOString().split("T")[0]}.docx`;
  saveAs(blob, filename);
}

/**
 * Exporta a timeline como texto simples
 */
export function exportTimelineToTxt(
  extractionResult: EprocExtractionResult,
  processNumber: string
): void {
  const PLACEHOLDER = "Não identificado nos documentos analisados";
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("LINHA DO TEMPO PROCESSUAL");
  lines.push("=".repeat(60));
  lines.push("");

  const cnj = extractionResult.capa.numeroCnj !== PLACEHOLDER 
    ? extractionResult.capa.numeroCnj 
    : processNumber || "[PROCESSO]";
  lines.push(`Processo: ${cnj}`);
  lines.push(`Total de eventos: ${extractionResult.eventos.length}`);
  lines.push(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
  lines.push("");
  lines.push("-".repeat(60));
  lines.push("");

  extractionResult.eventos.forEach((evento, idx) => {
    const num = evento.numeroEvento || idx + 1;
    const data = evento.data || "[sem data]";
    const tipo = evento.tipoEvento || "EVENTO";
    const desc = evento.labelEnriquecido || evento.descricaoLiteral || "-";

    lines.push(`[${num}] ${data} - ${tipo}`);
    lines.push(`    ${desc}`);
    lines.push("");
  });

  lines.push("-".repeat(60));
  lines.push("Documento gerado pelo NIJA – Central de Análise Processual");
  lines.push("Os dados foram extraídos sem interpretação ou inferência automática.");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const cnjClean = (processNumber || "processo").replace(/[^0-9]/g, "");
  const filename = `TIMELINE_${cnjClean}_${new Date().toISOString().split("T")[0]}.txt`;
  saveAs(blob, filename);
}
