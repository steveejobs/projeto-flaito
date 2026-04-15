/**
 * Gerador HTML-First de Kit de Documentos (PROC, DECL, CONTRATO)
 * Gera apenas HTML - sem conversão para PDF
 * O usuário pode imprimir e salvar como PDF via navegador
 */
import { supabase } from "@/integrations/supabase/client";
import {
  buildMultipleLawyersIdentification,
  buildLawyersShortList,
  type OfficeMemberForIdentification,
} from "@/lib/lawyerIdentification";

type FileKind = "KIT_PROCURACAO" | "KIT_DECLARACAO" | "KIT_CONTRATO" | "KIT_RECIBO";

const CODE_TO_FILE_KIND: Record<string, FileKind> = {
  PROC: "KIT_PROCURACAO",
  DECL: "KIT_DECLARACAO",
  CONTRATO: "KIT_CONTRATO",
  RECIBO: "KIT_RECIBO",
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  solteiro: "solteiro(a)",
  casado: "casado(a)",
  divorciado: "divorciado(a)",
  viuvo: "viúvo(a)",
  uniao_estavel: "em união estável",
  separado: "separado(a)",
};

const TIPO_REMUNERACAO_LABELS: Record<string, string> = {
  valor_fixo: "Valor fixo",
  percentual: "Percentual sobre o proveito econômico",
  misto: "Misto (valor fixo + percentual)",
};

const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  a_vista: "À vista",
  parcelado: "Parcelado",
  entrada_parcelas: "Entrada + parcelas",
};

function formatCurrencyRaw(value: unknown): string {
  const num = parseCurrencyToNumber(value as string | number | null | undefined);
  if (num === 0) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  if (!datas || !Array.isArray(datas) || datas.length === 0) return "";
  const items = datas.map((d: unknown, i: number) => {
    const formatted = formatDateSimple(String(d));
    if (!formatted) return null;
    if (valorParcela && valorParcelaExtenso) return `<li>${i + 1}ª parcela: ${formatted} - ${valorParcela} (${valorParcelaExtenso})</li>`;
    if (valorParcela) return `<li>${i + 1}ª parcela: ${formatted} - ${valorParcela}</li>`;
    return `<li>${i + 1}ª parcela: ${formatted}</li>`;
  }).filter(Boolean);
  // Só retorna HTML se tiver pelo menos um item válido
  if (items.length === 0) return "";
  return `<ul style="list-style: none; padding-left: 2em; margin: 10px 0;">${items.join("\n")}</ul>`;
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

/**
 * Gera APENAS a qualificação do cliente (SEM o nome) para uso em templates DECL
 * onde o nome já é exibido separadamente.
 */
function buildClientQualification(client: Record<string, unknown>): string {
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
      return `pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${formatCnpj(safeStr(client.cnpj))}, com sede à ${endereco}, neste ato representada por seu representante legal ${repNome}, ${repNacionalidade}, ${repEstadoCivil}, ${repProfissao}, portador(a) do RG nº ${repRgCompleto} e CPF nº ${formatCpf(repCpf)}.`;
    }
    return `pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${formatCnpj(safeStr(client.cnpj))}, com sede à ${endereco}.`;
  }

  const nacionalidade = safeStr(client.nationality) || "brasileiro(a)";
  const estadoCivil = formatMaritalStatusLabel(safeStr(client.marital_status));
  const profissao = safeStr(client.profession) || "profissão não informada";
  const rgCompleto = client.rg ? `${client.rg}${client.rg_issuer ? ` ${String(client.rg_issuer).toUpperCase()}` : ""}` : "RG não informado";
  const cpf = formatCpf(safeStr(client.cpf)) || "CPF não informado";
  const contatos = [client.phone ? `Tel.: ${formatPhone(safeStr(client.phone))}` : null, client.email ? `E-mail: ${client.email}` : null].filter(Boolean).join(", ");
  return `${nacionalidade}, ${estadoCivil}, ${profissao}, portador(a) do RG nº ${rgCompleto} e CPF nº ${cpf}, residente e domiciliado(a) à ${endereco}${contatos ? `, ${contatos}` : ""}.`;
}

