import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lexos-worker-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_SECRET = Deno.env.get("LEXOS_WORKER_SECRET");

// Mapeamento code -> kind ENUM
const CODE_TO_FILE_KIND: Record<string, string> = {
  PROC: "KIT_PROCURACAO",
  DECL: "KIT_DECLARACAO",
  CONTRATO: "KIT_CONTRATO",
};

// Print CSS to inject into HTML for proper A4 printing
const PRINT_CSS = `
<style>
  @page {
    size: A4;
    margin: 20mm 20mm 25mm 20mm;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .no-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    h1, h2, h3 {
      page-break-after: avoid;
    }
    .signature-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .lexos-footer {
      position: fixed;
      bottom: 5mm;
      left: 20mm;
      right: 20mm;
      text-align: center;
      font-size: 8pt;
      color: #888;
    }
  }
  .lexos-footer {
    text-align: center;
    font-size: 8pt;
    color: #888;
    padding: 15px 0;
    border-top: 1px solid #e5e5e5;
    margin-top: 30px;
  }
</style>
`;

// Lexos footer - non-editable, always at the bottom
const LEXOS_FOOTER = `
<div class="lexos-footer">
  Gerado por Lexos - Sistema de Gestão para Escritórios de Advocacia
</div>
`;

// Function to inject print CSS and Lexos footer into HTML
function injectPrintCss(html: string): string {
  let result = html;
  
  // Inject Lexos footer before </body>
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${LEXOS_FOOTER}</body>`);
  }
  
  // If has <head>, inject CSS before </head>
  if (result.includes("</head>")) {
    return result.replace("</head>", `${PRINT_CSS}</head>`);
  }
  // If has <html>, inject after <html>
  if (result.includes("<html")) {
    return result.replace(/<html[^>]*>/i, (match) => `${match}<head>${PRINT_CSS}</head>`);
  }
  // Otherwise, wrap entire content
  return `<!DOCTYPE html><html><head>${PRINT_CSS}</head><body>${result}${LEXOS_FOOTER}</body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // SEGURANÇA: Exigir header x-lexos-worker-secret
  const providedSecret = req.headers.get("x-lexos-worker-secret");
  if (!WORKER_SECRET || providedSecret !== WORKER_SECRET) {
    console.error("[kit-worker] Unauthorized: invalid or missing worker secret");
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Contadores
  let processedCount = 0;
  let doneCount = 0;
  let errorCount = 0;
  let lastJobId: string | null = null;

  try {
    // 1. Claim next job (APENAS 1 por execução)
    const { data: job, error: claimErr } = await supabase.rpc("claim_next_kit_job");

    // 2. Erro no claim → falha geral
    if (claimErr) {
      console.error("[kit-worker] claim_next_kit_job error:", claimErr);
      return new Response(
        JSON.stringify({ ok: false, error: claimErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Sem job → encerra sem contar processed/error
    if (!job || !job.id) {
      console.log("[kit-worker] Nenhum job na fila. Encerrando execução.");
      return new Response(
        JSON.stringify({ ok: true, processed: 0, done: 0, error: 0, lastJobId: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Job válido - contabilizar
    processedCount = 1;
    lastJobId = job.id;
    console.log(`[kit-worker] Processing job ${job.id} for client ${job.client_id}`);

    try {
      // Buscar cliente
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .select("*")
        .eq("id", job.client_id)
        .single();

      if (clientErr || !client) {
        throw new Error(`Cliente não encontrado: ${clientErr?.message || "null"}`);
      }

      // Buscar escritório
      const { data: office, error: officeErr } = await supabase
        .from("offices")
        .select("*")
        .eq("id", job.office_id)
        .single();

      if (officeErr || !office) {
        throw new Error(`Escritório não encontrado: ${officeErr?.message || "null"}`);
      }

      // Buscar assinatura mais recente (opcional)
      const { data: signature } = await supabase
        .from("e_signatures")
        .select("signature_base64, signed_at, signer_name")
        .eq("client_id", job.client_id)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Montar templateData
      const templateData = buildTemplateData(client, office, signature);

      // Processar cada code
      const createdDocs: string[] = [];
      const errors: string[] = [];

      for (const code of job.requested_codes || []) {
        try {
          const fileKind = CODE_TO_FILE_KIND[code];
          if (!fileKind) {
            console.warn(`[kit-worker] Unknown code: ${code}, skipping`);
            continue;
          }

          // Buscar template (office -> global fallback)
          let template = null;
          
          const { data: officeTemplates } = await supabase
            .from("document_templates")
            .select("id, name, code")
            .eq("code", code)
            .eq("is_active", true)
            .eq("office_id", job.office_id)
            .limit(1);

          if (officeTemplates?.length) {
            template = officeTemplates[0];
          } else {
            const { data: globalTemplates } = await supabase
              .from("document_templates")
              .select("id, name, code")
              .eq("code", code)
              .eq("is_active", true)
              .is("office_id", null)
              .limit(1);
            
            if (globalTemplates?.length) {
              template = globalTemplates[0];
            }
          }

          if (!template) {
            throw new Error(`Template ${code} não encontrado`);
          }

          // Renderizar HTML
          const { data: rawHtml, error: renderErr } = await supabase.rpc(
            "render_template_preview",
            { p_template_id: template.id, p_data: templateData }
          );

          if (renderErr || !rawHtml) {
            throw new Error(`Render ${code}: ${renderErr?.message || "HTML vazio"}`);
          }

          // Inject print CSS into HTML
          const html = injectPrintCss(rawHtml);

          // Convert HTML to bytes
          const htmlBytes = new TextEncoder().encode(html);

          // Storage path IDEMPOTENTE (sem timestamp) - agora .html
          const fileName = `KIT_${code}.html`;
          const storagePath = `${job.office_id}/${job.client_id}/kit/${job.id}/${fileName}`;

          // Upload com upsert
          const { error: uploadErr } = await supabase.storage
            .from("client-files")
            .upload(storagePath, htmlBytes, {
              contentType: "text/html; charset=utf-8",
              upsert: true,
            });

          if (uploadErr) {
            throw new Error(`Upload ${code}: ${uploadErr.message}`);
          }

          // Inserir/atualizar client_files
          const { data: existingFile } = await supabase
            .from("client_files")
            .select("id")
            .eq("storage_path", storagePath)
            .maybeSingle();

          if (existingFile) {
            // Update
            await supabase
              .from("client_files")
              .update({
                file_size: htmlBytes.length,
                mime_type: "text/html",
                metadata: { 
                  auto_generated: true, 
                  kit_worker: true, 
                  template_code: code, 
                  job_id: job.id,
                  format: "html_first" 
                },
              })
              .eq("id", existingFile.id);
          } else {
            // Insert
            await supabase.from("client_files").insert({
              client_id: job.client_id,
              office_id: job.office_id,
              case_id: null,
              kind: fileKind,
              description: `${template.name} - ${client.full_name}`,
              storage_bucket: "client-files",
              storage_path: storagePath,
              file_name: fileName,
              mime_type: "text/html",
              file_size: htmlBytes.length,
              uploaded_by: null,
              metadata: { 
                auto_generated: true, 
                kit_worker: true, 
                template_code: code, 
                job_id: job.id,
                format: "html_first" 
              },
            });
          }

          createdDocs.push(code);
          console.log(`[kit-worker] Created HTML ${code} for job ${job.id}`);

        } catch (codeErr: unknown) {
          const errMsg = codeErr instanceof Error ? codeErr.message : String(codeErr);
          console.error(`[kit-worker] Error processing ${code}:`, codeErr);
          errors.push(`${code}: ${errMsg.slice(0, 100)}`);
        }
      }

      // Finalizar job
      if (errors.length > 0) {
        await supabase.rpc("mark_kit_job_error", {
          p_job_id: job.id,
          p_error: errors.join("; ").slice(0, 500),
          p_worker: "kit-worker",
        });
        errorCount = 1;
      } else if (createdDocs.length > 0) {
        await supabase.rpc("mark_kit_job_done", {
          p_job_id: job.id,
          p_note: `OK (HTML): ${createdDocs.join(", ")}`,
        });
        doneCount = 1;
      } else {
        await supabase.rpc("mark_kit_job_error", {
          p_job_id: job.id,
          p_error: "Nenhum template encontrado para os códigos solicitados",
          p_worker: "kit-worker",
        });
        errorCount = 1;
      }

    } catch (jobErr: unknown) {
      const errMsg = jobErr instanceof Error ? jobErr.message : String(jobErr);
      console.error(`[kit-worker] Job ${job.id} failed:`, jobErr);
      await supabase.rpc("mark_kit_job_error", {
        p_job_id: job.id,
        p_error: errMsg.slice(0, 500),
        p_worker: "kit-worker",
      });
      errorCount = 1;
    }

    // Retorno final
    console.log("[kit-worker] Execution complete:", { processed: processedCount, done: doneCount, error: errorCount, lastJobId });
    return new Response(
      JSON.stringify({ ok: true, processed: processedCount, done: doneCount, error: errorCount, lastJobId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[kit-worker] Fatal error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ========== HELPERS ==========

function formatCpf(cpf: string | null): string {
  if (!cpf) return "";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCnpj(cnpj: string | null): string {
  if (!cnpj) return "";
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatPhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
}

function formatMaritalStatusLabel(status: string | null): string {
  const map: Record<string, string> = {
    solteiro: "solteiro(a)",
    casado: "casado(a)",
    divorciado: "divorciado(a)",
    viuvo: "viúvo(a)",
    separado: "separado(a)",
    uniao_estavel: "em união estável",
  };
  return status ? map[status.toLowerCase()] || status : "";
}

function formatDateExtensive(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const months = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function buildClientIdentification(client: Record<string, unknown>): string {
  const isPJ = client.person_type === "PJ";
  
  if (isPJ) {
    const parts = [
      client.full_name,
      client.cnpj ? `inscrita no CNPJ sob o nº ${formatCnpj(client.cnpj as string)}` : null,
      client.address_line ? `com sede em ${client.address_line}` : null,
      client.city && client.state ? `${client.city}/${client.state}` : null,
    ];
    
    if (client.representative_name) {
      parts.push(`neste ato representada por ${client.representative_name}`);
      if (client.representative_cpf) {
        parts.push(`CPF nº ${formatCpf(client.representative_cpf as string)}`);
      }
    }
    
    return parts.filter(Boolean).join(", ");
  } else {
    const parts = [
      client.full_name,
      client.nationality || "brasileiro(a)",
      formatMaritalStatusLabel(client.marital_status as string),
      client.profession,
      client.rg ? `RG nº ${client.rg}` : null,
      client.rg_issuer ? `(${client.rg_issuer})` : null,
      client.cpf ? `CPF nº ${formatCpf(client.cpf as string)}` : null,
      client.address_line ? `residente e domiciliado(a) em ${client.address_line}` : null,
      client.city && client.state ? `${client.city}/${client.state}` : null,
    ];
    
    return parts.filter(Boolean).join(", ");
  }
}

function buildTemplateData(
  client: Record<string, unknown>, 
  office: Record<string, unknown>, 
  signature: Record<string, unknown> | null
): Record<string, unknown> {
  const now = new Date();
  
  // Normalizar assinatura
  let signatureBase64 = "";
  if (signature?.signature_base64) {
    const sigStr = signature.signature_base64 as string;
    signatureBase64 = sigStr.startsWith("data:")
      ? sigStr
      : `data:image/png;base64,${sigStr}`;
  }

  return {
    // Cliente
    "client.full_name": client.full_name || "",
    "client.cpf": formatCpf(client.cpf as string),
    "client.cnpj": formatCnpj(client.cnpj as string),
    "client.rg": client.rg || "",
    "client.rg_issuer": client.rg_issuer || "",
    "client.email": client.email || "",
    "client.phone": formatPhone(client.phone as string),
    "client.nationality": client.nationality || "brasileiro(a)",
    "client.marital_status": formatMaritalStatusLabel(client.marital_status as string),
    "client.profession": client.profession || "",
    "client.address_line": client.address_line || "",
    "client.city": client.city || "",
    "client.state": client.state || "",
    "client.zip_code": client.zip_code || "",
    "client.person_type": client.person_type || "PF",
    "client.representative_name": client.representative_name || "",
    "client.representative_cpf": formatCpf(client.representative_cpf as string),
    "client.representative_rg": client.representative_rg || "",
    "client.identification": buildClientIdentification(client),
    
    // Escritório
    "office.name": office.name || "",
    "office.cnpj": formatCnpj(office.cnpj as string),
    "office.oab": office.oab || "",
    "office.email": office.email || "",
    "office.phone": formatPhone(office.phone as string),
    "office.address": office.address || "",
    "office.city": office.city || "",
    "office.state": office.state || "",
    
    // Assinatura
    "signature.image": signatureBase64,
    "signature.date": signature?.signed_at ? formatDateExtensive(signature.signed_at as string) : "",
    "signature.name": (signature?.signer_name as string) || (client.full_name as string) || "",
    
    // Data atual
    "today": formatDateExtensive(now.toISOString()),
    "today.short": now.toLocaleDateString("pt-BR"),
    "current_year": now.getFullYear().toString(),
  };
}
