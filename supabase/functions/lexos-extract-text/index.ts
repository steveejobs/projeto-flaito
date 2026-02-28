import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitization helpers to prevent Postgres 22P05 error (NUL character)
function sanitizeForPostgresText(input: unknown): string {
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

function sanitizeJsonForPostgres(obj: any): any {
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

// ============================================================
// CONSTANTS (sync with src/nija/extraction/constants.ts)
// ============================================================
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PAGES = 200;
const MAX_CHARS_PER_PAGE = 20000;
const MAX_TOTAL_CHARS = 300000;
const MIN_CHARS_TOTAL = 1500;
const MIN_COVERAGE_RATIO = 0.35;
const SERVER_TIMEOUT_MS = 45000; // 45s server-side
// ============================================================

type ReadingStatus = "OK" | "TRUNCATED" | "INSUFFICIENT_READING" | "FALLBACK_CLIENT_PDFJS" | "ERROR";

interface ExtractionReport {
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

interface ExtractionResult {
  reading_status: ReadingStatus;
  extraction_report: ExtractionReport;
  extracted_text: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { url, filename, document_id } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[lexos-extract-text] Iniciando extração:", { filename, document_id });

    // Verificar tamanho do arquivo
    const headResponse = await fetch(url, { method: "HEAD" });
    const contentLength = parseInt(headResponse.headers.get("content-length") || "0");
    
    if (contentLength > MAX_FILE_SIZE) {
      console.log(`[lexos-extract-text] Arquivo muito grande: ${(contentLength / 1024 / 1024).toFixed(2)}MB`);
      const result: ExtractionResult = {
        reading_status: "FALLBACK_CLIENT_PDFJS",
        extraction_report: {
          total_pages: 0,
          pages_processed: 0,
          pages_with_text: 0,
          coverage_ratio: 0,
          chars_total: 0,
          truncated: false,
          truncated_reason: `Arquivo muito grande: ${(contentLength / 1024 / 1024).toFixed(1)}MB. Limite: 10MB.`,
          has_text_layer: false,
          processing_time_ms: Date.now() - startTime,
          method: "regex_fallback",
        },
        extracted_text: "",
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Baixar o arquivo
    const fileResponse = await fetch(url);
    if (!fileResponse.ok) {
      throw new Error(`Falha ao baixar: ${fileResponse.status}`);
    }

    const contentType = fileResponse.headers.get("content-type") || "";
    const arrayBuffer = await fileResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const lowerFilename = (filename || "").toLowerCase();

    console.log(`[lexos-extract-text] Arquivo baixado: ${bytes.length} bytes, tipo: ${contentType}`);

    let extractedText = "";
    let report: ExtractionReport;

    // Arquivo de texto puro
    if (contentType.includes("text/") || lowerFilename.endsWith(".txt") || lowerFilename.endsWith(".md") || lowerFilename.endsWith(".csv")) {
      extractedText = new TextDecoder("utf-8").decode(bytes);
      report = {
        total_pages: 1,
        pages_processed: 1,
        pages_with_text: extractedText.trim().length > 0 ? 1 : 0,
        coverage_ratio: 1,
        chars_total: extractedText.length,
        truncated: false,
        has_text_layer: true,
        processing_time_ms: Date.now() - startTime,
        method: "text_file",
      };
    } 
    // PDF
    else if (contentType.includes("application/pdf") || lowerFilename.endsWith(".pdf")) {
      const pdfResult = extractTextFromPDF(bytes, startTime);
      extractedText = pdfResult.text;
      report = pdfResult.report;
    } 
    // DOCX
    else if (contentType.includes("wordprocessingml") || lowerFilename.endsWith(".docx")) {
      const docxResult = extractTextFromDOCX(bytes, startTime);
      extractedText = docxResult.text;
      report = docxResult.report;
    } 
    // Tentar como texto
    else {
      try {
        extractedText = new TextDecoder("utf-8").decode(bytes);
        if (extractedText.includes("\x00") || extractedText.length === 0) {
          extractedText = "";
        }
      } catch {
        extractedText = "";
      }
      report = {
        total_pages: 1,
        pages_processed: 1,
        pages_with_text: extractedText.trim().length > 0 ? 1 : 0,
        coverage_ratio: extractedText.trim().length > 0 ? 1 : 0,
        chars_total: extractedText.length,
        truncated: false,
        has_text_layer: extractedText.length > 0,
        processing_time_ms: Date.now() - startTime,
        method: "text_file",
      };
    }

    // Truncar se exceder limite total
    if (extractedText.length > MAX_TOTAL_CHARS) {
      extractedText = extractedText.substring(0, MAX_TOTAL_CHARS);
      report.truncated = true;
      report.truncated_reason = `Texto truncado para ${MAX_TOTAL_CHARS} caracteres`;
      report.chars_total = MAX_TOTAL_CHARS;
    }

    // Determinar status baseado em limiares
    let readingStatus: ReadingStatus;
    
    if (report.chars_total < 50) {
      // Muito pouco texto - provavelmente PDF de imagem, tentar client-side
      readingStatus = "FALLBACK_CLIENT_PDFJS";
    } else if (report.chars_total < MIN_CHARS_TOTAL || report.coverage_ratio < MIN_COVERAGE_RATIO) {
      readingStatus = "INSUFFICIENT_READING";
    } else if (report.truncated) {
      readingStatus = "TRUNCATED";
    } else {
      readingStatus = "OK";
    }

    report.processing_time_ms = Date.now() - startTime;

    // Sanitize text and report before persisting/returning (prevents Postgres 22P05 error)
    const sanitizedText = sanitizeForPostgresText(extractedText);
    const sanitizedReport = sanitizeJsonForPostgres({ ...report, chars_total: sanitizedText.length });

    const result: ExtractionResult = {
      reading_status: readingStatus,
      extraction_report: sanitizedReport,
      extracted_text: sanitizedText,
    };

    console.log(`[lexos-extract-text] Extração concluída: status=${readingStatus}, chars=${sanitizedReport.chars_total}, coverage=${sanitizedReport.coverage_ratio.toFixed(2)}`);

    // Salvar no banco se document_id foi fornecido
    if (document_id && (readingStatus === "OK" || readingStatus === "TRUNCATED")) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          await supabase.from("documents").update({
            extracted_text: sanitizedText,
            reading_status: readingStatus,
            extraction_report: sanitizedReport,
            extracted_text_chars: sanitizedText.length,
            extracted_pages_total: sanitizedReport.total_pages,
            extracted_pages_with_text: sanitizedReport.pages_with_text,
            extracted_coverage_ratio: sanitizedReport.coverage_ratio,
            extraction_method: "server",
            extraction_updated_at: new Date().toISOString(),
          }).eq("id", document_id);
          
          console.log(`[lexos-extract-text] Documento ${document_id} atualizado no banco`);
        }
      } catch (dbError) {
        console.error("[lexos-extract-text] Erro ao salvar no banco:", dbError);
        // Não falhar a extração por erro de DB
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[lexos-extract-text] Erro:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    
    const result: ExtractionResult = {
      reading_status: "ERROR",
      extraction_report: {
        total_pages: 0,
        pages_processed: 0,
        pages_with_text: 0,
        coverage_ratio: 0,
        chars_total: 0,
        truncated: false,
        truncated_reason: msg,
        has_text_layer: false,
        processing_time_ms: Date.now() - (Date.now()),
        method: "regex_fallback",
      },
      extracted_text: "",
    };

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Extração de texto de PDF via regex (método básico)
function extractTextFromPDF(bytes: Uint8Array, startTime: number): { text: string; report: ExtractionReport } {
  try {
    const chunkSize = 50000;
    const textParts: string[] = [];
    const decoder = new TextDecoder("latin1");
    let pagesWithText = 0;
    let estimatedPages = 0;
    
    // Estimar número de páginas
    const fullText = decoder.decode(bytes);
    const pageMatches = fullText.match(/\/Type\s*\/Page[^s]/g);
    estimatedPages = pageMatches ? pageMatches.length : 1;
    
    // Limitar páginas processadas
    const pagesToProcess = Math.min(estimatedPages, MAX_PAGES);
    
    for (let i = 0; i < bytes.length && textParts.join("").length < MAX_TOTAL_CHARS; i += chunkSize) {
      // Check timeout
      if (Date.now() - startTime > SERVER_TIMEOUT_MS) {
        console.log("[lexos-extract-text] Timeout atingido durante extração");
        break;
      }
      
      const chunk = bytes.slice(i, Math.min(i + chunkSize + 1000, bytes.length));
      const text = decoder.decode(chunk);
      
      // Extrair texto entre parênteses (conteúdo de texto em PDF)
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
    
    // Limpar e juntar
    let result = textParts.join(" ")
      .replace(/\s+/g, " ")
      .replace(/(.)\1{5,}/g, "$1$1") // Remover caracteres repetidos
      .trim();
    
    // Limitar por página
    if (result.length > MAX_CHARS_PER_PAGE * pagesToProcess) {
      result = result.substring(0, MAX_CHARS_PER_PAGE * pagesToProcess);
    }
    
    const hasTextLayer = result.length >= 50;
    const coverageRatio = estimatedPages > 0 ? Math.min(pagesWithText / estimatedPages, 1) : (result.length > 0 ? 1 : 0);
    
    return {
      text: result,
      report: {
        total_pages: estimatedPages,
        pages_processed: pagesToProcess,
        pages_with_text: Math.min(pagesWithText, pagesToProcess),
        coverage_ratio: coverageRatio,
        chars_total: result.length,
        truncated: result.length >= MAX_TOTAL_CHARS || estimatedPages > MAX_PAGES,
        truncated_reason: estimatedPages > MAX_PAGES ? `Limitado a ${MAX_PAGES} páginas` : undefined,
        has_text_layer: hasTextLayer,
        processing_time_ms: Date.now() - startTime,
        method: "regex_fallback",
      },
    };
  } catch (error) {
    console.error("[lexos-extract-text] Erro PDF:", error);
    return {
      text: "",
      report: {
        total_pages: 0,
        pages_processed: 0,
        pages_with_text: 0,
        coverage_ratio: 0,
        chars_total: 0,
        truncated: false,
        truncated_reason: error instanceof Error ? error.message : "Erro ao processar PDF",
        has_text_layer: false,
        processing_time_ms: Date.now() - startTime,
        method: "regex_fallback",
      },
    };
  }
}

// Extração de texto de DOCX
function extractTextFromDOCX(bytes: Uint8Array, startTime: number): { text: string; report: ExtractionReport } {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const textParts: string[] = [];
    const matches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    
    if (matches) {
      for (const match of matches) {
        const content = match.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, "");
        if (content.trim()) {
          textParts.push(content);
        }
      }
    }
    
    const result = textParts.join(" ").replace(/\s+/g, " ").trim();
    
    return {
      text: result,
      report: {
        total_pages: 1,
        pages_processed: 1,
        pages_with_text: result.length > 0 ? 1 : 0,
        coverage_ratio: result.length > 0 ? 1 : 0,
        chars_total: result.length,
        truncated: false,
        has_text_layer: result.length > 0,
        processing_time_ms: Date.now() - startTime,
        method: "regex_fallback",
      },
    };
  } catch (error) {
    console.error("[lexos-extract-text] Erro DOCX:", error);
    return {
      text: "",
      report: {
        total_pages: 0,
        pages_processed: 0,
        pages_with_text: 0,
        coverage_ratio: 0,
        chars_total: 0,
        truncated: false,
        truncated_reason: error instanceof Error ? error.message : "Erro ao processar DOCX",
        has_text_layer: false,
        processing_time_ms: Date.now() - startTime,
        method: "regex_fallback",
      },
    };
  }
}
