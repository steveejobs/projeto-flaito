// supabase/functions/_shared/text-extraction.ts
// Shared text extraction logic for PDF, DOCX, TXT, HTML, and Markdown files.
// Used by both lexos-extract-text and knowledge-ingest Edge Functions.

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PAGES = 200;
const MAX_CHARS_PER_PAGE = 20000;
const MAX_TOTAL_CHARS = 300000;
const MIN_CHARS_TOTAL = 1500;
const MIN_COVERAGE_RATIO = 0.35;
const SERVER_TIMEOUT_MS = 45000;

export type ReadingStatus = "OK" | "TRUNCATED" | "INSUFFICIENT_READING" | "FALLBACK_CLIENT_PDFJS" | "ERROR";

export interface ExtractionReport {
  total_pages: number;
  pages_processed: number;
  pages_with_text: number;
  coverage_ratio: number;
  chars_total: number;
  truncated: boolean;
  truncated_reason?: string;
  has_text_layer: boolean;
  processing_time_ms: number;
  method: "pdfjs_server" | "regex_fallback" | "text_file";
}

export interface ExtractionResult {
  reading_status: ReadingStatus;
  extraction_report: ExtractionReport;
  extracted_text: string;
}

export function sanitizeForPostgresText(input: unknown): string {
  if (input === null || input === undefined) return "";
  let s = typeof input === "string" ? input : String(input);
  s = s.replace(/\u0000/g, "");
  s = s.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
  s = s.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, "");
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/\t/g, " ");
  s = s.replace(/[ \u00A0]+$/gm, "");
  s = s.replace(/\n{4,}/g, "\n\n\n");
  return s.trim();
}

export function sanitizeJsonForPostgres(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeForPostgresText(obj);
  if (Array.isArray(obj)) return obj.map((v) => sanitizeJsonForPostgres(v));
  if (typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitizeJsonForPostgres(v);
    return out;
  }
  return obj;
}

function extractTextFromPDF(bytes: Uint8Array, startTime: number): { text: string; report: ExtractionReport } {
  try {
    const decoder = new TextDecoder("latin1");
    const textParts: string[] = [];
    let pagesWithText = 0;

    const fullText = decoder.decode(bytes);
    const pageMatches = fullText.match(/\/Type\s*\/Page[^s]/g);
    const estimatedPages = pageMatches ? pageMatches.length : 1;
    const pagesToProcess = Math.min(estimatedPages, MAX_PAGES);
    const chunkSize = 50000;

    for (let i = 0; i < bytes.length && textParts.join("").length < MAX_TOTAL_CHARS; i += chunkSize) {
      if (Date.now() - startTime > SERVER_TIMEOUT_MS) break;

      const chunk = bytes.slice(i, Math.min(i + chunkSize + 1000, bytes.length));
      const text = decoder.decode(chunk);

      const matches = text.match(/\(([^)]{2,200})\)/g);
      if (matches) {
        for (const match of matches) {
          const content = match.slice(1, -1)
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, " ")
            .trim();

          if (content.length > 2 && !/^[\d\s.,-]+$/.test(content)) {
            textParts.push(content);
            pagesWithText++;
          }
        }
      }
    }

    let result = textParts.join(" ")
      .replace(/\s+/g, " ")
      .replace(/(.)\1{5,}/g, "$1$1")
      .trim();

    if (result.length > MAX_CHARS_PER_PAGE * pagesToProcess) {
      result = result.substring(0, MAX_CHARS_PER_PAGE * pagesToProcess);
    }

    return {
      text: result,
      report: {
        total_pages: estimatedPages,
        pages_processed: pagesToProcess,
        pages_with_text: Math.min(pagesWithText, pagesToProcess),
        coverage_ratio: estimatedPages > 0 ? Math.min(pagesWithText / estimatedPages, 1) : (result.length > 0 ? 1 : 0),
        chars_total: result.length,
        truncated: result.length >= MAX_TOTAL_CHARS || estimatedPages > MAX_PAGES,
        truncated_reason: estimatedPages > MAX_PAGES ? `Limitado a ${MAX_PAGES} páginas` : undefined,
        has_text_layer: result.length >= 50,
        processing_time_ms: Date.now() - startTime,
        method: "regex_fallback",
      },
    };
  } catch (error) {
    return {
      text: "",
      report: {
        total_pages: 0, pages_processed: 0, pages_with_text: 0, coverage_ratio: 0,
        chars_total: 0, truncated: false,
        truncated_reason: error instanceof Error ? error.message : "Erro ao processar PDF",
        has_text_layer: false, processing_time_ms: Date.now() - startTime, method: "regex_fallback",
      },
    };
  }
}

function extractTextFromDOCX(bytes: Uint8Array, startTime: number): { text: string; report: ExtractionReport } {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const textParts: string[] = [];
    const matches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);

    if (matches) {
      for (const match of matches) {
        const content = match.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, "");
        if (content.trim()) textParts.push(content);
      }
    }

    const result = textParts.join(" ").replace(/\s+/g, " ").trim();

    return {
      text: result,
      report: {
        total_pages: 1, pages_processed: 1,
        pages_with_text: result.length > 0 ? 1 : 0,
        coverage_ratio: result.length > 0 ? 1 : 0,
        chars_total: result.length, truncated: false,
        has_text_layer: result.length > 0,
        processing_time_ms: Date.now() - startTime, method: "regex_fallback",
      },
    };
  } catch (error) {
    return {
      text: "",
      report: {
        total_pages: 0, pages_processed: 0, pages_with_text: 0, coverage_ratio: 0,
        chars_total: 0, truncated: false,
        truncated_reason: error instanceof Error ? error.message : "Erro ao processar DOCX",
        has_text_layer: false, processing_time_ms: Date.now() - startTime, method: "regex_fallback",
      },
    };
  }
}

