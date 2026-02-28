/**
 * Gerador local de Kit de Documentos (PROC, DECL, CONTRATO)
 * Gera PDFs no navegador usando html2pdf.js - sem dependência de PDFShift
 */
import { supabase } from "@/integrations/supabase/client";
import { exportHtmlToPdfBlob } from "./exportHtmlToPdf";

type ClientFileKind = "KIT_PROCURACAO" | "KIT_DECLARACAO" | "KIT_CONTRATO";

const CODE_TO_FILE_KIND: Record<string, ClientFileKind> = {
  PROC: "KIT_PROCURACAO",
  DECL: "KIT_DECLARACAO",
  CONTRATO: "KIT_CONTRATO",
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  solteiro: "solteiro(a)",
  casado: "casado(a)",
  divorciado: "divorciado(a)",
  viuvo: "viúvo(a)",
  uniao_estavel: "em união estável",
  separado: "separado(a)",
};

// ========== HELPERS ==========

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

// ========== MAIN GENERATOR ==========

export interface KitGeneratorResult {
  ok: boolean;
  created: { code: string; file_id: string }[];
  errors: { code: string; reason: string }[];
}

export async function generateClientKitPdf(
  clientId: string,
  templateCodes: string[],
  variables: Record<string, unknown> = {}
): Promise<KitGeneratorResult> {
  const createdDocs: { code: string; file_id: string }[] = [];
  const errors: { code: string; reason: string }[] = [];

  // 1. Buscar dados do cliente com office
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientErr || !client) {
    throw new Error("Cliente não encontrado");
  }

  // 2. Buscar dados do escritório
  const { data: office, error: officeErr } = await supabase
    .from("offices")
    .select("*")
    .eq("id", client.office_id)
    .single();

  if (officeErr || !office) {
    throw new Error("Escritório não encontrado");
  }

  // 3. Buscar assinatura do cliente
  const { data: clientSignature } = await supabase
    .from("e_signatures")
    .select("signature_base64, signed_at, signer_name")
    .eq("client_id", clientId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4. Montar dados do template
  const safeStr = (v: unknown): string => (v === null || v === undefined) ? "" : String(v);
  const safeMarital = (v: string | null | undefined): string => v ? MARITAL_STATUS_LABELS[v] || v : "";

  const clientAddressParts = [client.address_line, client.city, client.state].filter(Boolean);
  const clientEnderecoCompleto = clientAddressParts.join(", ") || "Endereço não informado";

  const officeAddressParts = [(office as any).address_street, (office as any).address_number, (office as any).address_neighborhood, (office as any).address_city, (office as any).address_state].filter(Boolean);
  const officeEnderecoCompleto = officeAddressParts.join(", ") || "";

  // Logo URL
  let logoSignedUrl = "";
  if ((office as any).logo_storage_bucket && (office as any).logo_storage_path) {
    const { data: publicData } = supabase.storage.from((office as any).logo_storage_bucket).getPublicUrl((office as any).logo_storage_path);
    if (publicData?.publicUrl) logoSignedUrl = publicData.publicUrl;
  }

  // Office signature URL
  let officeSignatureUrl = "";
  if ((office as any).signature_storage_bucket && (office as any).signature_storage_path) {
    const { data: publicData } = supabase.storage.from((office as any).signature_storage_bucket).getPublicUrl((office as any).signature_storage_path);
    if (publicData?.publicUrl) officeSignatureUrl = publicData.publicUrl;
  }

  const identificacaoCliente = buildClientIdentification(client as Record<string, unknown>);

  // Normalize client signature to Data URI format
  const normalizedSignatureBase64 = clientSignature?.signature_base64
    ? (String(clientSignature.signature_base64).startsWith("data:image")
        ? String(clientSignature.signature_base64)
        : `data:image/png;base64,${String(clientSignature.signature_base64)}`)
    : "";

  // Auto-generate extensos
  const processedVars = { ...variables };
  if (processedVars.valor_fixo_honorarios && !processedVars.valor_fixo_honorarios_extenso) {
    processedVars.valor_fixo_honorarios_extenso = valorPorExtenso(parseCurrencyToNumber(processedVars.valor_fixo_honorarios as string));
  }
  if (processedVars.valor_parcela && !processedVars.valor_parcela_extenso) {
    processedVars.valor_parcela_extenso = valorPorExtenso(parseCurrencyToNumber(processedVars.valor_parcela as string));
  }
  if (processedVars.valor_entrada && !processedVars.valor_entrada_extenso) {
    processedVars.valor_entrada_extenso = valorPorExtenso(parseCurrencyToNumber(processedVars.valor_entrada as string));
  }
  if (processedVars.datas_parcelas && !processedVars.parcelas_datas_vencimento) {
    const valorParcelaNum = parseCurrencyToNumber(processedVars.valor_parcela as string);
    const valorParcelaFormatado = valorParcelaNum > 0 ? `R$ ${valorParcelaNum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined;
    processedVars.parcelas_datas_vencimento = formatParcelasDatas(processedVars.datas_parcelas, valorParcelaFormatado, valorParcelaNum > 0 ? valorPorExtenso(valorParcelaNum) : undefined);
  }
  if (processedVars.metodo_pagamento && !processedVars.metodo_pagamento_label) {
    processedVars.metodo_pagamento_label = getMetodoPagamentoLabel(processedVars.metodo_pagamento as string);
  }

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
    "office.city": safeStr((office as any).address_city || (office as any).city),
    "office.state": safeStr((office as any).address_state || (office as any).state),
    "office.cnpj": formatCnpj((office as any).cnpj),
    "office.responsible_lawyer_name": safeStr((office as any).responsible_lawyer_name),
    "office.responsavel_nome": safeStr((office as any).responsible_lawyer_name || (office as any).responsavel_nome || (office as any).responsavel_name),
    "office.oab_number": safeStr((office as any).responsible_lawyer_oab_number || (office as any).oab_number),
    "office.responsavel_oab": safeStr((office as any).responsible_lawyer_oab_number || (office as any).oab_number),
    "office.oab_uf": safeStr((office as any).responsible_lawyer_oab_uf || (office as any).oab_uf),
    "office.responsavel_oab_uf": safeStr((office as any).responsible_lawyer_oab_uf || (office as any).oab_uf),
    "office.phone": safeStr((office as any).contact_phone),
    "office.email": safeStr((office as any).contact_email || (office as any).email),
    "office.logo_signed_url": logoSignedUrl,
    "office.signature_signed_url": officeSignatureUrl,
    "data_atual": formatDateExtensive(new Date()),
    "data_atual_extenso": formatDateExtensive(new Date()),
    // Contract variables
    "tipo_remuneracao": safeStr(processedVars.tipo_remuneracao),
    "percentual_honorarios": safeStr(processedVars.percentual_honorarios),
    "valor_fixo_honorarios": safeStr(processedVars.valor_fixo_honorarios),
    "valor_fixo_honorarios_extenso": safeStr(processedVars.valor_fixo_honorarios_extenso),
    "forma_pagamento": safeStr(processedVars.forma_pagamento),
    "valor_entrada": safeStr(processedVars.valor_entrada),
    "valor_entrada_extenso": safeStr(processedVars.valor_entrada_extenso),
    "numero_parcelas": safeStr(processedVars.numero_parcelas),
    "valor_parcela": safeStr(processedVars.valor_parcela),
    "valor_parcela_extenso": safeStr(processedVars.valor_parcela_extenso),
    "parcelas_datas_vencimento": safeStr(processedVars.parcelas_datas_vencimento),
    "metodo_pagamento": safeStr(processedVars.metodo_pagamento),
    "metodo_pagamento_label": safeStr(processedVars.metodo_pagamento_label),
    "chave_pix": formatChavePix(processedVars.chave_pix as string),
  };

  // 5. Processar cada template
  for (const code of templateCodes) {
    try {
      // Buscar template ativo (office ou global)
      let { data: templates } = await supabase
        .from("document_templates")
        .select("id")
        .eq("code", code)
        .eq("is_active", true)
        .eq("office_id", client.office_id)
        .limit(1);

      if (!templates?.length) {
        const { data: globalTemplates } = await supabase
          .from("document_templates")
          .select("id")
          .eq("code", code)
          .eq("is_active", true)
          .is("office_id", null)
          .limit(1);
        templates = globalTemplates;
      }

      if (!templates?.length) {
        errors.push({ code, reason: "Template não encontrado" });
        continue;
      }

      // Renderizar HTML via RPC
      const { data: html, error: renderErr } = await supabase.rpc(
        "render_template_preview",
        { p_template_id: templates[0].id, p_data: templateData }
      );

      if (renderErr || !html) {
        console.error(`[ClientKitPdfGenerator] Render error for ${code}:`, renderErr);
        errors.push({ code, reason: "Erro ao renderizar template" });
        continue;
      }

      // Converter para PDF no browser
      console.log(`[ClientKitPdfGenerator] Generating PDF for ${code}...`);
      const pdfBlob = await exportHtmlToPdfBlob(html, {
        fileName: `${code.toLowerCase()}.pdf`,
      });

      if (!pdfBlob || pdfBlob.size < 500) {
        errors.push({ code, reason: "PDF gerado está vazio" });
        continue;
      }

      // Upload para Storage - path idempotente (sem timestamp) + upsert
      const storagePath = `${client.office_id}/${clientId}/kit/${code.toLowerCase()}.pdf`;
      
      const { error: uploadErr } = await supabase.storage
        .from("client-files")
        .upload(storagePath, pdfBlob, { contentType: "application/pdf", upsert: true });

      if (uploadErr) {
        console.error(`[ClientKitPdfGenerator] Upload error for ${code}:`, uploadErr);
        errors.push({ code, reason: "Erro no upload do PDF" });
        continue;
      }

      // Verificar se já existe registro para este client/kind
      const fileKind = CODE_TO_FILE_KIND[code];
      const { data: existingFile } = await supabase
        .from("client_files")
        .select("id")
        .eq("client_id", clientId)
        .eq("kind", fileKind)
        .eq("mime_type", "application/pdf")
        .maybeSingle();

      let fileRecordId: string;

      if (existingFile?.id) {
        // Atualizar registro existente
        const { error: updateErr } = await supabase
          .from("client_files")
          .update({
            storage_path: storagePath,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingFile.id);

        if (updateErr) {
          console.error(`[ClientKitPdfGenerator] Update error for ${code}:`, updateErr);
          errors.push({ code, reason: "Erro ao atualizar registro" });
          continue;
        }
        fileRecordId = existingFile.id;
      } else {
        // Inserir novo registro em client_files
        const { data: fileRecord, error: insertErr } = await supabase
          .from("client_files")
          .insert({
            office_id: client.office_id,
            client_id: clientId,
            kind: CODE_TO_FILE_KIND[code] as any,
            storage_path: storagePath,
            storage_bucket: "client-files",
            file_name: `${code.toLowerCase()}.pdf`,
            mime_type: "application/pdf",
          } as any)
          .select("id")
          .single();

        if (insertErr || !fileRecord) {
          console.error(`[ClientKitPdfGenerator] Insert error for ${code}:`, insertErr);
          errors.push({ code, reason: "Erro ao salvar registro" });
          continue;
        }
        fileRecordId = fileRecord.id;
      }

      createdDocs.push({ code, file_id: fileRecordId });
      console.log(`[ClientKitPdfGenerator] ${code} created successfully`);

    } catch (err: any) {
      console.error(`[ClientKitPdfGenerator] Error for ${code}:`, err);
      errors.push({ code, reason: err.message || "Erro desconhecido" });
    }
  }

  return {
    ok: errors.length === 0,
    created: createdDocs,
    errors,
  };
}
