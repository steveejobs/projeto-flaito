import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry-run for safety

    console.log(`[hard-delete-orphan-documents] Starting... dryRun=${dryRun}`);

    // 1. Find orphan documents (no case_id, not soft-deleted)
    const { data: orphans, error: fetchError } = await supabase
      .from("documents")
      .select("id, storage_bucket, storage_path, filename, file_size")
      .is("case_id", null)
      .is("deleted_at", null);

    if (fetchError) {
      console.error("[hard-delete-orphan-documents] Fetch error:", fetchError);
      throw fetchError;
    }

    console.log(`[hard-delete-orphan-documents] Found ${orphans?.length || 0} orphan documents`);

    if (!orphans || orphans.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        dryRun,
        message: "No orphan documents found",
        deleted: [],
        summary: { count: 0, sizeMB: 0 }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: { id: string; filename: string; storageDeleted: boolean; dbDeleted: boolean; error?: string }[] = [];
    let totalSize = 0;

    for (const doc of orphans) {
      totalSize += doc.file_size || 0;

      if (dryRun) {
        results.push({
          id: doc.id,
          filename: doc.filename,
          storageDeleted: false,
          dbDeleted: false,
        });
        continue;
      }

      // Delete from storage first
      let storageDeleted = false;
      if (doc.storage_bucket && doc.storage_path) {
        const { error: storageError } = await supabase.storage
          .from(doc.storage_bucket)
          .remove([doc.storage_path]);

        if (storageError) {
          console.warn(`[hard-delete-orphan-documents] Storage delete failed for ${doc.storage_path}:`, storageError.message);
        } else {
          storageDeleted = true;
          console.log(`[hard-delete-orphan-documents] Storage deleted: ${doc.storage_path}`);
        }
      }

      // Delete from database (hard delete, bypassing soft-delete trigger)
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) {
        console.error(`[hard-delete-orphan-documents] DB delete failed for ${doc.id}:`, dbError);
        results.push({
          id: doc.id,
          filename: doc.filename,
          storageDeleted,
          dbDeleted: false,
          error: dbError.message,
        });
      } else {
        console.log(`[hard-delete-orphan-documents] DB deleted: ${doc.id}`);
        results.push({
          id: doc.id,
          filename: doc.filename,
          storageDeleted,
          dbDeleted: true,
        });
      }
    }

    const summary = {
      count: results.length,
      sizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
      storageDeleted: results.filter(r => r.storageDeleted).length,
      dbDeleted: results.filter(r => r.dbDeleted).length,
      errors: results.filter(r => r.error).length,
    };

    console.log(`[hard-delete-orphan-documents] Complete. Summary:`, summary);

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      message: dryRun 
        ? `Found ${summary.count} orphan documents (${summary.sizeMB} MB). Run with dryRun=false to delete.`
        : `Deleted ${summary.dbDeleted} documents from DB, ${summary.storageDeleted} files from storage.`,
      deleted: results,
      summary,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[hard-delete-orphan-documents] Error:", errMsg);
    return new Response(JSON.stringify({
      success: false,
      error: errMsg,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
