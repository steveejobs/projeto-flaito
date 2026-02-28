/**
 * Helper para montar identificação/qualificação completa do cliente (PF ou PJ)
 * Para uso em contratos, procurações, declarações, etc.
 */

export type ClientForIdentification = {
  full_name: string;
  person_type?: string | null;
  cpf?: string | null;
  cnpj?: string | null;

  // Pessoa física
  rg?: string | null;
  rg_issuer?: string | null;
  marital_status?: string | null;
  profession?: string | null;
  nationality?: string | null;
  phone?: string | null;
  email?: string | null;

  // Endereço (campos reais da tabela clients)
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;

  // Representante (para PJ)
  representative_name?: string | null;
  representative_cpf?: string | null;
  representative_rg?: string | null;
  representative_rg_issuer?: string | null;
  representative_marital_status?: string | null;
  representative_profession?: string | null;
  representative_nationality?: string | null;
  representative_phone?: string | null;
  representative_email?: string | null;
};

// Mapeamento de estado civil
const MARITAL_STATUS_LABELS: Record<string, string> = {
  solteiro: "solteiro(a)",
  casado: "casado(a)",
  divorciado: "divorciado(a)",
  viuvo: "viúvo(a)",
  uniao_estavel: "em união estável",
  separado: "separado(a)",
};

function formatMaritalStatus(status: string | null | undefined): string {
  if (!status) return "estado civil não informado";
  return MARITAL_STATUS_LABELS[status.toLowerCase()] || status;
}

// Formata telefone no padrão (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    // Celular: (XX) XXXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    // Fixo: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone; // Retorna original se não encaixar no padrão
}

function buildFullAddress(c: ClientForIdentification): string {
  const parts = [
    c.address_line,
    c.city && c.state ? `${c.city} - ${c.state}` : c.city || c.state || null,
    c.cep ? `CEP ${c.cep}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "endereço não informado";
}

export function buildClientIdentification(client: ClientForIdentification): string {
  const endereco = buildFullAddress(client);

  // Regra: se person_type = "PJ" OU se houver CNPJ preenchido, trata como PJ
  const isPJ =
    (client.person_type && client.person_type.toUpperCase() === "PJ") ||
    (!!client.cnpj && String(client.cnpj).trim().length > 0);

  if (isPJ) {
    const repNome = client.representative_name?.trim();
    const repCpf = client.representative_cpf?.trim();

    // PJ com representante completo
    if (repNome && repCpf) {
      const repNacionalidade =
        client.representative_nationality || "brasileiro(a)";
      const repEstadoCivil = formatMaritalStatus(
        client.representative_marital_status
      );
      const repProfissao =
        client.representative_profession || "profissão não informada";
      // RG com órgão emissor
      const repRgCompleto = client.representative_rg
        ? `${client.representative_rg}${client.representative_rg_issuer ? ` ${client.representative_rg_issuer.toUpperCase()}` : ""}`
        : "RG não informado";

      return `${client.full_name}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${client.cnpj || "CNPJ não informado"}, com sede à ${endereco}, neste ato representada por seu representante legal ${repNome}, ${repNacionalidade}, ${repEstadoCivil}, ${repProfissao}, portador(a) do RG nº ${repRgCompleto} e CPF nº ${repCpf}.`;
    }

    // PJ sem representante cadastrado
    return `${client.full_name}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${client.cnpj || "CNPJ não informado"}, com sede à ${endereco}.`;
  }

  // Pessoa física (padrão)
  const nacionalidade = client.nationality || "brasileiro(a)";
  const estadoCivil = formatMaritalStatus(client.marital_status);
  const profissao = client.profession || "profissão não informada";
  // RG com órgão emissor
  const rgCompleto = client.rg
    ? `${client.rg}${client.rg_issuer ? ` ${client.rg_issuer.toUpperCase()}` : ""}`
    : "RG não informado";
  const cpf = client.cpf || "CPF não informado";

  // Monta contatos (telefone e email)
  const contatos = [
    client.phone ? `Tel.: ${formatPhone(client.phone)}` : null,
    client.email ? `E-mail: ${client.email}` : null,
  ].filter(Boolean).join(", ");

  return `${client.full_name}, ${nacionalidade}, ${estadoCivil}, ${profissao}, portador(a) do RG nº ${rgCompleto} e CPF nº ${cpf}, residente e domiciliado(a) à ${endereco}${contatos ? `, ${contatos}` : ""}.`;
}
