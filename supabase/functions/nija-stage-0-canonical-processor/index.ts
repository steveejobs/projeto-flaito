import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { routeProcessor } from "./modules/parsers.ts";
import { applyCleanup, calculateQuality, generateSectionIndex } from "./modules/quality.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROCESSOR_VERSION = "1.0.0";
const CLEANUP_RULES_VERSION = "v1";

interface CanonicalRequest {
  document_id: string;
  force_reprocess?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { document_id, force_reprocess }: CanonicalRequest = await req.json();
    if (!document_id) throw new Error("Document ID missing");

    // 1. Metadata
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !document) throw new Error("Document not found");

    // 2. Storage & Checksum
    const storagePath = document.storage_path || document.file_path;
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("documents")
      .download(storagePath);

    if (downloadError) throw new Error(`Storage error: ${downloadError.message}`);

    const fileArrayBuffer = await fileBlob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileArrayBuffer);
    const checksum = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 3. Cache Hit
    if (!force_reprocess) {
      const { data: existing } = await supabase
        .from("nija_canonical_documents")
        .select("*")
        .eq("checksum", checksum)
        .eq("processor_version", PROCESSOR_VERSION)
        .eq("cleanup_rules_version", CLEANUP_RULES_VERSION)
        .eq("processing_status", "COMPLETED")
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify(existing), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 4. Processing Status Initialize
    const { data: canonicalEntry, error: initError } = await supabase
      .from("nija_canonical_documents")
      .upsert({
        document_id,
        checksum,
        processor_version: PROCESSOR_VERSION,
        cleanup_rules_version: CLEANUP_RULES_VERSION,
        processing_status: "PROCESSING",
        source_mime_type: document.content_type || "application/octet-stream",
      })
      .select()
      .single();

    if (initError) throw initError;

    // 5. Execution Pipeline
    try {
      // Step A: Parse (Deterministic)
      const parseResult = await routeProcessor(fileArrayBuffer, document.content_type || "");
      
      // Step B: Cleanup (Deterministic Regex)
      const cleanedMarkdown = applyCleanup(parseResult.text);
      
      // Step C: Section Mapping
      const sections = generateSectionIndex(cleanedMarkdown);
      
      // Step D: Quality Evaluation
      const { score, metrics } = calculateQuality(parseResult.text, cleanedMarkdown);

      // 6. Persistence
      const { data: finalRecord, error: updateError } = await supabase
        .from("nija_canonical_documents")
        .update({
          canonical_markdown: cleanedMarkdown,
          section_index: sections,
          raw_text_backup: parseResult.text,
          input_quality_score: score,
          processing_status: "COMPLETED",
          has_text_layer: parseResult.has_text_layer,
          page_count: parseResult.page_count,
          parser_type: parseResult.parser_type,
          metadata: { metrics },
          updated_at: new Date().toISOString()
        })
        .eq("id", canonicalEntry.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Deterministic Error Guard: If scanned but NO text found
      if (!parseResult.has_text_layer && score === "BROKEN") {
        await supabase
          .from("nija_canonical_documents")
          .update({
            error_code: "NO_TEXT_LAYER_DETECTED",
            error_details: "O documento parece ser digitalizado sem camada de texto e o OCR local não foi habilitado."
          })
          .eq("id", canonicalEntry.id);
      }

      return new Response(JSON.stringify(finalRecord), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (processError) {
      await supabase
        .from("nija_canonical_documents")
        .update({
          processing_status: "FAILED",
          error_code: "PROCESSING_FAILED",
          error_details: processError.message
        })
        .eq("id", canonicalEntry.id);
      throw processError;
    }

  } catch (error) {
    console.error("[Stage 0] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
