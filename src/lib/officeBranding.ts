import { supabase } from "@/integrations/supabase/client";

/**
 * Office branding data structure returned by get_office_branding_json_by_slug
 */
export interface OfficeBranding {
  office_id: string;
  nome_escritorio: string;
  slug: string;
  cnpj: string | null;
  responsavel_nome: string | null;
  responsavel_oab: string | null;
  responsavel_oab_uf: string | null;
  endereco_completo: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  email: string | null;
  telefone: string | null;
  logo_bucket: string | null;
  logo_path: string | null;
  assinatura_bucket: string | null;
  assinatura_path: string | null;
  metadata: Record<string, unknown> | null;
  header_block?: string | null;
}

/** Default branding values when no data is found */
export const DEFAULT_BRANDING: OfficeBranding = {
  office_id: "",
  nome_escritorio: "Escritório",
  slug: "",
  cnpj: null,
  responsavel_nome: null,
  responsavel_oab: null,
  responsavel_oab_uf: null,
  endereco_completo: null,
  cidade: null,
  estado: null,
  cep: null,
  email: null,
  telefone: null,
  logo_bucket: null,
  logo_path: null,
  assinatura_bucket: null,
  assinatura_path: null,
  metadata: null,
  header_block: null,
};

/** Known error codes that indicate "no data found" - not real errors */
const NO_DATA_ERROR_CODES = ["PGRST116", "42P01", "42703"];

/** Check if an error represents "no data found" scenario */
function isNoDataError(err: unknown): boolean {
  if (!err) return true;
  const code = (err as any)?.code;
  const msg = String((err as any)?.message || err);
  
  return (
    NO_DATA_ERROR_CODES.includes(code) ||
    msg.includes("No branding data found") ||
    msg.includes("column g.document_id does not exist") ||
    msg.includes("Sem escritório ativo") ||
    msg.includes("Escritório não encontrado")
  );
}

/** Log only real errors, in dev mode only */
function logBrandingWarning(context: string, err: unknown): void {
  if (import.meta.env.PROD) return;
  
  const code = (err as any)?.code || "unknown";
  const message = (err as any)?.message || "unknown_error";
  const details = (err as any)?.details || null;
  const hint = (err as any)?.hint || null;
  
  console.warn(`[OfficeBranding] ${context}:`, { code, message, details, hint });
}

/**
 * Fetch office branding data by slug using the RPC function.
 * Returns null if no branding found (treated as normal state).
 * Falls back to user's active office if RPC fails with known DB errors.
 */
export async function fetchOfficeBranding(slug: string = "ozires-moreira"): Promise<OfficeBranding | null> {
  try {
    const { data, error } = await supabase.rpc(
      "get_office_branding_json_by_slug",
      { p_slug: slug }
    );

    // No data and no error = normal empty state
    if (!error && !data) {
      return null;
    }

    if (error) {
      // Known "no data" errors - return null, don't throw
      if (isNoDataError(error)) {
        return null;
      }
      throw error;
    }

    return data as unknown as OfficeBranding;
  } catch (err: unknown) {
    // Known DB/view error - try fallback
    if (isNoDataError(err)) {
      return tryFallbackBranding(slug);
    }

    // Real error - log in dev only and return null (graceful degradation)
    logBrandingWarning("fetchOfficeBranding", err);
    return null;
  }
}

