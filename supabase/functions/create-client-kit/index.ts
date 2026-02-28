/**
 * Edge Function: create-client-kit
 * 
 * Gera o kit inicial de documentos do cliente (PROC, DECL, CONTRATO)
 * preservando o HTML original do template sem CSS destrutivo.
 * 
 * Version: 1.1 - Refatorada para Clareza e Segurança (2025-01-04)
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Constantes em UPPERCASE (Padrão de Ambiente)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mapeamento de código para tipo de arquivo do kit
const CODE_TO_FILE_KIND: Record<string, string> = {
  PROC: "KIT_PROCURACAO",
  DECL: "KIT_DECLARACAO",
  CONTRATO: "KIT_CONTRATO",
};

const CODE_TO_DOC_KIND: Record<string, string> = {
  PROC: "PROCURACAO",
  DECL: "DECLARACAO",
  CONTRATO: "CONTRATO",
};

// ========== HELPERS ==========

const MARITAL_STATUS_LABELS: Record<string, string> = {
  solteiro: "solteiro(a)",
  casado: "casado(a)",
  divorciado: "divorciado(a)",
  viuvo: "viúvo(a)",
  uniao_estavel: "em união estável",
  separado: "separado(a)",
};

function formatMaritalStatusLabel(status: string | null | undefined): string {
  if (!status) return "estado civil não informado";
  return MARITAL_STATUS_LABELS[status.toLowerCase()] || status;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function formatCpf(cpf: string | null): string {
  if (!cpf) return "";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCnpj(cnpj: string | null): string {
  if (!cnpj) return "";
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatDateExtensive(date: Date): string {
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

function formatDateSimple(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function parseCurrencyToNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const numbers = String(value).replace(/\D/g, "");
  if (!numbers) return 0;
  return parseInt(numbers, 10) / 100;
}

function valorPorExtenso(valor: number): string {
  if (valor === 0) return "zero reais";
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  const converterGrupo = (n: number): string => {
    if (n === 0) return "";
    if (n === 100) return "cem";
    let resultado = "";
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (c > 0) resultado += centenas[c];
    if (resto > 0) {
      if (c > 0) resultado += " e ";
      if (resto < 10) resultado += unidades[resto];
      else if (resto < 20) resultado += especiais[resto - 10];
      else { resultado += dezenas[d]; if (u > 0) resultado += " e " + unidades[u]; }
    }
    return resultado;
  };

  const parteInteira = Math.floor(valor);
  const centavos = Math.round((valor - parteInteira) * 100);
  let resultado = "";
  
  if (parteInteira >= 1000000) {
    const milhoes = Math.floor(parteInteira / 1000000);
    resultado += converterGrupo(milhoes) + (milhoes === 1 ? " milhão" : " milhões");
    const resto = parteInteira % 1000000;
    if (resto > 0) resultado += resto < 100 ? " e " : " ";
  }
  const semMilhoes = parteInteira % 1000000;
  if (semMilhoes >= 1000) {
    const milhares = Math.floor(semMilhoes / 1000);
    resultado += milhares === 1 ? "mil" : converterGrupo(milhares) + " mil";
    const resto = semMilhoes % 1000;
    if (resto > 0) resultado += resto < 100 ? " e " : " ";
  }
  const unidadesParte = semMilhoes % 1000;
  if (unidadesParte > 0) resultado += converterGrupo(unidadesParte);
  if (parteInteira === 1) resultado += " real";
  else if (parteInteira > 0) resultado += " reais";
  if (centavos > 0) {
    if (parteInteira > 0) resultado += " e ";
    resultado += converterGrupo(centavos) + (centavos === 1 ? " centavo" : " centavos");
  }
  return resultado.trim();
}

function getMetodoPagamentoLabel(metodo: string | null | undefined): string {
  if (!metodo) return "";
  switch (String(metodo).toLowerCase()) {
    case "pix": return "PIX";
    case "transferencia": return "Transferência Bancária";
    case "boleto": return "Boleto Bancário";
    case "dinheiro": return "Dinheiro";
    default: return metodo;
  }
}

function formatParcelasDatas(datas: unknown, valorParcela?: string, valorParcelaExtenso?: string): string {
  if (!datas || !Array.isArray(datas)) return "";
  const items = datas.map((d: unknown, i: number) => {
    const formatted = formatDateSimple(String(d));
    if (!formatted) return null;
    if (valorParcela && valorParcelaExtenso) return `<li>${i + 1}ª parcela: ${formatted} - ${valorParcela} (${valorParcelaExtenso})</li>`;
    if (valorParcela) return `<li>${i + 1}ª parcela: ${formatted} - ${valorParcela}</li>`;
    return `<li>${i + 1}ª parcela: ${formatted}</li>`;
  }).filter(Boolean).join("\n");
  return `<ul style="list-style: none; padding-left: 2em; margin: 10px 0;">${items}</ul>`;
}

function formatChavePix(chave: string | null | undefined): string {
  if (!chave) return "";
  const digits = chave.replace(/\D/g, "");
  if (digits.length === 11 && /^\d{11}$/.test(digits)) return formatCpf(digits);
  if (digits.length === 14 && /^\d{14}$/.test(digits)) return formatCnpj(digits);
  return chave;
}

function buildClientIdentification(client: Record<string, unknown>): string {
  const safeStr = (v: unknown): string => (v === null || v === undefined) ? "" : String(v);
  const addressParts = [client.address_line, client.city && client.state ? `${client.city} - ${client.state}` : client.city || client.state || null, client.cep ? `CEP ${client.cep}` : null].filter(Boolean);
  const endereco = addressParts.length > 0 ? addressParts.join(", ") : "endereço não informado";
  const isPJ = !!client.cnpj && String(client.cnpj).trim().length > 0;

  if (isPJ) {
    const repNome = safeStr(client.representative_name).trim();
    const repCpf = safeStr(client.representative_cpf).trim();
    if (repNome && repCpf) {
      const repNacionalidade = safeStr(client.representative_nationality) || "brasileiro(a)";
      const repEstadoCivil = formatMaritalStatusLabel(safeStr(client.representative_marital_status));
      const repProfissao = safeStr(client.representative_profession) || "profissão não informada";
      const repRgCompleto = client.representative_rg ? `${client.representative_rg}${client.representative_rg_issuer ? ` ${String(client.representative_rg_issuer).toUpperCase()}` : ""}` : "RG não informado";
      return `${client.full_name}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${formatCnpj(safeStr(client.cnpj))}, com sede à ${endereco}, neste ato representada por seu representante legal ${repNome}, ${repNacionalidade}, ${repEstadoCivil}, ${repProfissao}, portador(a) do RG nº ${repRgCompleto} e CPF nº ${formatCpf(repCpf)}.`;
    }
    return `${client.full_name}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${formatCnpj(safeStr(client.cnpj))}, com sede à ${endereco}.`;
  }

  const nacionalidade = safeStr(client.nationality) || "brasileiro(a)";
  const estadoCivil = formatMaritalStatusLabel(safeStr(client.marital_status));
  const profissao = safeStr(client.profession) || "profissão não informada";
  const rgCompleto = client.rg ? `${client.rg}${client.rg_issuer ? ` ${String(client.rg_issuer).toUpperCase()}` : ""}` : "RG não informado";
  const cpf = formatCpf(safeStr(client.cpf)) || "CPF não informado";
  const contatos = [client.phone ? `Tel.: ${formatPhone(safeStr(client.phone))}` : null, client.email ? `E-mail: ${client.email}` : null].filter(Boolean).join(", ");
  return `${client.full_name}, ${nacionalidade}, ${estadoCivil}, ${profissao}, portador(a) do RG nº ${rgCompleto} e CPF nº ${cpf}, residente e domiciliado(a) à ${endereco}${contatos ? `, ${contatos}` : ""}.`;
}

// ========== MAIN HANDLER ==========

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validação de Header com mensagem descritiva
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[create-client-kit] Falha: Cabeçalho Authorization ausente.");
    return new Response(JSON.stringify({ ok: false, reason: "Login necessário (Token ausente)" }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  // Cliente Autenticado (RLS Ativo)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Cliente Admin (Bypass RLS - Uso interno)
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Validação de Usuário aprimorada
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("[create-client-kit] Token inválido ou expirado:", userError?.message);
    return new Response(JSON.stringify({ ok: false, reason: "Sessão expirada. Faça login novamente." }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
  const actorUserId = user.id;

  try {
    const { client_id, template_codes = ["PROC", "DECL", "CONTRATO"], variables: rawVariables = {} } = await req.json();

    if (!client_id) {
      return new Response(JSON.stringify({ ok: false, reason: "client_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log de auditoria interna
    console.log(`[create-client-kit] Iniciado por ${user.email} para cliente ${client_id}`);

    // Normaliza variables
    const variables: Record<string, unknown> = rawVariables.kit ? { ...rawVariables.kit, ...rawVariables } : { ...rawVariables };
    delete variables.kit;

    // Auto-generate extensos
    if (variables.valor_fixo_honorarios && !variables.valor_fixo_honorarios_extenso) {
      variables.valor_fixo_honorarios_extenso = valorPorExtenso(parseCurrencyToNumber(variables.valor_fixo_honorarios as string));
    }
    if (variables.valor_parcela && !variables.valor_parcela_extenso) {
      variables.valor_parcela_extenso = valorPorExtenso(parseCurrencyToNumber(variables.valor_parcela as string));
    }
    if (variables.valor_entrada && !variables.valor_entrada_extenso) {
      variables.valor_entrada_extenso = valorPorExtenso(parseCurrencyToNumber(variables.valor_entrada as string));
    }
    if (variables.datas_parcelas && !variables.parcelas_datas_vencimento) {
      const valorParcelaNum = parseCurrencyToNumber(variables.valor_parcela as string);
      const valorParcelaFormatado = valorParcelaNum > 0 ? `R$ ${valorParcelaNum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined;
      variables.parcelas_datas_vencimento = formatParcelasDatas(variables.datas_parcelas, valorParcelaFormatado, valorParcelaNum > 0 ? valorPorExtenso(valorParcelaNum) : undefined);
    }
    if (variables.metodo_pagamento && !variables.metodo_pagamento_label) {
      variables.metodo_pagamento_label = getMetodoPagamentoLabel(variables.metodo_pagamento as string);
    }

    // 1. Fetch client
    const { data: client, error: clientError } = await supabase.from("clients").select("*").eq("id", client_id).single();
    if (clientError || !client) {
      console.error("[create-client-kit] Client not found:", clientError);
      return new Response(JSON.stringify({ ok: false, reason: "Cliente não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Fetch office
    const { data: office, error: officeError } = await supabase.from("offices").select("*").eq("id", client.office_id).single();
    if (officeError || !office) {
      console.error("[create-client-kit] Office not found:", officeError);
      return new Response(JSON.stringify({ ok: false, reason: "Escritório não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Fetch client signature
    const { data: clientSignature } = await supabase.from("e_signatures").select("signature_base64, signed_at, signer_name").eq("client_id", client_id).order("signed_at", { ascending: false }).limit(1).maybeSingle();

    // 4. Build template data
    const safeStr = (v: unknown): string => (v === null || v === undefined) ? "" : String(v);
    const safeMarital = (v: string | null | undefined): string => v ? MARITAL_STATUS_LABELS[v] || v : "";

    const clientAddressParts = [client.address_line, client.city, client.state].filter(Boolean);
    const clientEnderecoCompleto = clientAddressParts.join(", ") || "Endereço não informado";

    const officeAddressParts = [office.address_street, office.address_number, office.address_neighborhood, office.address_city, office.address_state].filter(Boolean);
    const officeEnderecoCompleto = officeAddressParts.join(", ") || "";

    // Logo URL
    let logoSignedUrl = "";
    if (office.logo_storage_bucket && office.logo_storage_path) {
      const { data: publicData } = supabase.storage.from(office.logo_storage_bucket).getPublicUrl(office.logo_storage_path);
      if (publicData?.publicUrl) logoSignedUrl = publicData.publicUrl;
    }

    // Office signature URL
    let officeSignatureUrl = "";
    if (office.signature_storage_bucket && office.signature_storage_path) {
      const { data: publicData } = supabase.storage.from(office.signature_storage_bucket).getPublicUrl(office.signature_storage_path);
      if (publicData?.publicUrl) officeSignatureUrl = publicData.publicUrl;
    }

    const identificacaoCliente = buildClientIdentification(client);

    // Normalize client signature to Data URI format
    const normalizedSignatureBase64 = clientSignature?.signature_base64
      ? (String(clientSignature.signature_base64).startsWith("data:image")
          ? String(clientSignature.signature_base64)
          : `data:image/png;base64,${String(clientSignature.signature_base64)}`)
      : "";

    const templateData: Record<string, string> = {
      "client.full_name": safeStr(client.full_name),
      "client.nationality": safeStr(client.nationality) || "brasileiro(a)",
      "client.marital_status": safeMarital(client.marital_status),
      "client.profession": safeStr(client.profession),
      "client.rg": safeStr(client.rg),
      "client.rg_issuer": safeStr(client.rg_issuer) || "SSP",
      "client.cpf": formatCpf(client.cpf),
      "client.cnpj": formatCnpj(client.cnpj),
      "client.email": safeStr(client.email),
      "client.phone": formatPhone(client.phone),
      "client.address": clientEnderecoCompleto,
      "client.cep": safeStr(client.cep),
      "client.city": safeStr(client.city),
      "client.state": safeStr(client.state),
      "client.identificacao_cliente": identificacaoCliente,
      "client.signature_base64": normalizedSignatureBase64,
      "client.signature_data_assinatura": formatDateSimple(clientSignature?.signed_at),
      "client.signature_nome_assinante": safeStr(clientSignature?.signer_name) || safeStr(client.full_name),
      "office.name": safeStr(office.name),
      "office.nome_escritorio": safeStr(office.name),
      "office.address": officeEnderecoCompleto,
      "office.endereco_completo": officeEnderecoCompleto,
      "office.city": safeStr(office.address_city || office.city),
      "office.state": safeStr(office.address_state || office.state),
      "office.cnpj": formatCnpj(office.cnpj),
      "office.responsible_lawyer_name": safeStr(office.responsible_lawyer_name),
      "office.responsavel_nome": safeStr(office.responsible_lawyer_name || office.responsavel_nome || office.responsavel_name),
      "office.oab_number": safeStr(office.responsible_lawyer_oab_number || office.oab_number),
      "office.responsavel_oab": safeStr(office.responsible_lawyer_oab_number || office.oab_number),
      "office.oab_uf": safeStr(office.responsible_lawyer_oab_uf || office.oab_uf),
      "office.responsavel_oab_uf": safeStr(office.responsible_lawyer_oab_uf || office.oab_uf),
      "office.phone": safeStr(office.contact_phone),
      "office.email": safeStr(office.contact_email || office.email),
      "office.logo_signed_url": logoSignedUrl,
      "office.signature_signed_url": officeSignatureUrl,
      "data_extenso": formatDateExtensive(new Date()),
      "date.extenso": formatDateExtensive(new Date()),
      "kit.tipo_remuneracao": safeStr(variables.tipo_remuneracao),
      "kit.percentual_honorarios": safeStr(variables.percentual_honorarios),
      "kit.valor_fixo_honorarios": safeStr(variables.valor_fixo_honorarios),
      "kit.valor_fixo_honorarios_extenso": safeStr(variables.valor_fixo_honorarios_extenso),
      "kit.forma_pagamento": safeStr(variables.forma_pagamento),
      "kit.valor_entrada": safeStr(variables.valor_entrada),
      "kit.valor_entrada_extenso": safeStr(variables.valor_entrada_extenso),
      "kit.numero_parcelas": safeStr(variables.numero_parcelas),
      "kit.valor_parcela": safeStr(variables.valor_parcela),
      "kit.valor_parcela_extenso": safeStr(variables.valor_parcela_extenso),
      "kit.parcelas_datas_vencimento": safeStr(variables.parcelas_datas_vencimento),
      "kit.metodo_pagamento": safeStr(variables.metodo_pagamento_label || variables.metodo_pagamento),
      "kit.chave_pix": formatChavePix(safeStr(variables.chave_pix)),
      "kit.pix_chave": formatChavePix(safeStr(variables.chave_pix)),
      // === ALIASES para compatibilidade com templates antigos ===
      "client.nome": safeStr(client.full_name),
      "client.estado_civil": safeMarital(client.marital_status),
      "client.endereco_completo": clientEnderecoCompleto,
      "client.nacionalidade": safeStr(client.nationality) || "brasileiro(a)",
      "client.profissao": safeStr(client.profession),
      "office.telefone": safeStr(office.contact_phone),
      // === ALIASES para compatibilidade com AdminModelos (notação PT-BR) ===
      "client.endereco": clientEnderecoCompleto,
      "office.nome": safeStr(office.name),
      "office.cidade": safeStr(office.address_city || office.city),
      "office.estado": safeStr(office.address_state || office.state),
      "office.endereco": officeEnderecoCompleto,
      "date.curta": new Date().toLocaleDateString("pt-BR"),
      // === DIMENSOES para CSS (header premium) ===
      "office.logo_max_height": "90px",
      "office.logo_max_width": "220px",
    };

    // 5. Process each template
    const createdDocs: { code: string; title: string; file_id: string }[] = [];
    const errors: { code: string; reason: string }[] = [];
    const timestamp = Date.now();

    for (const code of template_codes) {
      console.log(`[create-client-kit] Processing: ${code}`);
      const fileKind = CODE_TO_FILE_KIND[code] || "OUTRO";
      const docKind = CODE_TO_DOC_KIND[code] || "OUTRO";

      // UPSERT: Remove old files
      const { data: oldFiles } = await supabase.from("client_files").select("id, storage_path").eq("client_id", client.id).eq("kind", fileKind);
      if (oldFiles && oldFiles.length > 0) {
        const pathsToDelete = oldFiles.map(f => f.storage_path).filter(Boolean);
        if (pathsToDelete.length > 0) await supabase.storage.from("client-files").remove(pathsToDelete);
        await supabase.from("client_files").delete().eq("client_id", client.id).eq("kind", fileKind);
      }

      // Fetch template: primeiro escritório, depois global (fallback)
      let { data: templates } = await supabase
        .from("document_templates")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .eq("office_id", client.office_id)
        .limit(1);

      // Fallback para template global se não encontrar específico
      if (!templates || templates.length === 0) {
        console.log(`[create-client-kit] Template ${code} não encontrado para office, buscando global...`);
        const { data: globalTemplates } = await supabase
          .from("document_templates")
          .select("*")
          .eq("code", code)
          .eq("is_active", true)
          .is("office_id", null)
          .limit(1);
        templates = globalTemplates;
      }

      if (!templates || templates.length === 0) {
        console.warn(`[create-client-kit] Template ${code} não encontrado (office nem global)`);
        errors.push({ code, reason: `Template ${code} não configurado.` });
        continue;
      }

      const template = templates[0];

      // Render template
      const { data: renderResult, error: renderError } = await supabase.rpc("render_template_preview", {
        p_template_id: template.id,
        p_data: templateData,
      });

      if (renderError || !renderResult || typeof renderResult !== 'string' || renderResult.trim() === '') {
        console.error(`[create-client-kit] Render error for ${code}:`, renderError);
        errors.push({ code, reason: "Erro ao renderizar template" });
        continue;
      }

      const renderedContent = renderResult;
      const docTitle = `${template.name} - ${client.full_name}`;

      // Detect if HTML is complete or fragment
      const isFullHtml = /<!doctype|<html/i.test(renderedContent);
      
      // If it's already a full HTML, use as-is. Otherwise, wrap minimally WITHOUT destructive CSS
      const finalHtml = isFullHtml ? renderedContent : `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
</head>
<body>${renderedContent}</body>
</html>`;

      console.log(`[create-client-kit] Rendered ${code}, isFullHtml: ${isFullHtml}, length: ${finalHtml.length}`);

      // Convert HTML to PDF via lexos-html-to-pdf (internal)
      console.log(`[create-client-kit] Converting ${code} to PDF...`);

      let pdfResult: any = null;
      let rawBody = "";

      try {
        const pdfResponse = await fetch(`${SUPABASE_URL}/functions/v1/lexos-html-to-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // IMPORTANT: Supabase functions frequentemente exigem apikey + Authorization
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "apikey": String(SERVICE_ROLE_KEY),
            "x-internal-call": "true",
          },
          body: JSON.stringify({
            html: finalHtml,
            options: { format: "A4", margin: "20mm", delay: 500 },
          }),
        });

        rawBody = await pdfResponse.text();

        if (!pdfResponse.ok) {
          console.error(`[create-client-kit] PDF API HTTP ${pdfResponse.status} for ${code}. Body:`, rawBody);
          errors.push({ code, reason: `PDF API HTTP ${pdfResponse.status}: ${rawBody?.slice(0, 400) || "sem body"}` });
          continue;
        }

        try {
          pdfResult = rawBody ? JSON.parse(rawBody) : null;
        } catch (e) {
          console.error(`[create-client-kit] PDF API returned non-JSON for ${code}. Body:`, rawBody);
          errors.push({ code, reason: `PDF API retornou texto inválido (não JSON): ${rawBody?.slice(0, 400) || "vazio"}` });
          continue;
        }

        const pdfBase64 = String(pdfResult?.pdf_base64 || "").trim();

        if (!pdfResult?.ok || !pdfBase64) {
          console.error(`[create-client-kit] PDF conversion failed for ${code}:`, pdfResult);
          errors.push({ code, reason: String(pdfResult?.reason || "Falha ao gerar PDF (sem pdf_base64)") });
          continue;
        }

        // Robust base64 decode to Uint8Array
        let binaryString = "";
        try {
          binaryString = atob(pdfBase64);
        } catch (e) {
          console.error(`[create-client-kit] atob failed for ${code}. base64 length=${pdfBase64.length}`);
          errors.push({ code, reason: "Falha ao decodificar base64 do PDF (atob)" });
          continue;
        }

        const pdfBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          pdfBytes[i] = binaryString.charCodeAt(i);
        }

        const fileName = `${code.toLowerCase()}_${timestamp}.pdf`;
        const storagePath = `${client.office_id}/${client.id}/kit/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("client-files")
          .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });

        if (uploadError) {
          console.error(`[create-client-kit] Upload PDF failed for ${code}:`, uploadError);
          errors.push({ code, reason: `Falha upload PDF: ${uploadError.message || "erro storage"}` });
          continue;
        }

        // Insert client_files as PDF
        const { data: clientFile, error: clientFileError } = await supabase
          .from("client_files")
          .insert({
            client_id: client.id,
            office_id: client.office_id,
            case_id: null,
            kind: fileKind,
            description: docTitle,
            storage_bucket: "client-files",
            storage_path: storagePath,
            file_name: fileName,
            mime_type: "application/pdf",
            file_size: pdfBytes.length,
            uploaded_by: actorUserId || client.created_by,
            metadata: {
              auto_generated: true,
              kit_inicial: true,
              template_code: code,
              template_id: template.id,
              generated_at: new Date().toISOString(),
              format: "pdf",
            },
          })
          .select("id")
          .single();

        if (clientFileError) {
          console.error(`[create-client-kit] Insert client_files failed for ${code}:`, clientFileError);
          errors.push({ code, reason: `Falha ao registrar client_files: ${clientFileError.message || "erro insert"}` });
          continue;
        }

        createdDocs.push({ code, title: docTitle, file_id: clientFile.id });
        console.log(`[create-client-kit] Created ${code}: ${clientFile.id}`);

      } catch (e: any) {
        console.error(`[create-client-kit] Unexpected error converting ${code}:`, e);
        errors.push({ code, reason: `Erro inesperado PDF: ${e?.message || String(e)}` });
        continue;
      }
    }

    console.log("[create-client-kit] Complete:", { created: createdDocs.length, errors: errors.length });

    return new Response(JSON.stringify({
      ok: errors.length === 0,
      created: createdDocs,
      errors: errors.length > 0 ? errors : undefined,
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: errors.length === 0 ? 200 : 422,
    });

  } catch (err) {
    console.error("[create-client-kit] Unexpected error:", err);
    return new Response(JSON.stringify({ ok: false, reason: "Erro interno do servidor" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