// CSS for print/A4 format with Lexos footer
const PRINT_CSS = `
<style>
  @page {
    size: A4;
    margin: 20mm 20mm 25mm 20mm;
  }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 20mm;
    padding-bottom: 30mm;
    box-sizing: border-box;
  }
  @media print {
    body {
      padding: 0;
      padding-bottom: 15mm;
    }
    .lexos-footer {
      position: fixed;
      bottom: 5mm;
      left: 0;
      right: 0;
    }
  }
  .lexos-footer {
    text-align: center;
    font-size: 8pt;
    color: #888;
    padding: 10px 0;
    border-top: 1px solid #e5e5e5;
    margin-top: 20px;
  }
</style>
`;

const LEXOS_FOOTER = `
<div class="lexos-footer">
  Gerado por Lexos - Sistema de Gestão para Escritórios de Advocacia
</div>
`;

function injectPrintCss(html: string): string {
  // Inject footer before closing body tag
  let result = html;
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${LEXOS_FOOTER}</body>`);
  }
  
  // Inject CSS
  if (result.includes("<head>")) {
    return result.replace("<head>", `<head>${PRINT_CSS}`);
  }
  if (result.includes("<html>")) {
    return result.replace("<html>", `<html><head>${PRINT_CSS}</head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${PRINT_CSS}</head><body>${html}${LEXOS_FOOTER}</body></html>`;
}

/**
 * Injeta window.__KIT_DATA__ no HTML para templates que usam JavaScript DOM manipulation
 * em vez de placeholders Handlebars.
 * Também injeta um script de correção para forçar display:block nas assinaturas.
 */
function injectKitData(html: string, kitData: Record<string, unknown>): string {
  const safeJson = JSON.stringify(kitData).replace(/<\/script>/gi, '<\\/script>');
  const scriptTag = `<script>window.__KIT_DATA__ = ${safeJson};</script>`;
  
  // Script de correção para forçar display:block nas imagens de assinatura
  // Este script roda após o template e usa setProperty com !important para garantir visibilidade
  const signatureFixScript = `<script>
(function() {
  function forceSignatureDisplay() {
    var clientSig = document.getElementById("clientSigImg");
    var officeSig = document.getElementById("officeSigImg");
    if (clientSig && clientSig.src && clientSig.src.length > 10) {
      clientSig.style.setProperty("display", "block", "important");
      clientSig.dataset.forcedDisplay = "1";
    }
    if (officeSig && officeSig.src && officeSig.src.length > 10) {
      officeSig.style.setProperty("display", "block", "important");
      officeSig.dataset.forcedDisplay = "1";
    }
  }
  // Run immediately
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(forceSignatureDisplay, 50);
  } else {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(forceSignatureDisplay, 50);
    });
  }
  // Also run after a delay to catch late-loading scripts
  setTimeout(forceSignatureDisplay, 300);
  setTimeout(forceSignatureDisplay, 800);
})();
</script>`;

  // FALLBACK: Script que aplica assinaturas diretamente caso o template falhe
  // Detecta se o src ficou como URL da página atual e corrige
  const signatureApplyScript = `<script>
(function() {
  function applySignatures() {
    var d = window.__KIT_DATA__ || {};
    var c = d.client || {};
    var o = d.office || {};
    
    var clientSig = document.getElementById("clientSigImg");
    var officeSig = document.getElementById("officeSigImg");
    
    // Apply client signature if not set properly (src is empty, undefined, or current page URL)
    if (clientSig && c.signature_base64) {
      var currentSrc = clientSig.getAttribute("src") || "";
      if (!currentSrc || currentSrc.length < 50 || currentSrc.includes(window.location.pathname)) {
        var sig = String(c.signature_base64);
        clientSig.src = sig.startsWith("data:") ? sig : "data:image/png;base64," + sig;
        clientSig.style.setProperty("display", "block", "important");
        console.log("[SIG FALLBACK] Applied client signature, length:", sig.length);
      }
    }
    
    // Apply office signature if not set properly
    if (officeSig && o.signature_signed_url) {
      var currentSrc = officeSig.getAttribute("src") || "";
      if (!currentSrc || currentSrc.length < 50 || currentSrc.includes(window.location.pathname)) {
        officeSig.src = o.signature_signed_url;
        officeSig.style.setProperty("display", "block", "important");
        console.log("[SIG FALLBACK] Applied office signature:", o.signature_signed_url);
      }
    }
  }
  
  // Run with multiple delays to ensure we catch the right timing
  [100, 300, 600, 1000].forEach(function(delay) {
    setTimeout(applySignatures, delay);
  });
})();
</script>`;
  
  // CRITICAL: Inject __KIT_DATA__ immediately after <head> to ensure it's available first
  // Priority: after <head> > before first <script> > before </body> > append
  let result = html;
  if (result.includes("<head>")) {
    // Insert immediately after <head> so it's the FIRST thing executed
    result = result.replace("<head>", `<head>${scriptTag}`);
  } else if (result.includes("<script>")) {
    result = result.replace("<script>", `${scriptTag}<script>`);
  } else if (result.includes("</body>")) {
    result = result.replace("</body>", `${scriptTag}</body>`);
  } else {
    result = result + scriptTag;
  }
  
  // Inject signature fix script AND fallback apply script before </body>
  const allSignatureScripts = signatureFixScript + signatureApplyScript;
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${allSignatureScripts}</body>`);
  } else {
    result = result + allSignatureScripts;
  }
  
  return result;
}

