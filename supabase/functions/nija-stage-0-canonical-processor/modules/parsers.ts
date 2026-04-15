/**
 * Stage 0 Parsers Module
 * Deterministic conversion of PDF/DOCX to Markdown.
 */

import mammoth from "https://esm.sh/mammoth@1.7.2";
// Note: pdf-parse might need a Deno-compatible buffer or shims. 
// Using a basic structure that can be swapped if environment-specific issues arise.

export interface ParserResult {
  text: string;
  has_text_layer: boolean;
  page_count: number;
  parser_type: string;
}

export async function parseDocx(buffer: ArrayBuffer): Promise<ParserResult> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return {
    text: result.value,
    has_text_layer: true,
    page_count: 1, // Mammoth doesn't cleanly expose page counts
    parser_type: "docx"
  };
}

export async function parsePdfNative(buffer: ArrayBuffer): Promise<ParserResult> {
  // Mocking the extraction logic for now using specialized regex if pdf-parse fails in Edge environment.
  // In a real environment, we'd use a robust Deno-native PDF parser.
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(new Uint8Array(buffer));
  
  // Deterministic detection of /Type /Page
  const pageMatches = raw.match(/\/Type\s*\/Page[^s]/g);
  const pageCount = pageMatches ? pageMatches.length : 1;

  // Basic native extraction (similar to lexos-extract-text but enforced as Stage 0)
  const textParts: string[] = [];
  const matches = raw.match(/\(([^)]{2,200})\)/g);
  if (matches) {
    for (const match of matches) {
      const content = match.slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, " ")
        .trim();
      if (content.length > 2) textParts.push(content);
    }
  }

  const text = textParts.join(" ");
  const has_text_layer = text.length > 100;

  return {
    text,
    has_text_layer,
    page_count: pageCount,
    parser_type: has_text_layer ? "native_pdf" : "scanned_pdf"
  };
}

export async function routeProcessor(buffer: ArrayBuffer, mimeType: string): Promise<ParserResult> {
  if (mimeType.includes("word") || mimeType.endsWith(".docx")) {
    return await parseDocx(buffer);
  } else if (mimeType.includes("pdf") || mimeType.endsWith(".pdf")) {
    return await parsePdfNative(buffer);
  } else if (mimeType.includes("image")) {
    return {
      text: "",
      has_text_layer: false,
      page_count: 1,
      parser_type: "image"
    };
  }
  
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}
