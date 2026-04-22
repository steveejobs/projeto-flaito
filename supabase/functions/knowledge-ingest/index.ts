// supabase/functions/knowledge-ingest/index.ts
// Orchestrates: file download → text extraction → Markdown normalization → chunking/embedding
// This is the canonical pipeline for private knowledge ingestion.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  extractTextFromBytes,
  convertToCanonicalMarkdown,
  sanitizeForPostgresText,
} from "../_shared/text-extraction.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IngestRequest {
  file_name: string;
  storage_path: string;
  office_id: string;
  knowledge_file_id?: string; // If already created, update it
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { file_name, storage_path, office_id, knowledge_file_id }: IngestRequest = await req.json();

    if (!file_name || !storage_path || !office_id) {
      return new Response(
        JSON.stringify({ error: "file_name, storage_path, and office_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[knowledge-ingest] Starting: ${file_name} for office ${office_id}`);

    // Detect file type from extension
    const ext = file_name.split(".").pop()?.toLowerCase() || "txt";
    const fileTypeMap: Record<string, string> = {
      pdf: "pdf", docx: "docx", doc: "docx", txt: "txt",
      md: "md", html: "html", htm: "html", epub: "epub",
    };
    const file_type = fileTypeMap[ext] || "txt";

    // ── Step 1: Create or update knowledge_files record ──
    let fileId = knowledge_file_id;

    if (!fileId) {
      const { data: inserted, error: insertErr } = await supabase
        .from("knowledge_files")
        .insert({
          office_id,
          original_filename: file_name,
          file_type,
          storage_path,
          ingestion_status: "pending",
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`Failed to create knowledge_files record: ${insertErr.message}`);
      fileId = inserted.id;
    }

    // Log audit
    await supabase.from("knowledge_audit_log").insert({
      office_id,
      action: "upload",
      knowledge_file_id: fileId,
      details: { file_name, file_type, storage_path },
    });

    // ── Step 2: Update status to extracting ──
    await supabase
      .from("knowledge_files")
      .update({ ingestion_status: "extracting" })
      .eq("id", fileId);

    // ── Step 3: Download file from storage ──
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("knowledge-files")
      .download(storage_path);

    if (downloadErr || !fileData) {
      await updateError(supabase, fileId, `Download failed: ${downloadErr?.message || "No data"}`);
      throw new Error(`Download failed: ${downloadErr?.message}`);
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const fileSize = bytes.length;

    // Update file size
    await supabase
      .from("knowledge_files")
      .update({ file_size_bytes: fileSize })
      .eq("id", fileId);

    console.log(`[knowledge-ingest] Downloaded ${fileSize} bytes for ${file_name}`);

    // Log extraction start
    await supabase.from("knowledge_audit_log").insert({
      office_id,
      action: "extract",
      knowledge_file_id: fileId,
      details: { file_size: fileSize, file_type },
    });

    // ── Step 4: Extract text ──
    const startTime = Date.now();
    const extraction = extractTextFromBytes(bytes, file_name, "", startTime);

    if (extraction.reading_status === "ERROR" || extraction.extracted_text.length < 50) {
      await updateError(supabase, fileId, `Extraction failed or insufficient text: ${extraction.extraction_report.truncated_reason || "Too little text"}`);
      return new Response(JSON.stringify({
        success: false,
        knowledge_file_id: fileId,
        error: "Extraction produced insufficient text",
        report: extraction.extraction_report,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Step 5: Convert to canonical Markdown ──
    await supabase
      .from("knowledge_files")
      .update({ ingestion_status: "converting" })
      .eq("id", fileId);

    const canonicalMarkdown = convertToCanonicalMarkdown(extraction.extracted_text, file_name);

    // ── Step 6: Store canonical Markdown ──
    await supabase
      .from("knowledge_files")
      .update({
        canonical_markdown: sanitizeForPostgresText(canonicalMarkdown),
        ingestion_status: "chunking",
        metadata: {
          extraction_report: extraction.extraction_report,
          reading_status: extraction.reading_status,
          chars_extracted: extraction.extracted_text.length,
          chars_markdown: canonicalMarkdown.length,
        },
      })
      .eq("id", fileId);

    // ── Step 7: Create office_knowledge entry for vector indexing ──
    const title = file_name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");

    const { data: knowledgeEntry, error: knowledgeErr } = await supabase
      .from("office_knowledge")
      .insert({
        office_id,
        type: "piece",
        title,
        content: canonicalMarkdown,
        tags: [file_type, "uploaded"],
        is_active: true,
        metadata: {
          knowledge_file_id: fileId,
          source_type: "private_knowledge",
          original_filename: file_name,
        },
      })
      .select("id")
      .single();

    if (knowledgeErr) {
      console.error(`[knowledge-ingest] Failed to create office_knowledge: ${knowledgeErr.message}`);
      await updateError(supabase, fileId, `Failed to create knowledge entry: ${knowledgeErr.message}`);
      throw knowledgeErr;
    }

    // ── Step 8: Trigger vector embedding via nija-embed-chunks ──
    console.log(`[knowledge-ingest] Triggering embedding for knowledge ${knowledgeEntry.id}`);

    await supabase.from("knowledge_audit_log").insert({
      office_id,
      action: "chunk",
      knowledge_file_id: fileId,
      details: { knowledge_id: knowledgeEntry.id },
    });

    // Call nija-embed-chunks directly using internal service
    const embedResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/nija-embed-chunks`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          knowledge_id: knowledgeEntry.id,
          office_id,
          force_reindex: true,
        }),
      }
    );

    const embedResult = await embedResponse.json();
    console.log(`[knowledge-ingest] Embedding result:`, embedResult);

    // ── Step 9: Mark as ready ──
    await supabase
      .from("knowledge_files")
      .update({
        ingestion_status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId);

    return new Response(JSON.stringify({
      success: true,
      knowledge_file_id: fileId,
      knowledge_id: knowledgeEntry.id,
      file_type,
      chars_extracted: extraction.extracted_text.length,
      chars_markdown: canonicalMarkdown.length,
      chunks_created: embedResult.total_chunks || 0,
      reading_status: extraction.reading_status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[knowledge-ingest] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function updateError(supabase: any, fileId: string, error: string) {
  await supabase
    .from("knowledge_files")
    .update({
      ingestion_status: "error",
      ingestion_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileId);

  // Also log the error
  const { data } = await supabase
    .from("knowledge_files")
    .select("office_id")
    .eq("id", fileId)
    .single();

  if (data?.office_id) {
    await supabase.from("knowledge_audit_log").insert({
      office_id: data.office_id,
      action: "error",
      knowledge_file_id: fileId,
      details: { error },
    });
  }
}
