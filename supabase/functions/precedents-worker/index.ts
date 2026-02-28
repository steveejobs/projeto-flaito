import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;

  // Try to acquire advisory lock for concurrency control
  let lockAcquired = false;
  try {
    const { data: lockResult, error: lockError } = await supabase.rpc('worker_lock_try');
    
    if (lockError) {
      console.error("[precedents-worker] Error acquiring lock:", lockError);
      // Continue without lock if RPC fails (backward compatibility)
    } else {
      lockAcquired = lockResult === true;
      
      if (!lockAcquired) {
        console.log("[precedents-worker] Another worker instance is running, returning 409");
        return new Response(
          JSON.stringify({ success: false, error: "Worker já em execução", locked: true }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[precedents-worker] Lock acquired: ${lockAcquired}`);

    // Parse request body
    const { limitJobs = 1 } = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(1, limitJobs), 10); // Clamp between 1 and 10

    console.log(`[precedents-worker] Starting with limitJobs=${limit}`);

    // Fetch PENDING jobs
    const { data: pendingJobs, error: fetchError } = await supabase
      .from("legal_precedent_jobs")
      .select("*")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchError) {
      console.error("[precedents-worker] Error fetching jobs:", fetchError);
      throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log("[precedents-worker] No pending jobs found");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum job pendente", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[precedents-worker] Found ${pendingJobs.length} pending job(s)`);

    let processed = 0;
    let failed = 0;
    const results: { jobId: string; status: string; error?: string }[] = [];

    for (const job of pendingJobs) {
      console.log(`[precedents-worker] Processing job ${job.id} (type: ${job.job_type})`);

      // Mark job as RUNNING
      const { error: updateStartError } = await supabase
        .from("legal_precedent_jobs")
        .update({ status: "RUNNING", started_at: new Date().toISOString() })
        .eq("id", job.id);

      if (updateStartError) {
        console.error(`[precedents-worker] Failed to mark job ${job.id} as RUNNING:`, updateStartError);
        results.push({ jobId: job.id, status: "SKIP", error: "Failed to update status" });
        continue;
      }

      try {
        // Process based on job_type
        await processJob(supabase, job);

        // Mark job as SUCCESS
        await supabase
          .from("legal_precedent_jobs")
          .update({ status: "SUCCESS", finished_at: new Date().toISOString(), last_error: null })
          .eq("id", job.id);

        console.log(`[precedents-worker] Job ${job.id} completed successfully`);
        results.push({ jobId: job.id, status: "SUCCESS" });
        processed++;
      } catch (jobError: unknown) {
        const errorMessage = jobError instanceof Error ? jobError.message : String(jobError);
        console.error(`[precedents-worker] Job ${job.id} failed:`, errorMessage);

        // Mark job as FAILED
        await supabase
          .from("legal_precedent_jobs")
          .update({
            status: "FAILED",
            finished_at: new Date().toISOString(),
            last_error: errorMessage.substring(0, 1000),
          })
          .eq("id", job.id);

        results.push({ jobId: job.id, status: "FAILED", error: errorMessage });
        failed++;
      }
    }

    const message = `Processados: ${processed} sucesso, ${failed} falhas`;
    console.log(`[precedents-worker] Finished: ${message}`);

    return new Response(
      JSON.stringify({ success: true, message, processed, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[precedents-worker] Fatal error:", errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    // Release advisory lock if acquired
    if (lockAcquired) {
      try {
        await supabase.rpc('worker_lock_release');
        console.log("[precedents-worker] Lock released");
      } catch (unlockError) {
        console.error("[precedents-worker] Error releasing lock:", unlockError);
      }
    }
  }
});

interface PrecedentJob {
  id: string;
  source_id: string | null;
  job_type: string;
  payload: Record<string, unknown> | null;
}

/**
 * Process a single job based on its type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processJob(supabase: any, job: PrecedentJob): Promise<void> {
  const payload = (job.payload || {}) as Record<string, unknown>;

  switch (job.job_type) {
    case "CHECK_SOURCE":
      await processCheckSource(supabase, job.source_id, payload);
      break;

    case "SYNC_SOURCE":
      await processSyncSource(supabase, job.source_id, payload);
      break;

    case "VERIFY_PRECEDENT":
      await processVerifyPrecedent(supabase, payload);
      break;

    case "IMPORT_PRECEDENT":
      await processImportPrecedent(supabase, payload);
      break;

    default:
      console.log(`[precedents-worker] Unknown job_type: ${job.job_type}, marking as processed`);
      break;
  }
}

/**
 * CHECK_SOURCE: Verify if a source URL is still valid/accessible
 */
 
async function processCheckSource(
  supabase: any,
  sourceId: string | null,
  _payload: Record<string, unknown>
): Promise<void> {
  if (!sourceId) {
    throw new Error("source_id is required for CHECK_SOURCE job");
  }

  // Fetch the source
  const { data: source, error: sourceError } = await supabase
    .from("legal_precedent_sources")
    .select("*")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const url = source.source_url as string;
  if (!url) {
    throw new Error("Source has no URL to check");
  }

  console.log(`[CHECK_SOURCE] Checking URL: ${url}`);

  // Simple HTTP HEAD request to check if URL is accessible
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    const isValid = response.ok;

    // Update source with check result
    await supabase
      .from("legal_precedent_sources")
      .update({
        last_checked_at: new Date().toISOString(),
        enabled: isValid,
      })
      .eq("id", sourceId);

    console.log(`[CHECK_SOURCE] Source ${sourceId} is ${isValid ? "valid" : "invalid"} (status: ${response.status})`);
  } catch (_fetchError) {
    // URL is not accessible
    await supabase
      .from("legal_precedent_sources")
      .update({
        last_checked_at: new Date().toISOString(),
        enabled: false,
      })
      .eq("id", sourceId);

    console.log(`[CHECK_SOURCE] Source ${sourceId} is not accessible`);
  }
}

/**
 * SYNC_SOURCE: Sync precedents from a source URL (e.g., STJ Súmulas)
 * Fetches HTML, parses súmulas, and upserts into legal_precedents
 */
 
async function processSyncSource(
  supabase: any,
  sourceId: string | null,
  _payload: Record<string, unknown>
): Promise<void> {
  if (!sourceId) {
    throw new Error("source_id is required for SYNC_SOURCE job");
  }

  // Fetch the source
  const { data: source, error: sourceError } = await supabase
    .from("legal_precedent_sources")
    .select("*")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  if (!source.enabled) {
    throw new Error(`Source ${sourceId} is disabled`);
  }

  const url = source.source_url as string;
  if (!url) {
    throw new Error("Source has no URL to sync");
  }

  const court = source.court as string;
  const kind = source.kind as string;

  console.log(`[SYNC_SOURCE] Syncing from ${url} (court: ${court}, kind: ${kind})`);

  // Fetch HTML from source
  let html: string;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LexosBot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    html = await response.text();
    console.log(`[SYNC_SOURCE] Fetched ${html.length} bytes from ${url}`);
  } catch (fetchError) {
    const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new Error(`Failed to fetch source URL: ${msg}`);
  }

  // Parse súmulas from HTML
  const sumulas = parseStjSumulas(html, court, kind);
  
  if (sumulas.length === 0) {
    console.log(`[SYNC_SOURCE] No súmulas found in HTML`);
    throw new Error("Nenhuma súmula encontrada no HTML. Verifique o parser ou a URL.");
  }

  console.log(`[SYNC_SOURCE] Parsed ${sumulas.length} súmulas`);

  // Upsert súmulas into legal_precedents
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const sumula of sumulas) {
    try {
      // Check if exists (by tribunal + tipo + numero)
      const { data: existing } = await supabase
        .from("legal_precedents")
        .select("id")
        .eq("tribunal", court)
        .eq("tipo", kind)
        .eq("numero", sumula.numero)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from("legal_precedents")
          .update({
            titulo: sumula.titulo,
            ementa: sumula.ementa,
            link_oficial: sumula.link_oficial,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error(`[SYNC_SOURCE] Failed to update súmula ${sumula.numero}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      } else {
        // Insert new - need to get a valid office_id from the source or use a system office
        // For global precedents, we use a placeholder approach - get first office or create without
        const { data: firstOffice } = await supabase
          .from("offices")
          .select("id")
          .limit(1)
          .single();

        if (!firstOffice) {
          throw new Error("No office found for inserting precedents");
        }

        const { error: insertError } = await supabase
          .from("legal_precedents")
          .insert({
            office_id: firstOffice.id,
            tribunal: court,
            tipo: kind,
            numero: sumula.numero,
            titulo: sumula.titulo,
            ementa: sumula.ementa,
            link_oficial: sumula.link_oficial,
            palavras_chave: [],
            ativo: true,
            court: court,
            kind: kind,
            source: 'SYNC_SOURCE',
          });

        if (insertError) {
          console.error(`[SYNC_SOURCE] Failed to insert súmula ${sumula.numero}:`, insertError);
          errors++;
        } else {
          inserted++;
        }
      }
    } catch (upsertError) {
      console.error(`[SYNC_SOURCE] Error upserting súmula ${sumula.numero}:`, upsertError);
      errors++;
    }
  }

  // Update source last_synced_at
  await supabase
    .from("legal_precedent_sources")
    .update({ 
      last_checked_at: new Date().toISOString(),
    })
    .eq("id", sourceId);

  console.log(`[SYNC_SOURCE] Completed: ${inserted} inserted, ${updated} updated, ${errors} errors`);

  if (errors > 0 && inserted === 0 && updated === 0) {
    throw new Error(`Sync failed with ${errors} errors and no successful upserts`);
  }
}

interface ParsedSumula {
  numero: string;
  titulo: string;
  ementa: string;
  link_oficial: string | null;
}

/**
 * Parse STJ Súmulas from HTML page
 * The STJ page structure may vary, this is a best-effort parser
 */
function parseStjSumulas(html: string, court: string, kind: string): ParsedSumula[] {
  const sumulas: ParsedSumula[] = [];

  try {
    // Strategy 1: Look for súmula patterns in the HTML
    // Common patterns: "Súmula 1", "Súmula nº 1", "SÚMULA 1"
    
    // Try to find súmula blocks - various patterns
    const patterns = [
      // Pattern: Súmula N - text
      /S[ÚU]MULA\s*(?:N[º°]?\s*)?(\d+)[:\-–.\s]+([^<]+?)(?=S[ÚU]MULA\s*(?:N[º°]?\s*)?\d+|$)/gis,
      // Pattern: in table or list structure
      /<(?:tr|li|div|p)[^>]*>.*?S[ÚU]MULA\s*(?:N[º°]?\s*)?(\d+)[:\-–.\s]*([^<]+)/gis,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const numero = match[1].trim();
        let texto = match[2].trim();
        
        // Clean up HTML entities and tags
        texto = texto
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();

        if (numero && texto && texto.length > 10) {
          // Avoid duplicates
          if (!sumulas.find(s => s.numero === numero)) {
            sumulas.push({
              numero,
              titulo: `Súmula ${numero} - ${court}`,
              ementa: texto.substring(0, 2000), // Limit length
              link_oficial: `https://www.stj.jus.br/sites/portalp/Sumulas`,
            });
          }
        }
      }
    }

    // Strategy 2: If no súmulas found, try alternate parsing
    if (sumulas.length === 0) {
      // Look for numbered items that might be súmulas
      const altPattern = /(\d{1,3})\s*[-–.]\s*([^<\n]{20,500})/g;
      let match;
      while ((match = altPattern.exec(html)) !== null) {
        const numero = match[1].trim();
        const texto = match[2].trim();
        
        // Only consider if it looks like legal text
        if (parseInt(numero) > 0 && parseInt(numero) < 700 && texto.length > 30) {
          if (!sumulas.find(s => s.numero === numero)) {
            sumulas.push({
              numero,
              titulo: `Súmula ${numero} - ${court}`,
              ementa: texto.substring(0, 2000),
              link_oficial: `https://www.stj.jus.br/sites/portalp/Sumulas`,
            });
          }
        }
      }
    }

    console.log(`[parseStjSumulas] Found ${sumulas.length} súmulas using HTML parsing`);
    
  } catch (parseError) {
    console.error("[parseStjSumulas] Error parsing HTML:", parseError);
  }

  return sumulas;
}

