import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  OfficeBranding,
  DEFAULT_BRANDING,
  getOfficeLogo,
  getOfficeSignature,
  getBrandingTemplateVars,
} from "@/lib/officeBranding";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/utils";

interface OfficeBrandingContextValue {
  branding: OfficeBranding | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getLogoUrl: () => Promise<string | null>;
  getSignatureUrl: () => Promise<string | null>;
  getTemplateVars: () => Record<string, any>;
}

const OfficeBrandingContext = createContext<
  OfficeBrandingContextValue | undefined
>(undefined);

/**
 * Busca branding diretamente do escritório ativo do usuário logado
 */
async function fetchBrandingFromSession(): Promise<OfficeBranding | null> {
  try {
    const rpcPromise = supabase.rpc("lexos_healthcheck_session").maybeSingle();
    const result = await withTimeout(
      Promise.resolve(rpcPromise),
      8000,
      'OfficeBranding:healthcheck'
    );
    
    const { data: healthRaw, error: rpcError } = result as { data: any; error: any };
    const health = healthRaw ?? null;

    if (rpcError || !health?.ok || !health.office_id) return null;

    const { data: office } = await supabase
      .from("offices")
      .select(
        `
        id,
        name,
        slug,
        cnpj,
        contact_email,
        contact_phone,
        responsible_lawyer_name,
        responsible_lawyer_oab_number,
        responsible_lawyer_oab_uf,
        address_street,
        address_number,
        address_neighborhood,
        address_city,
        address_state,
        address_zip_code,
        logo_storage_bucket,
        logo_storage_path,
        signature_storage_bucket,
        signature_storage_path,
        header_block,
        primary_color,
        secondary_color,
        metadata
      `
      )
      .eq("id", health.office_id)
      .maybeSingle();

    if (!office) return null;

    const endereco = [
      office.address_street,
      office.address_number,
      office.address_neighborhood,
      office.address_city,
      office.address_state,
    ]
      .filter(Boolean)
      .join(", ");

    const metadataObj = (office.metadata as Record<string, any>) || {};

    return {
      office_id: office.id,
      nome_escritorio: office.name,
      slug: office.slug,
      cnpj: office.cnpj,
      email: office.contact_email,
      telefone: office.contact_phone,
      responsavel_nome: office.responsible_lawyer_name,
      responsavel_oab: office.responsible_lawyer_oab_number,
      responsavel_oab_uf: office.responsible_lawyer_oab_uf,
      endereco_completo: endereco || null,
      cidade: office.address_city,
      estado: office.address_state,
      cep: office.address_zip_code,
      logo_bucket: office.logo_storage_bucket,
      logo_path: office.logo_storage_path,
      assinatura_bucket: office.signature_storage_bucket,
      assinatura_path: office.signature_storage_path,
      header_block: office.header_block,
      metadata: {
        ...metadataObj,
        primary_color: office.primary_color || "#111827",
        secondary_color: office.secondary_color || "#D4AF37",
      },
    };
  } catch {
    return null;
  }
}

export function OfficeBrandingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const [branding, setBranding] = useState<OfficeBranding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadBranding = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchBrandingFromSession();
      setBranding(data || DEFAULT_BRANDING);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) return;
    if (loaded) return;

    loadBranding();
  }, [authLoading, user?.id, loaded, loadBranding]);

  /**
   * 🔥 REFRESH FORÇADO – sempre recarrega do banco
   */
  const refresh = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchBrandingFromSession();
      setBranding(data || DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const getLogoUrl = useCallback(async () => {
    if (!branding) return null;
    return getOfficeLogo(branding);
  }, [branding]);

  const getSignatureUrl = useCallback(async () => {
    if (!branding) return null;
    return getOfficeSignature(branding);
  }, [branding]);

  const getTemplateVars = useCallback(() => {
    return getBrandingTemplateVars(branding);
  }, [branding]);

  return (
    <OfficeBrandingContext.Provider
      value={{
        branding,
        loading,
        error,
        refresh,
        getLogoUrl,
        getSignatureUrl,
        getTemplateVars,
      }}
    >
      {children}
    </OfficeBrandingContext.Provider>
  );
}

export function useOfficeBranding(): OfficeBrandingContextValue {
  const ctx = useContext(OfficeBrandingContext);
  if (!ctx) {
    throw new Error(
      "useOfficeBranding must be used within OfficeBrandingProvider"
    );
  }
  return ctx;
}
