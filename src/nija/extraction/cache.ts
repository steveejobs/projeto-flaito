/**
 * NIJA Extraction Cache - Uses nija_extractions as idempotent index pointing to document_id
 * 
 * Cache key: sha256(rawText + "|" + system + "|" + extractor_version)
 * 
 * Architecture:
 * - public.documents is the single source of truth for extracted_text and extraction_report
 * - nija_extractions is an index that points to document_id for cache lookup
 * 
 * Rules:
 * - Never extract/save without (case_id OR session_id)
 * - Check cache BEFORE running extractEprocDataPure
 * - When cache hit with document_id, load extraction_report from documents table
 * - Save result after extraction with upsert on (office_id, extraction_hash)
 */

import { supabase } from "@/integrations/supabase/client";
import { sanitizeForPostgresText, sanitizeJsonForPostgres } from "@/lib/sanitizeForPostgres";
import type { EprocExtractionResult } from "@/nija/extraction/mode";
import type { DetectedProcessSystem } from "@/nija/connectors/eproc/detector";

const EXTRACTOR_VERSION = "v1";

/**
 * Compute extraction hash: sha256(rawText + "|" + system + "|" + extractor_version)
 */
export async function computeExtractionHash(
  rawText: string,
  system: DetectedProcessSystem
): Promise<string> {
  const payload = `${rawText}|${system}|${EXTRACTOR_VERSION}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(buf));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute documents hash for the documents_hash column
 */
export async function computeDocumentsHashForCache(rawText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawText);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(buf));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ExtractionCacheParams {
  rawText: string;
  system: DetectedProcessSystem;
  officeId: string;
  caseId?: string | null;
  sessionId?: string | null;
}

export interface CachedExtraction {
  result: EprocExtractionResult;
  fromCache: boolean;
  documentId?: string | null;
}

/**
 * Validate if a cached extraction result is valid (has events)
 * Invalid caches are automatically deleted
 */
function isValidCacheResult(result: EprocExtractionResult | null): boolean {
  if (!result) return false;
  // Must have at least one event to be considered valid
  const eventos = Array.isArray(result.eventos) ? result.eventos : [];
  return eventos.length > 0;
}

/**
 * Look up cached extraction by extraction_hash
 * If document_id exists, load extraction_report from documents table
 * Returns null if not found OR if cache is invalid (no events)
 * 
 * IMPORTANT: Invalid caches (without events) are automatically deleted
 */
export async function getCachedExtraction(
  officeId: string,
  extractionHash: string
): Promise<EprocExtractionResult | null> {
  try {
    const { data, error } = await supabase
      .from("nija_extractions")
      .select("id, result_json, document_id")
      .eq("office_id", officeId)
      .eq("extraction_hash", extractionHash)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[ExtractionCache] Error fetching cache:", error);
      return null;
    }

    if (!data) {
      console.log("[ExtractionCache] Cache MISS");
      return null;
    }

    let result: EprocExtractionResult | null = null;

    // If document_id exists, load extraction_report from documents table (source of truth)
    if (data.document_id) {
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .select("extraction_report")
        .eq("id", data.document_id)
        .maybeSingle();

      if (!docError && docData?.extraction_report) {
        result = docData.extraction_report as unknown as EprocExtractionResult;
      }
    }

    // Fallback to result_json if document lookup fails
    if (!result && data.result_json) {
      result = data.result_json as unknown as EprocExtractionResult;
    }

    // VALIDATION: If cache has no events, delete it and return null
    if (!isValidCacheResult(result)) {
      console.log("[ExtractionCache] Cache INVALID (no events) - deleting...");
      await supabase
        .from("nija_extractions")
        .delete()
        .eq("office_id", officeId)
        .eq("extraction_hash", extractionHash);
      return null;
    }

    const eventCount = result?.eventos?.length ?? 0;
    console.log(`[ExtractionCache] Cache HIT (${eventCount} eventos)`);
    return result;
  } catch (err) {
    console.warn("[ExtractionCache] Exception fetching cache:", err);
    return null;
  }
}

/**
 * Save extraction result to cache via upsert
 * Points to document_id as source of truth
 */
export async function saveExtractionToCache(params: {
  officeId: string;
  caseId?: string | null;
  sessionId?: string | null;
  documentId?: string | null;
  system: DetectedProcessSystem;
  extractionHash: string;
  documentsHash: string;
  result: EprocExtractionResult;
  createdBy?: string | null;
}): Promise<boolean> {
  const {
    officeId,
    caseId,
    sessionId,
    documentId,
    system,
    extractionHash,
    documentsHash,
    result,
    createdBy,
  } = params;

  // Rule: never save without (case_id OR session_id)
  if (!caseId && !sessionId) {
    console.warn("[ExtractionCache] Skip save: no case_id or session_id");
    return false;
  }

  try {
    // Sanitize result before persisting (prevents Postgres 22P05 error)
    const sanitizedResultJson = sanitizeJsonForPostgres(result);

    const payload: Record<string, unknown> = {
      office_id: officeId,
      extraction_hash: extractionHash,
      documents_hash: documentsHash,
      system,
      extractor_version: EXTRACTOR_VERSION,
      result_json: sanitizedResultJson as unknown,
    };

    if (caseId) payload.case_id = caseId;
    if (sessionId) payload.session_id = sessionId;
    if (documentId) payload.document_id = documentId;
    if (createdBy) payload.created_by = createdBy;

    const { error } = await supabase
      .from("nija_extractions")
      .upsert(payload as any, {
        onConflict: "office_id,extraction_hash",
      });

    if (error) {
      console.warn("[ExtractionCache] Error saving to cache:", error);
      return false;
    }

    console.log("[ExtractionCache] Saved to cache", documentId ? `(document_id: ${documentId})` : "");
    return true;
  } catch (err) {
    console.warn("[ExtractionCache] Exception saving to cache:", err);
    return false;
  }
}

/**
 * Update document with extraction data (source of truth)
 */
export async function updateDocumentExtraction(params: {
  documentId: string;
  extractedText: string;
  extractionReport: EprocExtractionResult;
  extractionMethod?: string;
}): Promise<boolean> {
  const { documentId, extractedText, extractionReport, extractionMethod } = params;

  try {
    // Sanitize text and report before persisting (prevents Postgres 22P05 error)
    const sanitizedText = sanitizeForPostgresText(extractedText);
    const sanitizedReport = sanitizeJsonForPostgres(extractionReport);

    const updatePayload: Record<string, unknown> = {
      extracted_text: sanitizedText,
      extraction_report: sanitizedReport as unknown,
      extracted_text_chars: sanitizedText.length,
      extraction_updated_at: new Date().toISOString(),
    };

    if (extractionMethod) {
      updatePayload.extraction_method = extractionMethod;
    }

    const { error } = await supabase
      .from("documents")
      .update(updatePayload)
      .eq("id", documentId);

    if (error) {
      console.warn("[ExtractionCache] Error updating document extraction:", error);
      return false;
    }

    console.log("[ExtractionCache] Document extraction updated:", documentId);
    return true;
  } catch (err) {
    console.warn("[ExtractionCache] Exception updating document:", err);
    return false;
  }
}

/**
 * Save extraction with document as source of truth
 * 1. Updates document with extracted_text and extraction_report
 * 2. Creates/updates nija_extractions index pointing to document_id
 */
export async function saveExtractionWithDocument(params: {
  officeId: string;
  documentId: string;
  caseId?: string | null;
  sessionId?: string | null;
  system: DetectedProcessSystem;
  rawText: string;
  result: EprocExtractionResult;
  createdBy?: string | null;
  extractionMethod?: string;
}): Promise<boolean> {
  const {
    officeId,
    documentId,
    caseId,
    sessionId,
    system,
    rawText,
    result,
    createdBy,
    extractionMethod,
  } = params;

  // Rule: never save without (case_id OR session_id)
  if (!caseId && !sessionId) {
    console.warn("[ExtractionCache] Skip save: no case_id or session_id");
    return false;
  }

  try {
    // Step 1: Update document (source of truth)
    const docUpdated = await updateDocumentExtraction({
      documentId,
      extractedText: rawText,
      extractionReport: result,
      extractionMethod,
    });

    if (!docUpdated) {
      console.warn("[ExtractionCache] Failed to update document, skipping cache index");
      return false;
    }

    // Step 2: Calculate hashes
    const extractionHash = await computeExtractionHash(rawText, system);
    const documentsHash = await computeDocumentsHashForCache(rawText);

    // Step 3: Create/update cache index pointing to document_id
    const saved = await saveExtractionToCache({
      officeId,
      caseId,
      sessionId,
      documentId,
      system,
      extractionHash,
      documentsHash,
      result,
      createdBy,
    });

    return saved;
  } catch (err) {
    console.warn("[ExtractionCache] Exception in saveExtractionWithDocument:", err);
    return false;
  }
}

/**
 * Get user's office_id from session
 */
export async function getCurrentOfficeId(): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return null;

    const { data: memberData } = await supabase
      .from("office_members")
      .select("office_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    return memberData?.office_id || null;
  } catch {
    return null;
  }
}

/**
 * Get current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData?.session?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Delete cached extraction entry (forces cache MISS)
 */
export async function deleteCachedExtraction(officeId: string, extractionHash: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("nija_extractions")
      .delete()
      .eq("office_id", officeId)
      .eq("extraction_hash", extractionHash);

    if (error) {
      console.warn("[ExtractionCache] Error deleting cache:", error);
      return false;
    }

    console.log("[ExtractionCache] Cache entry deleted", { officeId, extractionHash });
    return true;
  } catch (err) {
    console.warn("[ExtractionCache] Exception deleting cache:", err);
    return false;
  }
}

/**
 * Update cache entry with case_id after case creation
 * Links the extraction to the created case for future lookups
 */
export async function updateExtractionCaseId(params: {
  officeId: string;
  extractionHash: string;
  caseId: string;
}): Promise<boolean> {
  const { officeId, extractionHash, caseId } = params;

  try {
    const { error } = await supabase
      .from("nija_extractions")
      .update({ case_id: caseId })
      .eq("office_id", officeId)
      .eq("extraction_hash", extractionHash);

    if (error) {
      console.warn("[ExtractionCache] Error updating case_id:", error);
      return false;
    }

    console.log("[ExtractionCache] case_id linked to extraction:", caseId);
    return true;
  } catch (err) {
    console.warn("[ExtractionCache] Exception updating case_id:", err);
    return false;
  }
}