/**
 * VERIFY_PRECEDENT: Validate and verify a precedent
 */
 
async function processVerifyPrecedent(
  supabase: any,
  payload: Record<string, unknown>
): Promise<void> {
  const precedentId = payload.precedent_id as string | undefined;
  if (!precedentId) {
    throw new Error("precedent_id is required in payload for VERIFY_PRECEDENT job");
  }

  console.log(`[VERIFY_PRECEDENT] Verifying precedent: ${precedentId}`);

  // Fetch the precedent
  const { data: precedent, error: precedentError } = await supabase
    .from("legal_precedents")
    .select("*")
    .eq("id", precedentId)
    .single();

  if (precedentError || !precedent) {
    throw new Error(`Precedent not found: ${precedentId}`);
  }

  // Basic verification: check if required fields are present
  const issues: string[] = [];
  if (!precedent.tribunal) issues.push("tribunal is missing");
  if (!precedent.tipo) issues.push("tipo is missing");
  if (!precedent.numero) issues.push("numero is missing");
  if (!precedent.ementa) issues.push("ementa is missing");

  if (issues.length === 0) {
    // Mark as verified
    await supabase
      .from("legal_precedents")
      .update({
        status: 'VERIFIED',
        updated_at: new Date().toISOString(),
      })
      .eq("id", precedentId);

    console.log(`[VERIFY_PRECEDENT] Precedent ${precedentId} verified successfully`);
  } else {
    console.log(`[VERIFY_PRECEDENT] Precedent ${precedentId} has issues: ${issues.join(", ")}`);
  }
}

