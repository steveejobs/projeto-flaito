/**
 * Helper functions for building lawyer/member identification strings
 * for use in legal documents (procurações, contratos, petições, etc.)
 */

export interface OfficeMemberForIdentification {
  id: string;
  full_name: string | null;
  cpf: string | null;
  rg: string | null;
  rg_issuer: string | null;
  nationality: string | null;
  marital_status: string | null;
  profession: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
}

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

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return "";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCep(cep: string | null | undefined): string {
  if (!cep) return "";
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return cep;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function buildFullAddress(member: OfficeMemberForIdentification): string {
  const parts = [
    member.address_street,
    member.address_neighborhood,
    member.address_city && member.address_state 
      ? `${member.address_city}/${member.address_state}` 
      : member.address_city || member.address_state,
    member.address_zip_code ? `CEP ${formatCep(member.address_zip_code)}` : null,
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(", ") : "endereço profissional não informado";
}

/**
 * Builds a complete lawyer identification string for legal documents.
 * 
 * Example output:
 * "FULANO DE TAL, brasileiro, casado, advogado inscrito na OAB/TO sob o nº 12345,
 * CPF nº 123.456.789-00, com escritório profissional à Rua X, nº 123, Centro, Palmas/TO,
 * CEP 77000-000, e-mail fulano@escritorio.com, telefone (63) 99999-9999"
 */
export function buildLawyerIdentification(member: OfficeMemberForIdentification): string {
  const name = member.full_name?.toUpperCase() || "NOME NÃO INFORMADO";
  const nationality = member.nationality || "brasileiro(a)";
  const maritalStatus = formatMaritalStatus(member.marital_status);
  const profession = member.profession || "advogado";
  
  // Build OAB string
  const oabStr = member.oab_number && member.oab_uf
    ? `inscrito(a) na OAB/${member.oab_uf.toUpperCase()} sob o nº ${member.oab_number}`
    : member.oab_number
    ? `inscrito(a) na OAB sob o nº ${member.oab_number}`
    : "";
  
  // Build profession with OAB
  const professionWithOab = oabStr
    ? `${profession.toLowerCase()} ${oabStr}`
    : profession.toLowerCase();
  
  // Build RG string
  const rgStr = member.rg
    ? `portador(a) do RG nº ${member.rg}${member.rg_issuer ? ` ${member.rg_issuer.toUpperCase()}` : ""}`
    : "";
  
  // Build CPF string
  const cpfStr = member.cpf ? `CPF nº ${formatCpf(member.cpf)}` : "";
  
  // Build address
  const addressStr = `com escritório profissional à ${buildFullAddress(member)}`;
  
  // Build contacts
  const contacts = [
    member.email ? `e-mail ${member.email}` : null,
    member.phone ? `telefone ${formatPhone(member.phone)}` : null,
  ].filter(Boolean);
  
  // Combine all parts
  const parts = [
    name,
    nationality,
    maritalStatus,
    professionWithOab,
    rgStr,
    cpfStr,
    addressStr,
    ...contacts,
  ].filter(Boolean);
  
  return parts.join(", ") + ".";
}

/**
 * Creates a normalized key from address fields for comparison.
 */
function getAddressKey(member: OfficeMemberForIdentification): string {
  return [
    member.address_street?.trim().toLowerCase(),
    member.address_neighborhood?.trim().toLowerCase(),
    member.address_city?.trim().toLowerCase(),
    member.address_state?.trim().toLowerCase(),
    member.address_zip_code?.replace(/\D/g, ""),
  ].filter(Boolean).join("|");
}

/**
 * Checks if all members share the same professional address.
 */
function allMembersShareAddress(members: OfficeMemberForIdentification[]): boolean {
  if (members.length <= 1) return false;
  const firstKey = getAddressKey(members[0]);
  if (!firstKey) return false; // No address to compare
  return members.every(m => getAddressKey(m) === firstKey);
}

/**
 * Builds lawyer identification WITHOUT the address portion.
 * Used when multiple lawyers share the same address.
 */
function buildLawyerIdentificationWithoutAddress(member: OfficeMemberForIdentification): string {
  const name = member.full_name?.toUpperCase() || "NOME NÃO INFORMADO";
  const nationality = member.nationality || "brasileiro(a)";
  const maritalStatus = formatMaritalStatus(member.marital_status);
  const profession = member.profession || "advogado";
  
  // Build OAB string
  const oabStr = member.oab_number && member.oab_uf
    ? `inscrito(a) na OAB/${member.oab_uf.toUpperCase()} sob o nº ${member.oab_number}`
    : member.oab_number
    ? `inscrito(a) na OAB sob o nº ${member.oab_number}`
    : "";
  
  const professionWithOab = oabStr
    ? `${profession.toLowerCase()} ${oabStr}`
    : profession.toLowerCase();
  
  // Build RG string
  const rgStr = member.rg
    ? `portador(a) do RG nº ${member.rg}${member.rg_issuer ? ` ${member.rg_issuer.toUpperCase()}` : ""}`
    : "";
  
  // Build CPF string
  const cpfStr = member.cpf ? `CPF nº ${formatCpf(member.cpf)}` : "";
  
  // Build contacts (without address)
  const contacts = [
    member.email ? `e-mail ${member.email}` : null,
    member.phone ? `telefone ${formatPhone(member.phone)}` : null,
  ].filter(Boolean);
  
  const parts = [
    name,
    nationality,
    maritalStatus,
    professionWithOab,
    rgStr,
    cpfStr,
    ...contacts,
  ].filter(Boolean);
  
  return parts.join(", ");
}

/**
 * Builds identification strings for multiple lawyers, joined with "e" (and).
 * If all lawyers share the same address, it mentions the address only once at the end.
 * 
 * Example with shared address:
 * "FULANO, brasileiro, advogado inscrito na OAB/TO sob o nº 12345, CPF nº..., e-mail...;
 * e CICLANA, brasileira, advogada inscrita na OAB/TO sob o nº 54321, CPF nº..., e-mail...,
 * ambos com escritório profissional à Rua X, Centro, Palmas/TO, CEP 77000-000."
 */
export function buildMultipleLawyersIdentification(members: OfficeMemberForIdentification[]): string {
  if (members.length === 0) return "";
  if (members.length === 1) return buildLawyerIdentification(members[0]);
  
  // Check if all members share the same address
  const shareAddress = allMembersShareAddress(members);
  
  if (shareAddress) {
    // Build qualifications WITHOUT address
    const identifications = members.map(m => buildLawyerIdentificationWithoutAddress(m));
    
    // Build shared address suffix
    const sharedAddress = buildFullAddress(members[0]);
    const addressSuffix = members.length === 2
      ? `ambos com escritório profissional à ${sharedAddress}`
      : `todos com escritório profissional à ${sharedAddress}`;
    
    // Join qualifications
    let combined: string;
    if (identifications.length === 2) {
      combined = identifications.join("; e ");
    } else {
      const allButLast = identifications.slice(0, -1).join("; ");
      combined = `${allButLast}; e ${identifications.at(-1)}`;
    }
    
    return `${combined}, ${addressSuffix}.`;
  }
  
  // Different addresses: use original behavior with full qualification for each
  const identifications = members.map(m => buildLawyerIdentification(m));
  
  if (identifications.length === 2) {
    return identifications.join("; e ");
  }
  
  const allButLast = identifications.slice(0, -1).join("; ");
  return `${allButLast}; e ${identifications.at(-1)}`
}

/**
 * Builds a short list of lawyers with name and OAB number.
 * Example: "Dr. Fulano de Tal (OAB/TO 12345), Dra. Ciclana Silva (OAB/TO 54321)"
 */
export function buildLawyersShortList(members: OfficeMemberForIdentification[]): string {
  if (members.length === 0) return "";
  
  const items = members.map(m => {
    const name = m.full_name || "Nome não informado";
    const oab = m.oab_number && m.oab_uf
      ? `OAB/${m.oab_uf.toUpperCase()} ${m.oab_number}`
      : m.oab_number
      ? `OAB ${m.oab_number}`
      : "";
    return oab ? `${name} (${oab})` : name;
  });
  
  return items.join(", ");
}

/**
 * Checks if a member has complete professional data for document generation.
 */
export function isMemberProfileComplete(member: Partial<OfficeMemberForIdentification>): boolean {
  const required = [
    member.full_name,
    member.cpf,
    member.nationality,
    member.marital_status,
  ];
  
  // OAB is required only for lawyers
  const isLawyer = member.profession?.toLowerCase().includes("advogado");
  if (isLawyer) {
    required.push(member.oab_number, member.oab_uf);
  }
  
  return required.every(field => !!field && String(field).trim().length > 0);
}

/**
 * Returns a list of missing fields for profile completion.
 */
export function getMissingProfileFields(member: Partial<OfficeMemberForIdentification>): string[] {
  const missing: string[] = [];
  
  if (!member.full_name?.trim()) missing.push("Nome completo");
  if (!member.cpf?.trim()) missing.push("CPF");
  if (!member.nationality?.trim()) missing.push("Nacionalidade");
  if (!member.marital_status?.trim()) missing.push("Estado civil");
  
  const isLawyer = member.profession?.toLowerCase().includes("advogado") || !member.profession;
  if (isLawyer) {
    if (!member.oab_number?.trim()) missing.push("Número da OAB");
    if (!member.oab_uf?.trim()) missing.push("UF da OAB");
  }
  
  return missing;
}
