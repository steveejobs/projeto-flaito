import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrphanResult {
  bucket: string;
  path: string;
  size: number;
  reason: string;
  category: "client-files" | "documents" | "soft-deleted" | "temp-files";
}

interface CleanupSummary {
  clientFilesOrphans: number;
  documentOrphans: number;
  softDeletedOrphans: number;
  tempFilesOrphans: number;
  totalSizeMB: number;
}

interface CleanupResult {
  scanned: number;
  orphansFound: OrphanResult[];
  deleted: string[];
  errors: string[];
  dryRun: boolean;
  summary: CleanupSummary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run for safety
    const buckets = body.buckets || ["client-files", "documents", "nija_tmp"];
    const includeSoftDeleted = body.includeSoftDeleted === true;
    const tempFileMaxAgeHours = body.tempFileMaxAgeHours || 24;

    console.log(`[cleanup-orphan-files] Starting cleanup. Dry run: ${dryRun}, Include soft-deleted: ${includeSoftDeleted}`);

    const result: CleanupResult = {
      scanned: 0,
      orphansFound: [],
      deleted: [],
      errors: [],
      dryRun,
      summary: {
        clientFilesOrphans: 0,
        documentOrphans: 0,
        softDeletedOrphans: 0,
        tempFilesOrphans: 0,
        totalSizeMB: 0,
      },
    };

    // Get all existing client IDs for reference
    const { data: existingClients } = await supabase
      .from("clients")
      .select("id, office_id");
    
    const clientIds = new Set((existingClients || []).map(c => c.id));
    console.log(`[cleanup-orphan-files] Found ${clientIds.size} existing clients`);