// ========== MAIN GENERATOR ==========

export interface KitGeneratorResult {
  ok: boolean;
  created: { code: string; file_id: string }[];
  errors: { code: string; reason: string }[];
}

export async function generateClientKitHtml(
  clientId: string,
  templateCodes: string[],
  variables: Record<string, unknown> = {}
): Promise<KitGeneratorResult> {
  const createdDocs: { code: string; file_id: string }[] = [];
  const errors: { code: string; reason: string }[] = [];

  // 1. Fetch client data
  const { data: clientRaw, error: clientErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  const client = clientRaw as any;

  if (clientErr || !client) {
    throw new Error("Cliente não encontrado");
  }

  // 2. Fetch office data
  const { data: officeRaw, error: officeErr } = await supabase
    .from("offices")
    .select("*")
    .eq("id", client.office_id)
    .single();

  const office = officeRaw as any;

  if (officeErr || !office) {
    throw new Error("Escritório não encontrado");
  }

  // 3. Fetch client signature using view for reliability
  const { data: clientSignatureRaw, error: sigError } = await supabase
    .from("vw_client_signatures")
    .select("signature_base64, signed_at, signer_name")
    .eq("client_id", clientId)
    .eq("office_id", client.office_id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const clientSignature = clientSignatureRaw as any;

  if (sigError) {
    console.error("[ClientKitHtmlGenerator] Error fetching client signature:", sigError);
  }
  console.log("[ClientKitHtmlGenerator] Client signature found:", {
    hasSignature: !!clientSignature?.signature_base64,
    signatureLength: clientSignature?.signature_base64?.length || 0,
    signerName: clientSignature?.signer_name
  });

  // 4. Build template data
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

  // Office signature URL - with fallback to signed URL
  let officeSignatureUrl = "";
  const signatureBucket = (office as any).signature_storage_bucket || "office-branding";
  const signaturePath = (office as any).signature_storage_path;
  
  if (signaturePath) {
    // Try public URL first
    const { data: publicData } = supabase.storage.from(signatureBucket).getPublicUrl(signaturePath);
    if (publicData?.publicUrl) {
      officeSignatureUrl = publicData.publicUrl;
    }
    
    // If public URL failed, try signed URL as fallback
    if (!officeSignatureUrl) {
      const { data: signedData } = await supabase.storage.from(signatureBucket).createSignedUrl(signaturePath, 3600);
      if (signedData?.signedUrl) {
        officeSignatureUrl = signedData.signedUrl;
      }
    }
  }
  
  console.log("[ClientKitHtmlGenerator] Office signature:", {
    bucket: signatureBucket,
    path: signaturePath,
    url: officeSignatureUrl ? officeSignatureUrl.substring(0, 80) + "..." : "(empty)"
  });

  // 5. Fetch lawyers based on selection
  let selectedLawyers: OfficeMemberForIdentification[] = [];
  const allLawyers = variables.allLawyers !== false; // default true
  const selectedLawyerIds = Array.isArray(variables.selectedLawyerIds) ? variables.selectedLawyerIds as string[] : [];
  const primaryLawyerId = variables.primaryLawyerId as string | null;

  if (allLawyers) {
    // Fetch all lawyers from the office
    const { data: membersRaw } = await supabase
      .from("office_members")
      .select("id, full_name, cpf, rg, rg_issuer, nationality, marital_status, profession, oab_number, oab_uf, phone, email, address_street, address_neighborhood, address_city, address_state, address_zip_code")
      .eq("office_id", client.office_id)
      .eq("is_active", true);
    
    const members = membersRaw as any[];
    
    if (members) {
      // Filter only lawyers (has OAB or profession contains advogado)
      selectedLawyers = members.filter(
        (m) => m.oab_number || m.profession?.toLowerCase().includes("advogado")
      ) as OfficeMemberForIdentification[];
    }
  } else if (selectedLawyerIds.length > 0) {
    // Fetch specific selected lawyers
    const { data: membersRaw } = await supabase
      .from("office_members")
      .select("id, full_name, cpf, rg, rg_issuer, nationality, marital_status, profession, oab_number, oab_uf, phone, email, address_street, address_neighborhood, address_city, address_state, address_zip_code")
      .in("id", selectedLawyerIds)
      .eq("is_active", true);
    
    const members = membersRaw as any[];
    
    if (members) {
      selectedLawyers = members as OfficeMemberForIdentification[];
    }
  }

  // Order: primary first, then by name
  if (primaryLawyerId && selectedLawyers.length > 1) {
    selectedLawyers.sort((a, b) => {
      if (a.id === primaryLawyerId) return -1;
      if (b.id === primaryLawyerId) return 1;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }

  // Build lawyer identification strings
  const advogadosQualificacaoCompleta = selectedLawyers.length > 0
    ? buildMultipleLawyersIdentification(selectedLawyers)
    : "";
  const advogadosListaResumida = selectedLawyers.length > 0
    ? buildLawyersShortList(selectedLawyers)
    : "";
  const advogadoPrincipal = selectedLawyers.length > 0 ? selectedLawyers[0] : null;

  console.log("[ClientKitHtmlGenerator] Lawyers:", {
    total: selectedLawyers.length,
    allLawyers,
    selectedIds: selectedLawyerIds,
    primaryId: primaryLawyerId,
    qualificacao: advogadosQualificacaoCompleta.substring(0, 100) + "..."
  });

  const identificacaoCliente = buildClientIdentification(client as Record<string, unknown>);
  const qualificacaoCliente = buildClientQualification(client as Record<string, unknown>);

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
  // Só gerar parcelas_datas_vencimento quando forma de pagamento for parcelada
  const formaPgto = String(processedVars.forma_pagamento || "").toLowerCase();
  const isParcelado = formaPgto === "parcelado" || formaPgto === "entrada_parcelas";
  if (isParcelado && Array.isArray(processedVars.datas_parcelas) && processedVars.datas_parcelas.length > 0 && !processedVars.parcelas_datas_vencimento) {
    const valorParcelaNum = parseCurrencyToNumber(processedVars.valor_parcela as string);
    const valorParcelaFormatado = valorParcelaNum > 0 ? `R$ ${valorParcelaNum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined;
    processedVars.parcelas_datas_vencimento = formatParcelasDatas(processedVars.datas_parcelas, valorParcelaFormatado, valorParcelaNum > 0 ? valorPorExtenso(valorParcelaNum) : undefined);
  }
  if (processedVars.metodo_pagamento && !processedVars.metodo_pagamento_label) {
    processedVars.metodo_pagamento_label = getMetodoPagamentoLabel(processedVars.metodo_pagamento as string);
  }

  const templateData: Record<string, string> = {
    // Client data - with aliases for different template styles
    "client.full_name": safeStr(client.full_name),
    "client.nome": safeStr(client.full_name), // alias for DECL template
    "cliente_nome": safeStr(client.full_name), // legacy alias
    "client.nationality": safeStr(client.nationality) || "brasileiro(a)",
    "client.marital_status": safeMarital(client.marital_status),
    "client.profession": safeStr(client.profession),
    "client.rg": safeStr(client.rg),
    "client.rg_issuer": safeStr(client.rg_issuer) || "SSP",
    "client.cpf": formatCpf(client.cpf),
    "cliente_cpf": formatCpf(client.cpf), // legacy alias
    "client.cnpj": formatCnpj(client.cnpj),
    "client.email": safeStr(client.email),
    "client.phone": formatPhone(client.phone),
    "client.address": clientEnderecoCompleto,
    "client.cep": safeStr(client.cep),
    "client.city": safeStr(client.city),
    "client.state": safeStr(client.state),
    "client.identificacao_cliente": identificacaoCliente,
    "cliente_identificacao": identificacaoCliente, // legacy alias
    "client.qualificacao_cliente": qualificacaoCliente, // qualification WITHOUT name for DECL
    "client.signature_base64": normalizedSignatureBase64,
    "client.signature_data_assinatura": formatDateSimple(clientSignature?.signed_at),
    "client.signature_nome_assinante": safeStr(clientSignature?.signer_name) || safeStr(client.full_name),
    
    // Office data - with aliases for different template styles
    "office.name": safeStr(office.name),
    "office.nome_escritorio": safeStr(office.name),
    "office.address": officeEnderecoCompleto,
    "office.endereco_completo": officeEnderecoCompleto,
    "office.city": safeStr((office as any).address_city || (office as any).city),
    "office.cidade": safeStr((office as any).address_city || (office as any).city), // alias for DECL template
    "office.state": safeStr((office as any).address_state || (office as any).state),
    "office.estado": safeStr((office as any).address_state || (office as any).state), // alias for DECL template
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
    
    // Date data - with aliases for different template styles
    "data_atual": formatDateExtensive(new Date()),
    "data_atual_extenso": formatDateExtensive(new Date()),
    "date.extenso": formatDateExtensive(new Date()), // alias for DECL template
    
    // Contract variables - using human-readable labels and raw values (without R$)
    "tipo_remuneracao": TIPO_REMUNERACAO_LABELS[safeStr(processedVars.tipo_remuneracao)] || safeStr(processedVars.tipo_remuneracao),
    "percentual_honorarios": safeStr(processedVars.percentual_honorarios),
    "valor_fixo_honorarios": formatCurrencyRaw(processedVars.valor_fixo_honorarios),
    "valor_fixo_honorarios_extenso": safeStr(processedVars.valor_fixo_honorarios_extenso),
    "forma_pagamento": FORMA_PAGAMENTO_LABELS[safeStr(processedVars.forma_pagamento)] || safeStr(processedVars.forma_pagamento),
    "valor_entrada": formatCurrencyRaw(processedVars.valor_entrada),
    "valor_entrada_extenso": safeStr(processedVars.valor_entrada_extenso),
    "numero_parcelas": safeStr(processedVars.numero_parcelas),
    "valor_parcela": formatCurrencyRaw(processedVars.valor_parcela),
    "valor_parcela_extenso": safeStr(processedVars.valor_parcela_extenso),
    "parcelas_datas_vencimento": safeStr(processedVars.parcelas_datas_vencimento),
    "metodo_pagamento": safeStr(processedVars.metodo_pagamento),
    "metodo_pagamento_label": safeStr(processedVars.metodo_pagamento_label),
    "chave_pix": formatChavePix(processedVars.chave_pix as string),
    
    // Recibo variables
    "valor": safeStr(processedVars.valor),
    "valor_extenso": safeStr(processedVars.valor_extenso),
    "data_pagamento": formatDateSimple(safeStr(processedVars.data_pagamento)),
    "descricao_pagamento": safeStr(processedVars.descricao_pagamento),
    "tipo_pagamento": safeStr(processedVars.tipo_pagamento),
    "numero_parcela": safeStr(processedVars.numero_parcela),
    "total_parcelas": safeStr(processedVars.total_parcelas),
    
    // Advogados - qualificação completa e lista resumida
    "advogados.qualificacao_completa": advogadosQualificacaoCompleta,
    "advogados.lista_resumida": advogadosListaResumida,
    "advogado_principal.nome": safeStr(advogadoPrincipal?.full_name),
    "advogado_principal.oab": advogadoPrincipal?.oab_number && advogadoPrincipal?.oab_uf
      ? `OAB/${advogadoPrincipal.oab_uf.toUpperCase()} ${advogadoPrincipal.oab_number}`
      : safeStr(advogadoPrincipal?.oab_number),
    "advogado_principal.email": safeStr(advogadoPrincipal?.email),
    "advogado_principal.telefone": formatPhone(advogadoPrincipal?.phone),
  };

  // 5. Process each template
  for (const code of templateCodes) {
    try {
      // Find active template (office or global)
      let { data: templatesRaw } = await supabase
        .from("document_templates")
        .select("id")
        .eq("code", code)
        .eq("is_active", true)
        .eq("office_id", client.office_id)
        .limit(1);
      
      let templates = templatesRaw as any[];

      if (!templates?.length) {
        const { data: globalTemplatesRaw } = await supabase
          .from("document_templates")
          .select("id")
          .eq("code", code)
          .eq("is_active", true)
          .is("office_id", null)
          .limit(1);
        templates = globalTemplatesRaw as any[];
      }

      if (!templates?.length) {
        errors.push({ code, reason: "Template não encontrado" });
        continue;
      }

      const template = templates[0];

      // Render HTML via RPC (for Handlebars-style templates)
      const { data: html, error: renderErr } = await supabase.rpc(
        "render_template_preview",
        { p_template_id: (templates[0] as any).id, p_input: templateData }
      );

      if (renderErr || !html) {
        console.error(`[ClientKitHtmlGenerator] Render error for ${code}:`, renderErr);
        errors.push({ code, reason: "Erro ao renderizar template" });
        continue;
      }

      // Build window.__KIT_DATA__ structure for JavaScript-based templates
      // IMPORTANTE: usar "kit" (não "contract") pois é o que o template JS espera via d.kit
      const kitData = {
        office: {
          nome_escritorio: templateData["office.nome_escritorio"],
          name: templateData["office.name"],
          endereco_completo: templateData["office.endereco_completo"],
          cnpj: templateData["office.cnpj"],
          responsavel_nome: templateData["office.responsavel_nome"],
          responsavel_oab: templateData["office.responsavel_oab"],
          responsavel_oab_uf: templateData["office.responsavel_oab_uf"],
          telefone: templateData["office.phone"],
          phone: templateData["office.phone"],
          email: templateData["office.email"],
          logo_signed_url: templateData["office.logo_signed_url"],
          signature_signed_url: templateData["office.signature_signed_url"],
          cidade: templateData["office.city"],
          city: templateData["office.city"],
          estado: templateData["office.state"],
          state: templateData["office.state"],
        },
        client: {
          full_name: templateData["client.full_name"],
          cpf: templateData["client.cpf"],
          cnpj: templateData["client.cnpj"],
          email: templateData["client.email"],
          phone: templateData["client.phone"],
          nationality: templateData["client.nationality"],
          marital_status: templateData["client.marital_status"],
          profession: templateData["client.profession"],
          rg: templateData["client.rg"],
          rg_issuer: templateData["client.rg_issuer"],
          address: templateData["client.address"],
          endereco_completo: templateData["client.address"],
          identificacao_cliente: templateData["client.identificacao_cliente"],
          qualificacao_cliente: templateData["client.qualificacao_cliente"],
          signature_base64: templateData["client.signature_base64"],
        },
        date: {
          extenso: templateData["data_atual_extenso"],
        },
        // CORRIGIDO: usar "kit" em vez de "contract" para compatibilidade com o template JS
        kit: {
          tipo_remuneracao: templateData["tipo_remuneracao"],
          percentual_honorarios: templateData["percentual_honorarios"],
          valor_fixo_honorarios: templateData["valor_fixo_honorarios"],
          valor_fixo_honorarios_extenso: templateData["valor_fixo_honorarios_extenso"],
          forma_pagamento: templateData["forma_pagamento"],
          valor_entrada: templateData["valor_entrada"],
          valor_entrada_extenso: templateData["valor_entrada_extenso"],
          numero_parcelas: templateData["numero_parcelas"],
          valor_parcela: templateData["valor_parcela"],
          valor_parcela_extenso: templateData["valor_parcela_extenso"],
          parcelas_datas_vencimento: templateData["parcelas_datas_vencimento"],
          metodo_pagamento: templateData["metodo_pagamento"],
          metodo_pagamento_label: templateData["metodo_pagamento_label"],
          chave_pix: templateData["chave_pix"],
        },
        // Advogados - para templates JavaScript
        advogados: {
          qualificacao_completa: templateData["advogados.qualificacao_completa"],
          lista_resumida: templateData["advogados.lista_resumida"],
          principal: {
            nome: templateData["advogado_principal.nome"],
            oab: templateData["advogado_principal.oab"],
            email: templateData["advogado_principal.email"],
            telefone: templateData["advogado_principal.telefone"],
          },
        },
      };

      // Inject print CSS and KIT_DATA
      const htmlWithData = injectKitData(html, kitData);
      const htmlWithCss = injectPrintCss(htmlWithData);
      const encoder = new TextEncoder();
      const htmlBytes = encoder.encode(htmlWithCss);

      console.log(`[ClientKitHtmlGenerator] Saving HTML for ${code}...`);

      // Storage path (idempotent - using code only, no timestamp)
      const fileName = `${code.toLowerCase()}.html`;
      const storagePath = `${client.office_id}/${clientId}/kit/${fileName}`;

      // Upload HTML with upsert
      const { error: uploadErr } = await supabase.storage
        .from("client-files")
        .upload(storagePath, htmlBytes, { 
          contentType: "text/html", 
          upsert: true 
        });

      if (uploadErr) {
        const msg = (uploadErr as any)?.message ?? String(uploadErr ?? "");
        const lower = msg.toLowerCase();
        const isMimeError = lower.includes("mime type") || lower.includes("not supported");
        
        const userMessage = isMimeError
          ? "Falha no upload do HTML: tipo de arquivo não aceito pelo Storage (content-type)."
          : `Erro no upload do HTML: ${msg}`;
        
        console.error(`[ClientKitHtmlGenerator] Upload error for ${code}:`, {
          storagePath,
          bucket: "client-files",
          error: uploadErr
        });
        
        errors.push({ code, reason: userMessage });
        continue;
      }

      // client_files table no longer exists in schema; using documents table instead
      const { data: existingFile } = await supabase
        .from("documents")
        .select("id")
        .eq("office_id", client.office_id)
        .eq("client_id", clientId)
        .eq("kind", CODE_TO_FILE_KIND[code])
        .eq("mime_type", "text/html")
        .maybeSingle() as any;

      let fileId: string;

      if (existingFile?.id) {
        // Update existing record
        const { error: updErr } = await supabase
          .from("documents")
          .update({
            storage_path: storagePath,
            file_size: htmlBytes.length,
            metadata: {
              auto_generated: true,
              kit_html_first: true,
              template_code: code,
              format: "html",
              generated_at: new Date().toISOString()
            },
          })
          .eq("id", existingFile.id);

        if (updErr) {
          console.error(`[ClientKitHtmlGenerator] Update error for ${code}:`, updErr);
          errors.push({ code, reason: "Erro ao atualizar registro" });
          continue;
        }
        fileId = existingFile.id;
      } else {
        // Insert new record
        const { data: fileRecord, error: insErr } = await supabase
          .from("documents")
          .insert({
            office_id: client.office_id,
            client_id: clientId,
            kind: CODE_TO_FILE_KIND[code],
            filename: `${template.name} - ${client.full_name}`,
            storage_path: storagePath,
            storage_bucket: "client-files",
            mime_type: "text/html",
            file_size: htmlBytes.length,
            metadata: {
              auto_generated: true,
              kit_html_first: true, 
              template_code: code, 
              format: "html",
              generated_at: new Date().toISOString()
            },
          } as any)
          .select("id")
          .single();

        if (insErr || !fileRecord) {
          console.error(`[ClientKitHtmlGenerator] Insert error for ${code}:`, insErr);
          errors.push({ code, reason: "Erro ao salvar registro" });
          continue;
        }
        fileId = fileRecord.id;
      }

      createdDocs.push({ code, file_id: fileId });
      console.log(`[ClientKitHtmlGenerator] ${code} HTML created successfully`);

    } catch (err: any) {
      console.error(`[ClientKitHtmlGenerator] Error for ${code}:`, err);
      errors.push({ code, reason: err.message || "Erro desconhecido" });
    }
  }

  return {
    ok: errors.length === 0,
    created: createdDocs,
    errors,
  };
}
