import { supabase } from "@/integrations/supabase/client";
import { DocumentContextSnapshot, InstitutionalUnit, ProfessionalSettings } from "@/types/institutional";

/**
 * Resolve o contexto institucional para um documento, seguindo a hierarquia de fallback:
 * Snapshot do Documento -> Seleção Manual -> Unidade -> Profissional -> Office -> Legado
 */
export async function resolveDocumentContext(params: {
  officeId: string;
  userId: string;
  unitId?: string;
  documentId?: string;
  isMedical?: boolean;
}): Promise<DocumentContextSnapshot> {
  const { officeId, userId, unitId, documentId, isMedical = false } = params;

  // 1. Tentar Snapshot do Documento (Nível 1 de Verdade Histórica)
  if (documentId) {
    const table = isMedical ? "patient_documents" : "documents";
    const { data: docData } = await supabase
      .from(table as any)
      .select("institutional_snapshot")
      .eq("id", documentId)
      .single();

    if (docData?.institutional_snapshot) {
      return docData.institutional_snapshot as unknown as DocumentContextSnapshot;
    }
  }

  // 2. Buscar Dados Atuais (Composição em Tempo Real)
  
  // A. Dados do Office
  const { data: officeData } = await supabase
    .from("offices")
    .select("name, legal_name, cnpj, branding, institutional_notes")
    .eq("id", officeId)
    .single();

  // B. Dados da Unidade (ou Unidade Padrão)
  let unit: InstitutionalUnit | undefined;
  if (unitId || isMedical) {
    const query = supabase
      .from("office_units")
      .select("*")
      .eq("office_id", officeId)
      .eq("is_active", true);

    if (unitId) {
      query.eq("id", unitId);
    } else {
      query.eq("is_default", true);
    }

    const { data: unitData } = await query.maybeSingle();
    if (unitData) {
      unit = {
        id: unitData.id,
        name: unitData.name,
        unitType: unitData.unit_type,
        address: unitData.address_line,
        city: unitData.city,
        state: unitData.state,
        zipCode: unitData.zip_code,
        phone: unitData.phone,
        email: unitData.email,
      };
    }
  }

  // C. Dados do Profissional
  const { data: profData } = await supabase
    .from("profile_professional_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("office_id", officeId)
    .maybeSingle();

  const professional: ProfessionalSettings = {
    name: profData?.professional_name || "Profissional não identificado",
    identType: profData?.ident_type || (isMedical ? "CRM" : "OAB"),
    identNumber: profData?.ident_number || "---",
    identUf: profData?.ident_uf || "--",
    roleTitle: profData?.role_title,
    signatures: profData?.signatures || [],
    medical: profData?.medical_specific,
    legal: profData?.legal_specific,
  };

  // 3. Montagem Final com Fallback
  const context: DocumentContextSnapshot = {
    office: {
      name: officeData?.name || "Organização",
      legalName: officeData?.legal_name || officeData?.name || "Organização",
      cnpj: officeData?.cnpj,
      branding: {
        logoPrimaryUrl: officeData?.branding?.logo_primary_url,
        logoSecondaryUrl: officeData?.branding?.logo_secondary_url,
        primaryColor: officeData?.branding?.primary_color, // Legado
        colors: officeData?.branding?.colors || {
          primary: officeData?.branding?.primary_color || '#1e40af',
          secondary: '#64748b',
          accent: '#3b82f6'
        },
        watermark: officeData?.branding?.watermark || {
          enabled: true,
          opacity: 0.05,
          position: 'center',
          size: 'md'
        },
        documentStyle: officeData?.branding?.documentStyle || {
          legal: 'premium_elegant',
          medical: 'modern_executive'
        },
        institutionalNotes: officeData?.institutional_notes,
      },
    },
    unit,
    professional,
    templateMetadata: {
      id: isMedical 
        ? (officeData?.branding?.documentStyle?.medical || 'modern_executive')
        : (officeData?.branding?.documentStyle?.legal || 'premium_elegant'),
      version: 2.0,
      resolvedAt: new Date().toISOString(),
    },
    resolvedAt: new Date().toISOString(),
    version: "2.0",
  };

  return context;
}


/**
 * Captura e salva um snapshot institucional para um documento.
 * Deve ser chamado no momento da finalização/emissão.
 */
export async function captureDocumentSnapshot(params: {
  documentId: string;
  isMedical: boolean;
  officeId: string;
  context: DocumentContextSnapshot;
}) {
  const { documentId, isMedical, officeId, context } = params;
  const table = isMedical ? "patient_documents" : "documents";

  const { error } = await supabase
    .from(table as any)
    .update({ institutional_snapshot: context })
    .eq("id", documentId)
    .eq("office_id", officeId);

  if (error) {
    console.error("Erro ao salvar snapshot institucional:", error);
    throw error;
  }
}