/** Fallback: try to build branding from user's active office */
async function tryFallbackBranding(slug: string): Promise<OfficeBranding | null> {
  try {
    const { data: healthRaw, error: healthError } = await supabase.rpc("lexos_healthcheck_session");
    
    if (healthError || !healthRaw) {
      return null;
    }

    const healthArr = healthRaw as Array<{ ok: boolean; office_id: string }> | null;
    const health = healthArr?.[0] ?? null;
    if (!health?.ok || !health.office_id) {
      return null;
    }

    const { data: office, error: officeError } = await supabase
      .from("offices")
      .select(
        "id, name, slug, cnpj, city, state, contact_email, contact_phone, logo_storage_bucket, logo_storage_path, signature_storage_bucket, signature_storage_path, responsible_lawyer_name, responsible_lawyer_oab_number, responsible_lawyer_oab_uf, address_street, address_number, address_neighborhood, address_city, address_state, address_zip_code, metadata"
      )
      .eq("id", health.office_id)
      .maybeSingle();

    if (officeError || !office) {
      return null;
    }

    const enderecoParts = [
      office.address_street,
      office.address_number,
      office.address_neighborhood,
      office.address_city || office.city,
      office.address_state || office.state,
    ].filter(Boolean);

    return {
      office_id: office.id,
      nome_escritorio: office.name,
      slug: office.slug || slug,
      cnpj: office.cnpj,
      responsavel_nome: office.responsible_lawyer_name,
      responsavel_oab: office.responsible_lawyer_oab_number,
      responsavel_oab_uf: office.responsible_lawyer_oab_uf,
      endereco_completo: enderecoParts.length ? enderecoParts.join(", ") : null,
      cidade: office.city,
      estado: office.state,
      cep: office.address_zip_code,
      email: office.contact_email,
      telefone: office.contact_phone,
      logo_bucket: office.logo_storage_bucket,
      logo_path: office.logo_storage_path,
      assinatura_bucket: office.signature_storage_bucket,
      assinatura_path: office.signature_storage_path,
      metadata: (office.metadata as any) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the header block text for an office
 */
export async function fetchOfficeHeader(officeId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc(
      "get_office_header_block",
      { p_office_id: officeId }
    );

    // No error and no data = normal empty state
    if (!error && !data) {
      return null;
    }

    if (error) {
      // Known errors - return null silently
      if (isNoDataError(error)) {
        return null;
      }
      // Real error - log in dev only
      logBrandingWarning("fetchOfficeHeader", error);
      return null;
    }

    return data as string | null;
  } catch {
    // Any exception - graceful degradation
    return null;
  }
}

/**
 * Helper to build a URL for logo or signature stored in Supabase Storage
 * Uses public URL for office-branding bucket, falls back to signed URL for private buckets
 * @param bucket - Storage bucket name (e.g., "office-branding")
 * @param path - File path within the bucket
 * @param expiresInSeconds - URL expiration time for signed URLs (default: 1 hour)
 * @returns Promise with the URL or null if unavailable
 */
export async function getSignedAssetUrl(
  bucket: string | null,
  path: string | null,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  if (!bucket || !path) {
    return null;
  }

  try {
    // For office-branding bucket, try public URL first (if bucket is public)
    if (bucket === "office-branding") {
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      if (publicUrlData?.publicUrl) {
        // Add cache-busting query param to force reload after upload
        return `${publicUrlData.publicUrl}?t=${Date.now()}`;
      }
    }

    // Fall back to signed URL for private buckets
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      // Don't log "Object not found" - expected when no file exists
      // Only warn in dev for other errors
      if (import.meta.env.DEV && !error.message?.includes("Object not found")) {
        console.warn("[OfficeBranding] getSignedAssetUrl:", {
          code: (error as any)?.code || "unknown",
          message: error.message || "unknown_error",
        });
      }
      return null;
    }

    return data?.signedUrl || null;
  } catch {
    // Graceful degradation - no logging needed
    return null;
  }
}

/**
 * Helper to get logo URL from branding data
 */
export async function getOfficeLogo(branding: OfficeBranding): Promise<string | null> {
  return getSignedAssetUrl(branding.logo_bucket, branding.logo_path);
}

/**
 * Helper to get signature URL from branding data
 */
export async function getOfficeSignature(branding: OfficeBranding): Promise<string | null> {
  return getSignedAssetUrl(branding.assinatura_bucket, branding.assinatura_path);
}

/**
 * Template variables for document generation
 * Returns an object with all office placeholders ready for template engine
 */
export function getBrandingTemplateVars(branding: OfficeBranding | null): Record<string, string> {
  if (!branding) {
    return {
      "office.nome_escritorio": "",
      "office.responsavel_nome": "",
      "office.responsavel_oab": "",
      "office.responsavel_oab_uf": "",
      "office.endereco_completo": "",
      "office.cidade": "",
      "office.estado": "",
      "office.cep": "",
      "office.email": "",
      "office.telefone": "",
      "office.cnpj": "",
      "office.header_block": "",
      "office.logo_bucket": "",
      "office.logo_path": "",
      "office.assinatura_bucket": "",
      "office.assinatura_path": "",
    };
  }

  return {
    "office.nome_escritorio": branding.nome_escritorio || "",
    "office.responsavel_nome": branding.responsavel_nome || "",
    "office.responsavel_oab": branding.responsavel_oab || "",
    "office.responsavel_oab_uf": branding.responsavel_oab_uf || "",
    "office.endereco_completo": branding.endereco_completo || "",
    "office.cidade": branding.cidade || "",
    "office.estado": branding.estado || "",
    "office.cep": branding.cep || "",
    "office.email": branding.email || "",
    "office.telefone": branding.telefone || "",
    "office.cnpj": branding.cnpj || "",
    "office.header_block": branding.header_block || "",
    "office.logo_bucket": branding.logo_bucket || "",
    "office.logo_path": branding.logo_path || "",
    "office.assinatura_bucket": branding.assinatura_bucket || "",
    "office.assinatura_path": branding.assinatura_path || "",
  };
}