    // Process client-files bucket
    if (buckets.includes("client-files")) {
      console.log("[cleanup-orphan-files] Scanning bucket: client-files");
      
      const { data: files, error: listError } = await supabase.storage
        .from("client-files")
        .list("", { limit: 1000 });

      if (listError) {
        result.errors.push(`Error listing client-files: ${listError.message}`);
      } else if (files) {
        // files at root level are office folders
        for (const officeFolder of files) {
          if (!officeFolder.id) continue; // Skip non-folders
          
          const { data: clientFolders } = await supabase.storage
            .from("client-files")
            .list(officeFolder.name, { limit: 1000 });
          
          if (!clientFolders) continue;

          for (const clientFolder of clientFolders) {
            if (!clientFolder.id) continue;
            
            const clientId = clientFolder.name;
            result.scanned++;

            if (!clientIds.has(clientId)) {
              // This is an orphan folder - get all files recursively
              const orphanFiles = await listAllFilesRecursive(
                supabaseUrl,
                serviceRoleKey,
                "client-files",
                `${officeFolder.name}/${clientId}`
              );

              for (const file of orphanFiles) {
                result.orphansFound.push({
                  bucket: "client-files",
                  path: file.path,
                  size: file.size || 0,
                  reason: `Client ${clientId} does not exist`,
                  category: "client-files",
                });
                result.summary.clientFilesOrphans++;

                if (!dryRun) {
                  const { error: delError } = await supabase.storage
                    .from("client-files")
                    .remove([file.path]);

                  if (delError) {
                    result.errors.push(`Error deleting ${file.path}: ${delError.message}`);
                  } else {
                    result.deleted.push(file.path);
                  }
                }
              }
            }
          }
        }

        // Also check the new path pattern: offices/{office_id}/clients/{client_id}
        for (const folder of files) {
          if (folder.name === "offices" && folder.id) {
            const { data: officeFolders } = await supabase.storage
              .from("client-files")
              .list("offices", { limit: 1000 });

            if (officeFolders) {
              for (const officeFolder of officeFolders) {
                if (!officeFolder.id) continue;

                const { data: clientsFolder } = await supabase.storage
                  .from("client-files")
                  .list(`offices/${officeFolder.name}/clients`, { limit: 1000 });

                if (!clientsFolder) continue;

                for (const clientFolder of clientsFolder) {
                  if (!clientFolder.id) continue;

                  const clientId = clientFolder.name;
                  result.scanned++;

                  if (!clientIds.has(clientId)) {
                    const orphanFiles = await listAllFilesRecursive(
                      supabaseUrl,
                      serviceRoleKey,
                      "client-files",
                      `offices/${officeFolder.name}/clients/${clientId}`
                    );

                    for (const file of orphanFiles) {
                      result.orphansFound.push({
                        bucket: "client-files",
                        path: file.path,
                        size: file.size || 0,
                        reason: `Client ${clientId} does not exist`,
                        category: "client-files",
                      });
                      result.summary.clientFilesOrphans++;

                      if (!dryRun) {
                        const { error: delError } = await supabase.storage
                          .from("client-files")
                          .remove([file.path]);

                        if (delError) {
                          result.errors.push(`Error deleting ${file.path}: ${delError.message}`);
                        } else {
                          result.deleted.push(file.path);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Process documents bucket (NIJA PDFs)
    if (buckets.includes("documents")) {
      console.log("[cleanup-orphan-files] Scanning bucket: documents");
      
      // Get all document references from DB
      // If includeSoftDeleted is true, we treat soft-deleted records as NOT valid references
      const documentsQuery = supabase.from("documents").select("file_path, deleted_at");
      const { data: dbDocuments } = await documentsQuery;
      
      const { data: generatedDocs } = await supabase
        .from("generated_docs")
        .select("storage_path");

      const referencedPaths = new Set<string>();
      const softDeletedPaths = new Set<string>();
      
      (dbDocuments || []).forEach(d => {
        if (d.file_path) {
          if (d.deleted_at) {
            softDeletedPaths.add(d.file_path);
          } else {
            referencedPaths.add(d.file_path);
          }
        }
      });
      (generatedDocs || []).forEach(d => d.storage_path && referencedPaths.add(d.storage_path));

      const { data: storageFiles, error: docListError } = await supabase.storage
        .from("documents")
        .list("", { limit: 1000 });

      if (docListError) {
        result.errors.push(`Error listing documents: ${docListError.message}`);
      } else if (storageFiles) {
        const processFile = async (filePath: string, fileSize: number) => {
          result.scanned++;

          const isReferenced = referencedPaths.has(filePath) || referencedPaths.has(`documents/${filePath}`);
          const isSoftDeleted = softDeletedPaths.has(filePath) || softDeletedPaths.has(`documents/${filePath}`);

          if (isSoftDeleted && includeSoftDeleted) {
            // File belongs to a soft-deleted document and user wants to clean those
            result.orphansFound.push({
              bucket: "documents",
              path: filePath,
              size: fileSize,
              reason: "Referenced by soft-deleted document",
              category: "soft-deleted",
            });
            result.summary.softDeletedOrphans++;

            if (!dryRun) {
              const { error: delError } = await supabase.storage
                .from("documents")
                .remove([filePath]);

              if (delError) {
                result.errors.push(`Error deleting ${filePath}: ${delError.message}`);
              } else {
                result.deleted.push(filePath);
              }
            }
          } else if (!isReferenced && !isSoftDeleted) {
            // Truly orphan - no reference at all
            result.orphansFound.push({
              bucket: "documents",
              path: filePath,
              size: fileSize,
              reason: "No reference in documents or generated_docs tables",
              category: "documents",
            });
            result.summary.documentOrphans++;

            if (!dryRun) {
              const { error: delError } = await supabase.storage
                .from("documents")
                .remove([filePath]);

              if (delError) {
                result.errors.push(`Error deleting ${filePath}: ${delError.message}`);
              } else {
                result.deleted.push(filePath);
              }
            }
          }
        };

        for (const file of storageFiles) {
          if (file.id) continue; // Skip folders
          await processFile(file.name, file.metadata?.size || 0);
        }

        // Also check subfolders
        for (const folder of storageFiles) {
          if (!folder.id) continue; // Only process folders
          
          const { data: subFiles } = await supabase.storage
            .from("documents")
            .list(folder.name, { limit: 1000 });

          if (!subFiles) continue;

          for (const file of subFiles) {
            if (file.id) continue;
            const filePath = `${folder.name}/${file.name}`;
            await processFile(filePath, file.metadata?.size || 0);
          }
        }
      }
    }

    // Process nija_tmp bucket (temporary files)
    if (buckets.includes("nija_tmp")) {
      console.log("[cleanup-orphan-files] Scanning bucket: nija_tmp");
      
      const cutoffDate = new Date(Date.now() - tempFileMaxAgeHours * 60 * 60 * 1000);
      
      const { data: tmpFiles, error: tmpListError } = await supabase.storage
        .from("nija_tmp")
        .list("", { limit: 1000 });

      if (tmpListError) {
        result.errors.push(`Error listing nija_tmp: ${tmpListError.message}`);
      } else if (tmpFiles) {
        for (const file of tmpFiles) {
          if (file.id) continue; // Skip folders
          
          result.scanned++;
          
          const fileCreatedAt = file.created_at ? new Date(file.created_at) : null;
          
          if (!fileCreatedAt || fileCreatedAt < cutoffDate) {
            result.orphansFound.push({
              bucket: "nija_tmp",
              path: file.name,
              size: file.metadata?.size || 0,
              reason: `Temporary file older than ${tempFileMaxAgeHours} hours`,
              category: "temp-files",
            });
            result.summary.tempFilesOrphans++;

            if (!dryRun) {
              const { error: delError } = await supabase.storage
                .from("nija_tmp")
                .remove([file.name]);

              if (delError) {
                result.errors.push(`Error deleting ${file.name}: ${delError.message}`);
              } else {
                result.deleted.push(file.name);
              }
            }
          }
        }

        // Check subfolders
        for (const folder of tmpFiles) {
          if (!folder.id) continue;
          
          const { data: subFiles } = await supabase.storage
            .from("nija_tmp")
            .list(folder.name, { limit: 1000 });

          if (!subFiles) continue;

          for (const file of subFiles) {
            if (file.id) continue;
            
            result.scanned++;
            const filePath = `${folder.name}/${file.name}`;
            const fileCreatedAt = file.created_at ? new Date(file.created_at) : null;

            if (!fileCreatedAt || fileCreatedAt < cutoffDate) {
              result.orphansFound.push({
                bucket: "nija_tmp",
                path: filePath,
                size: file.metadata?.size || 0,
                reason: `Temporary file older than ${tempFileMaxAgeHours} hours`,
                category: "temp-files",
              });
              result.summary.tempFilesOrphans++;

              if (!dryRun) {
                const { error: delError } = await supabase.storage
                  .from("nija_tmp")
                  .remove([filePath]);

                if (delError) {
                  result.errors.push(`Error deleting ${filePath}: ${delError.message}`);
                } else {
                  result.deleted.push(filePath);
                }
              }
            }
          }
        }
      }
    }

    // Calculate total size
    const totalOrphanSize = result.orphansFound.reduce((sum, o) => sum + o.size, 0);
    result.summary.totalSizeMB = Number((totalOrphanSize / 1024 / 1024).toFixed(2));

    console.log(`[cleanup-orphan-files] Complete. Found ${result.orphansFound.length} orphans (${result.summary.totalSizeMB} MB)`);
    console.log(`[cleanup-orphan-files] Summary: Client files: ${result.summary.clientFilesOrphans}, Documents: ${result.summary.documentOrphans}, Soft-deleted: ${result.summary.softDeletedOrphans}, Temp: ${result.summary.tempFilesOrphans}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        totalOrphanSizeMB: result.summary.totalSizeMB,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[cleanup-orphan-files] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper to list all files recursively in a folder
async function listAllFilesRecursive(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string,
  path: string
): Promise<{ path: string; size?: number }[]> {
  const result: { path: string; size?: number }[] = [];
  
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  
  const { data: items } = await client.storage.from(bucket).list(path, { limit: 1000 });
  
  if (!items) return result;

  for (const item of items) {
    const fullPath = `${path}/${item.name}`;
    
    if (item.id) {
      // It's a folder, recurse
      const subFiles = await listAllFilesRecursive(supabaseUrl, serviceRoleKey, bucket, fullPath);
      result.push(...subFiles);
    } else {
      // It's a file
      result.push({ path: fullPath, size: item.metadata?.size });
    }
  }

  return result;
}