/**
 * IMPORT_PRECEDENT: Import a new precedent from external source
 */
 
async function processImportPrecedent(
  supabase: any,
  payload: Record<string, unknown>
): Promise<void> {
  console.log(`[IMPORT_PRECEDENT] Processing import with payload:`, JSON.stringify(payload));

  // Extract data from payload
  const court = payload.court as string;
  const kind = payload.kind as string;
  const number = payload.number as string;
  const title = payload.title as string | undefined;
  const textFull = payload.text_full as string;
  const sourceUrl = payload.source_url as string | undefined;

  if (!court || !kind || !number || !textFull) {
    throw new Error("Missing required fields: court, kind, number, text_full");
  }

  // Check if precedent already exists
  const { data: existing } = await supabase
    .from("legal_precedents")
    .select("id")
    .eq("tribunal", court)
    .eq("tipo", kind)
    .eq("numero", number)
    .maybeSingle();

  if (existing) {
    console.log(`[IMPORT_PRECEDENT] Precedent already exists: ${existing.id}`);
    return;
  }

  // Get first office for insertion
  const { data: firstOffice } = await supabase
    .from("offices")
    .select("id")
    .limit(1)
    .single();

  if (!firstOffice) {
    throw new Error("No office found for inserting precedent");
  }

  // Insert new precedent
  const { data: newPrecedent, error: insertError } = await supabase
    .from("legal_precedents")
    .insert([{
      office_id: firstOffice.id,
      tribunal: court,
      tipo: kind,
      numero: number,
      titulo: title || `${kind} ${number}`,
      ementa: textFull,
      link_oficial: sourceUrl,
      palavras_chave: [],
      ativo: true,
      court: court,
      kind: kind,
      source: 'IMPORT',
    }])
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert precedent: ${insertError.message}`);
  }

  console.log(`[IMPORT_PRECEDENT] Created new precedent: ${newPrecedent.id}`);
}
