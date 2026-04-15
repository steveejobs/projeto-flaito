import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resilientFetch } from "../_shared/external-adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logger = (level: 'info' | 'error' | 'warn', message: string, context: any = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }));
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Template HTML para Termo de Cadastro e Consentimento
function generateSignupTermHtml(client: any, office: any): string {
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const clientDoc = client.cpf || client.cnpj || "Não informado";
  const clientAddress = [client.address_line, client.city, client.state]
    .filter(Boolean)
    .join(", ") || "Não informado";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .title { font-size: 18pt; font-weight: bold; color: #8B6914; text-transform: uppercase; margin-bottom: 10px; }
    .subtitle { font-size: 11pt; color: #666; }
    .content { text-align: justify; margin: 20px 0; }
    .data-section { background: #f9f9f9; padding: 20px; border-left: 4px solid #DAA520; margin: 20px 0; }
    .data-section p { margin: 8px 0; }
    .date-section { text-align: center; margin: 40px 0; }
    .footer { text-align: center; font-size: 10pt; color: #666; margin-top: 50px; border-top: 1px solid #ddd; padding-top: 20px; }
    .signature-area { margin-top: 60px; text-align: center; }
    .signature-line { border-bottom: 1px solid #333; width: 300px; margin: 0 auto 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Termo de Cadastro e Consentimento</div>
    <div class="subtitle">${office.name || "Escritório de Advocacia"}</div>
  </div>
  
  <div class="data-section">
    <p><strong>CLIENTE:</strong> ${client.full_name}</p>
    <p><strong>CPF/CNPJ:</strong> ${clientDoc}</p>
    <p><strong>E-mail:</strong> ${client.email || "Não informado"}</p>
    <p><strong>Telefone:</strong> ${client.phone || "Não informado"}</p>
    <p><strong>Endereço:</strong> ${clientAddress}</p>
  </div>
  
  <div class="content">
    <p>Pelo presente termo, o(a) cliente acima identificado(a) declara que:</p>
    
    <p><strong>1.</strong> Autoriza o cadastro de seus dados pessoais no sistema do escritório para fins de prestação de serviços advocatícios;</p>
    
    <p><strong>2.</strong> Consente com o tratamento de seus dados conforme a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), incluindo coleta, armazenamento, processamento e compartilhamento quando necessário para a prestação dos serviços;</p>
    
    <p><strong>3.</strong> Os dados fornecidos são verdadeiros, atuais e de sua inteira responsabilidade, comprometendo-se a informar quaisquer alterações;</p>
    
    <p><strong>4.</strong> Autoriza o contato por e-mail, telefone, WhatsApp e outros meios de comunicação para assuntos relacionados aos serviços contratados;</p>
    
    <p><strong>5.</strong> Tem ciência de que poderá, a qualquer momento, solicitar informações sobre o tratamento de seus dados, bem como sua correção, exclusão ou portabilidade, mediante solicitação formal ao escritório.</p>
  </div>
  
  <div class="date-section">
    <p>${office.city || office.address_city || "Local"}, ${dateStr}.</p>
  </div>
  
  <div class="signature-area">
    <div class="signature-line"></div>
    <p><strong>${client.full_name}</strong></p>
    <p style="font-size: 10pt; color: #666;">CPF/CNPJ: ${clientDoc}</p>
  </div>
  
  <div class="footer">
    <p><strong>${office.name}</strong></p>
    <p>${office.contact_email || ""} ${office.contact_phone ? "| " + office.contact_phone : ""}</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  const correlationId = crypto.randomUUID();
  
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { office_id, client_id, document_type, document_id, case_id } = body;
    const itemContext = { office_id, client_id, document_type, document_id, correlationId };

    logger('info', 'Zapsign send document started', itemContext);

    // Validar tipo de documento suportado
    const validTypes = ["CADASTRO_CLIENTE", "PROCURACAO", "CONTRATO", "DOCUMENTO_JURIDICO"];
    if (!validTypes.includes(document_type)) {
      logger('error', 'Invalid document type', { ...itemContext, document_type });
      return json(
        { ok: false, error: "Tipo de documento inválido. Suportados: " + validTypes.join(", ") },
        400
      );
    }

    if (!office_id || !client_id) {
      return json({ ok: false, error: "office_id e client_id são obrigatórios" }, 400);
    }
    
    if (document_type !== "CADASTRO_CLIENTE" && !document_id) {
       return json({ ok: false, error: "document_id é obrigatório para documentos jurídicos" }, 400);
    }

    const ZAPSIGN_API_KEY = Deno.env.get("ZAPSIGN_API_KEY");
    if (!ZAPSIGN_API_KEY) {
      logger('error', 'ZapSign API key missing', itemContext);
      return json({ ok: false, error: "ZapSign API não configurada" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar dados do cliente
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      logger('error', 'Client not found', { ...itemContext, clientError });
      return json({ ok: false, error: "Cliente não encontrado" }, 404);
    }

    // Buscar dados do escritório
    const { data: office, error: officeError } = await supabase
      .from("offices")
      .select("*")
      .eq("id", office_id)
      .single();

    if (officeError || !office) {
      logger('error', 'Office not found', { ...itemContext, officeError });
      return json({ ok: false, error: "Escritório não encontrado" }, 404);
    }

    let docHtml = "";
    let documentName = `Termo de Cadastro - ${client.full_name}`;

    if (document_type === "CADASTRO_CLIENTE") {
      docHtml = generateSignupTermHtml(client, office);
    } else {
      const { data: docRecord, error: docError } = await supabase
        .from("documents")
        .select("filename, storage_bucket, storage_path, kind")
        .eq("id", document_id)
        .single();
        
      if (docError || !docRecord || !docRecord.storage_path) {
        return json({ ok: false, error: "Documento não encontrado na base de dados" }, 404);
      }
      
      documentName = docRecord.filename || `${document_type} - ${client.full_name}`;
      
      const { data: fileData, error: fileError } = await supabase.storage
        .from(docRecord.storage_bucket)
        .download(docRecord.storage_path);
        
      if (fileError || !fileData) {
        logger('error', 'S3 download error', { ...itemContext, fileError });
        return json({ ok: false, error: "Falha ao baixar arquivo original" }, 500);
      }
      
      const textContent = await fileData.text();
      if (textContent.trim().startsWith("<") || textContent.includes("<!DOCTYPE") || textContent.includes("<html>")) {
        docHtml = textContent;
      } else {
         const isPdf = typeof fileData.type === 'string' && fileData.type.includes('pdf');
         if(isPdf) {
            const pdfBufferRaw = await fileData.arrayBuffer();
            const pdfBase64Raw = btoa(String.fromCharCode(...new Uint8Array(pdfBufferRaw)));
            docHtml = `__ALREADY_PDF__:${pdfBase64Raw}`;
         } else {
            docHtml = textContent;
         }
      }
    }

    let pdfBase64 = "";
    
    if (docHtml.startsWith("__ALREADY_PDF__:")) {
        pdfBase64 = docHtml.split("__ALREADY_PDF__:")[1];
    } else {
        logger('info', 'Converting HTML to PDF', itemContext);
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
        // ── Internal Call to PDF Generator ──────────────────
        const pdfResponse = await resilientFetch(`${SUPABASE_URL}/functions/v1/lexos-html-to-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "x-internal-call": "true",
          },
          body: JSON.stringify({ html: docHtml }),
          serviceName: "internal",
          timeoutMs: 45000,
          correlationId
        });
    
        if (!pdfResponse.ok) {
          const errorText = await pdfResponse.text();
          logger('error', 'PDF conversion failed', { ...itemContext, status: pdfResponse.status, errorText });
          return json({ ok: false, error: "Falha ao gerar o arquivo PDF." }, 500);
        }
    
        const pdfBuffer = await pdfResponse.arrayBuffer();
        pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
        logger('info', 'PDF generated successfully', { ...itemContext, size: pdfBuffer.byteLength });
    }

    const ZAPSIGN_SANDBOX = (Deno.env.get("ZAPSIGN_SANDBOX") ?? "true").toLowerCase() === "true";
    const isPJ = client.person_type === "PJ";
    const signerName = isPJ && client.representative_name ? client.representative_name : client.full_name;
    const signerDoc = isPJ && client.representative_cpf ? client.representative_cpf : (client.cpf || client.cnpj || null);

    const zapsignPayload = {
      name: documentName,
      base64_pdf: pdfBase64,
      sandbox: ZAPSIGN_SANDBOX,
      signers: [{
        name: signerName,
        email: client.email || "",
        phone_country: "55",
        phone_number: (client.phone || "").replace(/\D/g, ""),
        auth_mode: "assinaturaTela",
        send_automatic_email: false,
        send_automatic_whatsapp: false,
      }],
      external_id: client_id,
    };

    logger('info', 'Creating document in ZapSign', itemContext);
    
    const zapsignResponse = await resilientFetch("https://api.zapsign.com.br/api/v1/docs/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZAPSIGN_API_KEY}`,
      },
      body: JSON.stringify(zapsignPayload),
      serviceName: "zapsign",
      correlationId,
      timeoutMs: 60000,
      isIdempotent: false
    });

    if (!zapsignResponse.ok) {
      const errorText = await zapsignResponse.text();
      logger('error', 'ZapSign creation failed', { ...itemContext, status: zapsignResponse.status, errorText });
      return json(
        { ok: false, error: `ZapSign retornou erro ${zapsignResponse.status}` },
        500
      );
    }

    const docData = await zapsignResponse.json();
    const docToken = docData.token;
    const signerToken = docData.signers?.[0]?.token;
    const signUrl = docData.signers?.[0]?.sign_url;

    logger('info', 'Document created in ZapSign', { ...itemContext, docToken });

    if (document_type === "CADASTRO_CLIENTE") {
        const { error: insertError } = await supabase.from("e_signatures").insert({
          office_id,
          client_id,
          case_id: null,
          generated_document_id: null,
          signer_type: "cliente",
          signer_name: signerName,
          signer_doc: signerDoc,
          signer_email: client.email || null,
          signer_phone: client.phone || null,
          signed_hash: `zapsign-${docToken}`,
          zapsign_doc_token: docToken,
          zapsign_signer_token: signerToken,
          signature_status: "PENDING",
          metadata: {
            document_type: "CADASTRO_CLIENTE",
            zapsign_external_id: client_id,
            zapsign_doc_name: docData.name,
            correlationId
          },
        });
    
        if (insertError) {
          logger('error', 'Failed to insert e_signature', { ...itemContext, insertError });
          return json({ ok: false, error: "Falha ao salvar registro de assinatura" }, 500);
        }
    } else {
        const { error: insertError } = await supabase.from("document_sign_requests").insert({
          office_id,
          document_id: document_id,
          provider: "zapsign",
          provider_payload: docData,
          zapsign_doc_token: docToken,
          status: "PENDING",
          metadata: { correlationId }
        });
        
        if (insertError) {
           logger('error', 'Failed to insert sign request', { ...itemContext, insertError });
           return json({ ok: false, error: "Falha ao vincular com a solicitação de assinatura" }, 500);
        }
        
        await supabase.from("documents").update({ status: "PENDENTE_ASSINATURA" }).eq("id", document_id);
    }

    return json({
      ok: true,
      doc_token: docToken,
      signer_token: signerToken,
      sign_url: signUrl,
      correlationId
    });
  } catch (error) {
    logger('error', 'Critical error in zapsign-send-document', { error: String(error), correlationId });
    return json({ ok: false, error: String(error), correlationId }, 500);
  }
});