function stripHtmlTags(html: string): string {
  // Convert common block elements to newlines
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "\t");
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode common entities
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Extract text from raw file bytes based on file type.
 */
export function extractTextFromBytes(
  bytes: Uint8Array,
  filename: string,
  contentType: string,
  startTime: number
): ExtractionResult {
  const lowerFilename = (filename || "").toLowerCase();
  let extractedText = "";
  let report: ExtractionReport;

  // Text / Markdown / CSV
  if (contentType.includes("text/") || lowerFilename.endsWith(".txt") || lowerFilename.endsWith(".md") || lowerFilename.endsWith(".csv")) {
    extractedText = new TextDecoder("utf-8").decode(bytes);
    report = {
      total_pages: 1, pages_processed: 1,
      pages_with_text: extractedText.trim().length > 0 ? 1 : 0,
      coverage_ratio: 1, chars_total: extractedText.length, truncated: false,
      has_text_layer: true, processing_time_ms: Date.now() - startTime, method: "text_file",
    };
  }
  // PDF
  else if (contentType.includes("application/pdf") || lowerFilename.endsWith(".pdf")) {
    const r = extractTextFromPDF(bytes, startTime);
    extractedText = r.text;
    report = r.report;
  }
  // DOCX
  else if (contentType.includes("wordprocessingml") || lowerFilename.endsWith(".docx")) {
    const r = extractTextFromDOCX(bytes, startTime);
    extractedText = r.text;
    report = r.report;
  }
  // HTML
  else if (contentType.includes("text/html") || lowerFilename.endsWith(".html") || lowerFilename.endsWith(".htm")) {
    const rawHtml = new TextDecoder("utf-8").decode(bytes);
    extractedText = stripHtmlTags(rawHtml);
    report = {
      total_pages: 1, pages_processed: 1,
      pages_with_text: extractedText.trim().length > 0 ? 1 : 0,
      coverage_ratio: 1, chars_total: extractedText.length, truncated: false,
      has_text_layer: true, processing_time_ms: Date.now() - startTime, method: "text_file",
    };
  }
  // Fallback: try as text
  else {
    try {
      extractedText = new TextDecoder("utf-8").decode(bytes);
      if (extractedText.includes("\x00") || extractedText.length === 0) extractedText = "";
    } catch { extractedText = ""; }
    report = {
      total_pages: 1, pages_processed: 1,
      pages_with_text: extractedText.trim().length > 0 ? 1 : 0,
      coverage_ratio: extractedText.trim().length > 0 ? 1 : 0,
      chars_total: extractedText.length, truncated: false,
      has_text_layer: extractedText.length > 0,
      processing_time_ms: Date.now() - startTime, method: "text_file",
    };
  }

  // Truncate if needed
  if (extractedText.length > MAX_TOTAL_CHARS) {
    extractedText = extractedText.substring(0, MAX_TOTAL_CHARS);
    report.truncated = true;
    report.truncated_reason = `Texto truncado para ${MAX_TOTAL_CHARS} caracteres`;
    report.chars_total = MAX_TOTAL_CHARS;
  }

  // Determine reading status
  let readingStatus: ReadingStatus;
  if (report.chars_total < 50) {
    readingStatus = "FALLBACK_CLIENT_PDFJS";
  } else if (report.chars_total < MIN_CHARS_TOTAL || report.coverage_ratio < MIN_COVERAGE_RATIO) {
    readingStatus = "INSUFFICIENT_READING";
  } else if (report.truncated) {
    readingStatus = "TRUNCATED";
  } else {
    readingStatus = "OK";
  }

  report.processing_time_ms = Date.now() - startTime;

  const sanitizedText = sanitizeForPostgresText(extractedText);
  const sanitizedReport = sanitizeJsonForPostgres({ ...report, chars_total: sanitizedText.length });

  return {
    reading_status: readingStatus,
    extraction_report: sanitizedReport,
    extracted_text: sanitizedText,
  };
}

/**
 * Convert extracted plain text to canonical Markdown.
 * Preserves paragraph structure, detects headings, lists, and cleans formatting.
 */
export function convertToCanonicalMarkdown(text: string, filename: string): string {
  if (!text || text.trim().length === 0) return "";

  // If already Markdown (from .md file), just clean it
  if (filename.toLowerCase().endsWith(".md")) {
    return text.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  }

  const lines = text.split("\n");
  const mdLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) inList = false;
      mdLines.push("");
      continue;
    }

    // Detect numbered headings like "1. TÍTULO" or "CAPÍTULO I"
    if (/^(CAPÍTULO|TÍTULO|SEÇÃO|ARTIGO|Art\.|PARTE)\s/i.test(trimmed) && trimmed.length < 120) {
      mdLines.push(`## ${trimmed}`);
      continue;
    }

    // Detect ALL CAPS short lines as headings
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 100 && !/^\d/.test(trimmed)) {
      mdLines.push(`### ${trimmed}`);
      continue;
    }

    // Detect bullet/numbered list items
    if (/^[\-\*•]\s/.test(trimmed)) {
      mdLines.push(`- ${trimmed.replace(/^[\-\*•]\s*/, "")}`);
      inList = true;
      continue;
    }
    if (/^\d+[\.\)]\s/.test(trimmed)) {
      mdLines.push(trimmed);
      inList = true;
      continue;
    }

    // Regular paragraph
    mdLines.push(trimmed);
  }

  // Clean up excessive blank lines
  let result = mdLines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();

  // Add title from filename
  const title = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

  return `# ${title}\n\n${result}`;
}
