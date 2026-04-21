import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-frontend-client",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Rate limiting in-memory
const ipCache = new Map<string, { count: number; resetAt: number }>();
const IP_LIMIT = 10;
const LIMIT_WINDOW = 15 * 60 * 1000;

// Helpers
function validateString(val: unknown, name: string, required = true): string {
  if (!val || typeof val !== "string") {
    if (required) throw new Error(`${name} is required`);
    return "";
  }
  return val.trim();
}

function normalizeDigits(val: string): string {
  return val.replace(/\D/g, "");
}

function toTitleCase(name: string | null | undefined): string {
  if (!name) return '';
  const prepositions = ['de', 'da', 'do', 'das', 'dos', 'e', 'di'];
  return name.trim().toLowerCase().split(/\s+/).map((word, i) => 
    (i > 0 && prepositions.includes(word)) ? word : word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const data = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (req.method === "GET") {
      const officeSlug = new URL(req.url).searchParams.get("officeSlug")?.trim();
      if (!officeSlug) return new Response(JSON.stringify({ ok: false, error: "officeSlug required" }), { status: 400, headers: corsHeaders });

      const { data: office, error } = await supabaseAdmin.from("offices").select("*").ilike("slug", officeSlug).maybeSingle();
      if (error || !office) return new Response(JSON.stringify({ ok: false, error: "office_not_found" }), { status: 404, headers: corsHeaders });

      return new Response(JSON.stringify({ ok: true, office }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const clientHeader = req.headers.get("x-frontend-client");
      if (clientHeader !== "flaito-app") return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 403, headers: corsHeaders });

      const body = await req.json();
      const officeSlug = validateString(body.officeSlug, "officeSlug");
      const { data: office } = await supabaseAdmin.from("offices").select("id, created_by").ilike("slug", officeSlug).single();
      if (!office) return new Response(JSON.stringify({ ok: false, error: "office_not_found" }), { status: 404, headers: corsHeaders });

      const officeId = office.id;
      const createdBy = office.created_by;
      const personal = body.personal || {};
      const address = body.address || {};
      const clientType = body.clientType || "PF";

      const nome = validateString(personal.nome || body.pj?.razao_social, "nome");
      const normalizedNome = toTitleCase(nome);

      // Create Client
      const { data: client, error: clientError } = await supabaseAdmin.from("clients").insert({
        office_id: officeId,
        person_type: clientType,
        full_name: normalizedNome,
        phone: normalizeDigits(personal.phone || personal.telefone || ""),
        email: (personal.email || "").toLowerCase(),
        cep: normalizeDigits(address.cep || ""),
        address_line: address.logradouro || address.street || "",
        city: toTitleCase(address.city || address.cidade || ""),
        state: (address.state || address.uf || "").toUpperCase(),
        lgpd_consent: true,
        lgpd_consent_at: new Date().toISOString(),
        created_by: createdBy,
        source: "public_capture"
      }).select("id").single();

      if (clientError || !client) throw new Error(`client_creation_failed: ${clientError?.message}`);

      const clientId = client.id;

      // MANDATORY BOOTSTRAP (Case/Lead)
      try {
        await bootstrapPublicRegistration(supabaseAdmin, {
          clientId, officeId, createdBy, clientType, nome: normalizedNome,
          email: personal.email, phone: personal.phone, source: "public_capture"
        });
      } catch (e) {
        await supabaseAdmin.from("clients").delete().eq("id", clientId);
        throw e;
      }

      // ASYNC PROCESSES (Files/Signatures/Kit)
      // We don't await these to keep the response fast and resilient
      (async () => {
        // Signature
        if (body.signature?.dataUrlPng) {
          try {
            const path = `offices/${officeId}/clients/${clientId}/signatures/${Date.now()}.png`;
            const bytes = base64ToArrayBuffer(body.signature.dataUrlPng);
            const { error: upErr } = await supabaseAdmin.storage.from("client-files").upload(path, bytes, { contentType: "image/png" });
            if (!upErr) {
              await supabaseAdmin.from("e_signatures").insert({
                office_id: officeId, client_id: clientId, signer_type: "cliente",
                signer_name: normalizedNome, signature_base64: body.signature.dataUrlPng,
                signature_storage_path: path, signed_hash: await sha256(body.signature.dataUrlPng),
                signed_at: new Date().toISOString(), metadata: { source: "public_capture" }
              });
            }
          } catch (e) { console.error("Signature background error:", e); }
        }

        // Files
        if (body.files && Array.isArray(body.files)) {
          for (const file of body.files) {
            try {
              if (!file.dataUrl) continue;
              const path = `offices/${officeId}/clients/${clientId}/scans/${file.kind}/${Date.now()}-${file.fileName}`;
              const bytes = base64ToArrayBuffer(file.dataUrl);
              const { error: upErr } = await supabaseAdmin.storage.from("client-files").upload(path, bytes, { contentType: file.mimeType });
              if (!upErr) {
                await supabaseAdmin.from("client_files").insert({
                  office_id: officeId, client_id: clientId, storage_bucket: "client-files",
                  storage_path: path, file_name: file.fileName, mime_type: file.mimeType, file_size: bytes.length,
                  kind: (["RG", "CNH", "IDENTIDADE"].includes(file.kind)) ? "IDENTIDADE" : "OUTRO"
                });
              }
            } catch (e) { console.error("File background error:", e); }
          }
        }

        // Kit
        await supabaseAdmin.functions.invoke("create-client-kit", {
          headers: { Authorization: `Bearer ${serviceRoleKey}` },
          body: { client_id: clientId, template_codes: ["PROC", "DECL"] }
        }).catch(() => {});
      })();

      return new Response(JSON.stringify({ ok: true, client_id: clientId, display_id: clientId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: any) {
    console.error("Critical registration error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
});

async function bootstrapPublicRegistration(supabase: any, data: any) {
  const { clientId, officeId, createdBy, nome, email, phone, source } = data;
  
  // 1. Create Case
  const { error: caseErr } = await supabase.from("cases").insert({
    office_id: officeId, client_id: clientId, created_by: createdBy,
    title: `Consulta Inicial - ${nome}`, stage: "pre_processual", status: "ativo", side: "ATAQUE"
  });
  if (caseErr) throw new Error(`case_failed: ${caseErr.message}`);

  // 2. Create CRM Lead
  const { data: lead, error: leadErr } = await supabase.from("crm_leads").insert({
    office_id: officeId, client_id: clientId, full_name: nome, email, phone, source,
    pipeline_stage: "novo_contato", status: "active"
  }).select("id").single();
  if (leadErr) throw new Error(`lead_failed: ${leadErr.message}`);

  // 3. Create Activity
  await supabase.from("crm_activities").insert({
    office_id: officeId, lead_id: lead.id, activity_type: "automation_move",
    description: "Captação Pública: Cadastro realizado com sucesso.", current_stage: "novo_contato"
  });
}
