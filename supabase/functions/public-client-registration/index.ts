import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Zod-like validation helpers
function validateString(val: unknown, name: string, required = true): string {
  if (val === undefined || val === null || val === "") {
    if (required) throw new Error(`${name} is required`);
    return "";
  }
  if (typeof val !== "string") throw new Error(`${name} must be a string`);
  return val.trim();
}

function validateBoolean(val: unknown, name: string): boolean {
  if (typeof val !== "boolean") throw new Error(`${name} must be a boolean`);
  return val;
}

function normalizeDigits(val: string): string {
  return val.replace(/\D/g, "");
}

function buildIlikePatternFromSlug(input: string): string {
  // Permissive matcher for legacy links:
  // - normalizes hyphens/underscores/spaces
  // - uses only the first 3 tokens to avoid suffixes like "associados"
  const tokens = input
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);

  return tokens.length ? `%${tokens.join("%")}%` : `%${input}%`;
}

// Função para normalizar nomes em Title Case
function toTitleCase(name: string | null | undefined): string {
  if (!name) return '';
  const prepositions = ['de', 'da', 'do', 'das', 'dos', 'e', 'di'];
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && prepositions.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  // Remove data URL prefix if present
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // GET: Return office branding by slug
    if (req.method === "GET") {
      const url = new URL(req.url);
      const officeSlugRaw = url.searchParams.get("officeSlug");

      const officeSlug = (officeSlugRaw || "").trim();

      if (!officeSlug) {
        return new Response(
          JSON.stringify({ ok: false, error: "officeSlug required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try exact match first, then ignore trailing spaces via ilike prefix
      let office: any = null;
      let error: any = null;

      {
        const res = await supabaseAdmin
          .from("offices")
          .select("id, name, slug, logo_storage_bucket, logo_storage_path, primary_color, secondary_color")
          .eq("slug", officeSlug)
          .maybeSingle();
        office = res.data;
        error = res.error;
      }

      if (!office && !error) {
        const res2 = await supabaseAdmin
          .from("offices")
          .select("id, name, slug, logo_storage_bucket, logo_storage_path, primary_color, secondary_color")
          .ilike("slug", officeSlug) // case-insensitive exact
          .maybeSingle();
        office = res2.data;
        error = res2.error;
      }

      if (!office && !error) {
        const res3 = await supabaseAdmin
          .from("offices")
          .select("id, name, slug, logo_storage_bucket, logo_storage_path, primary_color, secondary_color")
          .ilike("slug", `${officeSlug}%`) // handles trailing spaces in DB
          .maybeSingle();
        office = res3.data;
        error = res3.error;
      }

      // Fallback: match by office name when slug formats differ (e.g. spaces vs hyphens)
      if (!office && !error) {
        const res4 = await supabaseAdmin
          .from("offices")
          .select("id, name, slug, logo_storage_bucket, logo_storage_path, primary_color, secondary_color")
          .ilike("name", buildIlikePatternFromSlug(officeSlug))
          .maybeSingle();
        office = res4.data;
        error = res4.error;
      }

      if (error) {
        console.error("Error fetching office:", error);
        return new Response(
          JSON.stringify({ ok: false, error: "database_error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!office) {
        return new Response(
          JSON.stringify({ ok: false, error: "office_not_found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build logo URL if path exists - use public URL for office-branding bucket
      let logo_url: string | null = null;
      if (office.logo_storage_bucket && office.logo_storage_path) {
        if (office.logo_storage_bucket === "office-branding") {
          // Public bucket - use public URL with cache-busting
          logo_url = `${supabaseUrl}/storage/v1/object/public/${office.logo_storage_bucket}/${office.logo_storage_path}?t=${Date.now()}`;
        } else {
          // Private bucket - use signed URL
          const { data: signedData } = await supabaseAdmin.storage
            .from(office.logo_storage_bucket)
            .createSignedUrl(office.logo_storage_path, 3600);
          logo_url = signedData?.signedUrl || null;
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          office: {
            id: office.id,
            name: office.name,
            slug: office.slug,
            logo_url,
            primary_color: office.primary_color,
            secondary_color: office.secondary_color,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: Create client
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Received registration request for office:", body.officeSlug);

      // Validate honeypot
      if (body.hp && body.hp !== "") {
        console.log("Bot detected via honeypot");
        return new Response(
          JSON.stringify({ ok: false, error: "bot_detected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate LGPD
      if (!validateBoolean(body.lgpdAccepted, "lgpdAccepted") || !body.lgpdAccepted) {
        return new Response(
          JSON.stringify({ ok: false, error: "lgpd_required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate required fields
      const officeSlug = validateString(body.officeSlug, "officeSlug");
      const entryMode = validateString(body.entryMode, "entryMode");
      const clientType = validateString(body.clientType, "clientType");

      if (!["SCAN", "MANUAL"].includes(entryMode)) {
        throw new Error("entryMode must be SCAN or MANUAL");
      }
      if (!["PF", "PJ"].includes(clientType)) {
        throw new Error("clientType must be PF or PJ");
      }

      // Fetch office (same matching strategy as GET)
      let office: any = null;
      let officeError: any = null;

      {
        const res = await supabaseAdmin
          .from("offices")
          .select("id, created_by")
          .eq("slug", officeSlug)
          .maybeSingle();
        office = res.data;
        officeError = res.error;
      }

      if (!office && !officeError) {
        const res2 = await supabaseAdmin
          .from("offices")
          .select("id, created_by")
          .ilike("slug", officeSlug)
          .maybeSingle();
        office = res2.data;
        officeError = res2.error;
      }

      if (!office && !officeError) {
        const res3 = await supabaseAdmin
          .from("offices")
          .select("id, created_by")
          .ilike("slug", `${officeSlug}%`)
          .maybeSingle();
        office = res3.data;
        officeError = res3.error;
      }

      // Fallback: match by office name when slug formats differ
      if (!office && !officeError) {
        const res4 = await supabaseAdmin
          .from("offices")
          .select("id, created_by")
          .ilike("name", buildIlikePatternFromSlug(officeSlug))
          .maybeSingle();
        office = res4.data;
        officeError = res4.error;
      }

      if (officeError || !office) {
        return new Response(
          JSON.stringify({ ok: false, error: "office_not_found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const officeId = office.id;
      const createdBy = office.created_by;

      // Parse and sanitize personal data
      const personal = body.personal || {};
      const pj = body.pj || {};
      const address = body.address || {};

      const nome = validateString(personal.nome, "nome");
      const cpf = clientType === "PF" ? normalizeDigits(validateString(personal.cpf, "cpf", false)) : null;
      const cnpj = clientType === "PJ" ? normalizeDigits(validateString(pj.cnpj, "cnpj", false)) : null;
      const rg = validateString(personal.rg, "rg", false);
      const rgEmissor = validateString(personal.rg_emissor, "rg_emissor", false);
      const nacionalidade = validateString(personal.nacionalidade, "nacionalidade", false);
      const estadoCivil = validateString(personal.estado_civil, "estado_civil", false);
      const profissao = validateString(personal.profissao, "profissao", false);
      const telefone = normalizeDigits(validateString(personal.telefone || pj.telefone, "telefone", false));
      const email = validateString(personal.email || pj.email, "email", false).toLowerCase();
      const razaoSocial = clientType === "PJ" ? validateString(pj.razao_social, "razao_social", false) : null;
      const nomeFantasia = clientType === "PJ" ? validateString(pj.nome_fantasia, "nome_fantasia", false) : null;

      // Parse representative data for PJ
      const representative = pj.representative || {};
      const repNome = validateString(representative.nome, "representative.nome", false);
      const repCpf = normalizeDigits(validateString(representative.cpf, "representative.cpf", false));
      const repRg = validateString(representative.rg, "representative.rg", false);
      const repRgEmissor = validateString(representative.rg_emissor, "representative.rg_emissor", false);
      const repNacionalidade = validateString(representative.nacionalidade, "representative.nacionalidade", false);
      const repEstadoCivil = validateString(representative.estado_civil, "representative.estado_civil", false);
      const repProfissao = validateString(representative.profissao, "representative.profissao", false);

      // Address
      const cep = normalizeDigits(validateString(address.cep, "cep", false));
      const logradouro = validateString(address.logradouro, "logradouro", false);
      const numero = validateString(address.numero, "numero", false);
      const complemento = validateString(address.complemento, "complemento", false);
      const bairro = validateString(address.bairro, "bairro", false);
      const cidade = validateString(address.cidade, "cidade", false);
      const uf = validateString(address.uf, "uf", false).toUpperCase();

      // Build address_line
      const addressParts = [logradouro, numero, complemento, bairro].filter(Boolean);
      const addressLine = addressParts.join(", ");

      // Create client record with normalized names
      const normalizedNome = toTitleCase(nome);
      const normalizedRazaoSocial = toTitleCase(razaoSocial || "");
      const normalizedNomeFantasia = toTitleCase(nomeFantasia || "");
      const normalizedProfissao = toTitleCase(profissao);
      const normalizedNacionalidade = toTitleCase(nacionalidade);
      const normalizedCidade = toTitleCase(cidade);
      
      // Normalize representative data
      const normalizedRepNome = toTitleCase(repNome);
      const normalizedRepNacionalidade = toTitleCase(repNacionalidade);
      const normalizedRepProfissao = toTitleCase(repProfissao);
      
      const clientData: Record<string, unknown> = {
        office_id: officeId,
        person_type: clientType,
        full_name: clientType === "PJ" ? (normalizedRazaoSocial || normalizedNomeFantasia || normalizedNome) : normalizedNome,
        phone: telefone || null,
        email: email || null,
        cep: cep || null,
        address_line: addressLine || null,
        city: normalizedCidade || null,
        state: uf || null,
        lgpd_consent: true,
        lgpd_consent_at: new Date().toISOString(),
        created_by: createdBy,
        source: "public_capture", // Identifica origem do cadastro público
        ai_extracted: body.aiExtracted === true, // Rastreia se dados vieram de extração por IA
      };

      // Add type-specific fields
      if (clientType === "PF") {
        clientData.cpf = cpf || null;
        clientData.rg = rg || null;
        clientData.rg_issuer = rgEmissor || null;
        clientData.nationality = normalizedNacionalidade || null;
        clientData.marital_status = estadoCivil || null;
        clientData.profession = normalizedProfissao || null;
      } else {
        clientData.cnpj = cnpj || null;
        if (normalizedNomeFantasia) {
          clientData.trade_name = normalizedNomeFantasia;
        }
        // Add representative data for PJ
        if (normalizedRepNome) {
          clientData.representative_name = normalizedRepNome;
          clientData.representative_cpf = repCpf || null;
          clientData.representative_rg = repRg || null;
          clientData.representative_rg_issuer = repRgEmissor || null;
          clientData.representative_nationality = normalizedRepNacionalidade || null;
          clientData.representative_marital_status = repEstadoCivil || null;
          clientData.representative_profession = normalizedRepProfissao || null;
        }
      }

      console.log("Creating client:", { nome: normalizedNome, clientType, officeId, aiExtracted: body.aiExtracted === true, hasRepresentative: !!normalizedRepNome });

      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .insert(clientData)
        .select("id")
        .single();

      if (clientError) {
        console.error("Error creating client:", clientError);
        return new Response(
          JSON.stringify({ ok: false, error: "client_creation_failed", details: clientError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const clientId = client.id;
      const displayId = clientId;
      console.log("Client created:", clientId);

      // --- NEW BOOTSTRAP LAYER (W1-03 & W1-04) ---
      try {
        await bootstrapPublicRegistration(supabaseAdmin, {
          clientId,
          officeId,
          createdBy,
          clientType,
          nome: normalizedNome,
          email,
          phone: telefone,
          source: "public_capture"
        });
      } catch (bootErr) {
        console.error("[bootstrap] Critical failure in downstream automation:", bootErr);
        // We do NOT fail the whole request here to ensure the client record is kept
        // but the failure is visible in the logs.
      }
      // --- END BOOTSTRAP LAYER ---

      // Upload signature if provided
      if (body.signature?.dataUrlPng) {
        try {
          const signatureData = body.signature.dataUrlPng;
          const timestamp = Date.now();
          const signaturePath = `offices/${officeId}/clients/${clientId}/signatures/${timestamp}.png`;
          
          const signatureBytes = base64ToArrayBuffer(signatureData);
          
          const { error: uploadError } = await supabaseAdmin.storage
            .from("client-files")
            .upload(signaturePath, signatureBytes, {
              contentType: "image/png",
              upsert: false,
            });

          if (uploadError) {
            console.error("Error uploading signature:", uploadError);
          } else {
            // Create e_signature record - use representative data for PJ
            const signedHash = await sha256(signatureData);
            const signerDoc = clientType === "PF" ? cpf : (repCpf || cnpj);
            const signerName = clientType === "PF" ? nome : (repNome || nome);

            const { error: sigError } = await supabaseAdmin.from("e_signatures").insert({
              office_id: officeId,
              client_id: clientId,
              signer_type: "cliente",
              signer_name: signerName,
              signer_doc: signerDoc || null,
              signer_email: email || null,
              signer_phone: telefone || null,
              signature_base64: signatureData,
              signed_hash: signedHash,
              signed_at: new Date().toISOString(),
              metadata: { entry_mode: entryMode, source: "public_capture", is_representative: clientType === "PJ" && !!repNome },
            });

            if (sigError) {
              console.error("Error creating e_signature:", sigError);
            } else {
              console.log("Signature saved successfully");
            }
          }
        } catch (sigErr) {
          console.error("Signature processing error:", sigErr);
        }
      }

      // Upload scanned files if provided
      if (body.files && Array.isArray(body.files)) {
        for (const file of body.files) {
          try {
            const { kind, fileName, mimeType, dataUrl } = file;
            if (!dataUrl || !kind || !fileName) continue;

            const timestamp = Date.now();
            
            // Construir nome amigável para o arquivo baseado no tipo e nome do cliente
            const kindLabels: Record<string, string> = {
              IDENTIDADE: "RG",
              RG: "RG",
              CNH: "CNH",
              FOTO: "Foto",
              COMPROVANTE_ENDERECO: "Comprovante de Endereco",
              COMPROVANTE: "Comprovante de Endereco",
              DOCUMENTO: "Documento",
            };
            const normalizedClientName = toTitleCase(nome);
            const kindLabel = kindLabels[kind] || kind;
            const ext = fileName.split('.').pop() || 'png';
            const friendlyFileName = `${kindLabel} - ${normalizedClientName}.${ext}`;
            
            const filePath = `offices/${officeId}/clients/${clientId}/scans/${kind}/${timestamp}-${friendlyFileName}`;
            const fileBytes = base64ToArrayBuffer(dataUrl);

            const { error: fileUploadError } = await supabaseAdmin.storage
              .from("client-files")
              .upload(filePath, fileBytes, {
                contentType: mimeType || "application/octet-stream",
                upsert: false,
              });

            if (fileUploadError) {
              console.error("Error uploading file:", fileUploadError);
              continue;
            }

            // Map kind to enum value - ENUM accepts: IDENTIDADE, COMPROVANTE_ENDERECO, OUTRO
            let dbKind = "OUTRO";
            if (kind === "IDENTIDADE" || kind === "RG" || kind === "CNH" || kind === "FOTO") {
              dbKind = "IDENTIDADE";
            } else if (kind === "COMPROVANTE_ENDERECO" || kind === "COMPROVANTE") {
              dbKind = "COMPROVANTE_ENDERECO";
            }
            // DOCUMENTO and other unmapped kinds stay as "OUTRO"

            const { error: fileRecordError } = await supabaseAdmin.from("client_files").insert({
              office_id: officeId,
              client_id: clientId,
              kind: dbKind,
              storage_bucket: "client-files",
              storage_path: filePath,
              file_name: friendlyFileName,
              mime_type: mimeType || "application/octet-stream",
              file_size: fileBytes.length,
              metadata: { entry_mode: entryMode, original_kind: kind, original_file_name: fileName },
            });

            if (fileRecordError) {
              console.error("Error creating file record:", fileRecordError);
            } else {
              console.log("File saved:", fileName);
            }
          } catch (fileErr) {
            console.error("File processing error:", fileErr);
          }
        }
      }

      // Call create-client-kit to generate initial kit (same as internal registration)
      try {
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        console.log("[public-registration] Generating kit for client:", clientId);

        const { error: kitError } = await supabaseAdmin.functions.invoke("create-client-kit", {
          headers: { Authorization: `Bearer ${serviceRoleKey}` },
          body: {
            client_id: clientId,
            template_codes: ["PROC", "DECL"],
            variables: {},
          },
        });

        if (kitError) {
          console.error("[public-registration] Kit generation failed:", kitError);
          // Não bloqueia o cadastro - kit pode ser gerado depois internamente
        } else {
          console.log("[public-registration] Kit generated successfully");
        }
      } catch (kitErr) {
        console.error("[public-registration] Kit generation error:", kitErr);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          client_id: clientId,
          display_id: displayId,
          office_id: officeId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Request error:", error);
    const errorMessage = error instanceof Error ? error.message : "internal_error";
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * BOOTSTRAP LAYER (W1-03 & W1-04)
 * Closes Wave 1 by automating downstream artifacts.
 * Performs Case, CRM Lead, and CRM Activity creation with idempotency.
 */
async function bootstrapPublicRegistration(supabase: any, data: {
  clientId: string,
  officeId: string,
  createdBy: string,
  clientType: string,
  nome: string,
  email: string,
  phone: string,
  source: string
}) {
  const { clientId, officeId, createdBy, clientType, nome, email, phone, source } = data;
  console.log(`[bootstrap] Starting downstream automation for client: ${clientId}`);

  // 1. CASE BOOTSTRAP (W1-03)
  // Idempotency check for case
  const { data: existingCase } = await supabase
    .from("cases")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!existingCase) {
    console.log("[bootstrap] Creating initial case...");
    const { error: caseErr } = await supabase
      .from("cases")
      .insert({
        office_id: officeId,
        client_id: clientId,
        created_by: createdBy,
        title: `Consulta Inicial - ${nome}`,
        stage: "pre_processual",
        status: "ativo",
        side: "ATAQUE"
      });
    
    if (caseErr) {
      console.error("[bootstrap] Failed to create case:", caseErr.message);
      // We throw to catch in the main handler's try-catch for logging
      throw new Error(`case_bootstrap_failed: ${caseErr.message}`);
    }
  } else {
    console.log("[bootstrap] Case already exists, skipping creation.");
  }

  // 2. CRM LEAD BOOTSTRAP (W1-04)
  // Idempotency check for lead (by clientId)
  const { data: existingLead } = await supabase
    .from("crm_leads")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!existingLead) {
    console.log("[bootstrap] Creating CRM lead...");
    const { data: newLead, error: leadErr } = await supabase
      .from("crm_leads")
      .insert({
        office_id: officeId,
        client_id: clientId,
        full_name: nome,
        email: email || null,
        phone: phone || null,
        source: source,
        pipeline_stage: "novo_contato",
        status: "active"
      })
      .select("id")
      .single();

    if (leadErr) {
      console.error("[bootstrap] Failed to create lead:", leadErr.message);
      throw new Error(`crm_lead_failed: ${leadErr.message}`);
    }

    if (newLead) {
      // 3. CRM ACTIVITY
      console.log("[bootstrap] Creating CRM initial activity...");
      const { error: actErr } = await supabase
        .from("crm_activities")
        .insert({
          office_id: officeId,
          lead_id: newLead.id,
          activity_type: "automation_move",
          description: "Captação Pública: Cadastro realizado pelo cliente externo.",
          current_stage: "novo_contato"
        });
      
      if (actErr) {
        console.error("[bootstrap] Failed to create activity:", actErr.message);
        // We don't throw here as the lead was already created
      }
    }
  } else {
    console.log("[bootstrap] CRM Lead already exists, skipping creation.");
  }

  console.log("[bootstrap] Downstream automation finished successfully.");
}
