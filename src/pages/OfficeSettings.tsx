import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeBranding } from "@/contexts/OfficeBrandingContext";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Save, RotateCcw, Upload, Building2, Trash2, 
  ZoomIn, AlignLeft, AlignCenter, AlignRight, Settings, ArrowLeft,
  Scale, MapPin, Mail, Phone, Palette, Image, FileText, Layout
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppView } from "@/components/WhatsAppView";


interface OfficeData {
  id: string;
  name: string;
  slug: string | null;
  cnpj: string | null;
  responsible_lawyer_name: string | null;
  responsible_lawyer_oab_number: string | null;
  responsible_lawyer_oab_uf: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  header_block: string | null;
  logo_storage_bucket: string | null;
  logo_storage_path: string | null;
  signature_storage_bucket: string | null;
  signature_storage_path: string | null;
  metadata?: Record<string, any>;
}

interface LogoSettings {
  scale: number;
  position: "left" | "center" | "right";
  show_in_header: boolean;
  show_in_documents: boolean;
  border_radius: number;
  background_enabled: boolean;
  background_color: string;
  [key: string]: string | number | boolean;
}

interface SignatureSettings {
  scale: number;
  [key: string]: number;
}

const DEFAULT_SIGNATURE_SETTINGS: SignatureSettings = {
  scale: 100, // 100% = 60px base height
};

const DEFAULT_VALUES: Partial<OfficeData> = {
  primary_color: "#111827",
  secondary_color: "#D4AF37",
};

const DEFAULT_LOGO_SETTINGS: LogoSettings = {
  scale: 100,
  position: "left",
  show_in_header: true,
  show_in_documents: true,
  border_radius: 0,
  background_enabled: false,
  background_color: "#111827",
};

// Cores padrão do sistema para fundo da logo
const LOGO_BACKGROUND_COLORS = [
  { name: "Primário", value: "primary" },
  { name: "Secundário", value: "secondary" },
  { name: "Branco", value: "#FFFFFF" },
  { name: "Preto", value: "#111827" },
  { name: "Transparente", value: "transparent" },
];

/* ─────────────────────────────────────────────────────────────
   Helper: Campo editável estilizado - Premium SaaS
───────────────────────────────────────────────────────────── */
function EditableField({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = "text",
  maxLength,
  colSpan 
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  colSpan?: number;
}) {
  return (
    <div className={colSpan === 2 ? "md:col-span-2" : colSpan === 3 ? "md:col-span-3" : ""}>
      <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-2 block">
        {label}
      </Label>
      <Input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-11 bg-background/50 text-sm font-medium focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

export default function OfficeSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh: refreshBranding } = useOfficeBranding();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<OfficeData>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [logoSettings, setLogoSettings] = useState<LogoSettings>(DEFAULT_LOGO_SETTINGS);
  const [signatureSettings, setSignatureSettings] = useState<SignatureSettings>(DEFAULT_SIGNATURE_SETTINGS);
  
  
  // WhatsApp Config State

  
  // WhatsApp Config State
  type MessagingContextType = 'MEDICAL' | 'LEGAL' | 'GLOBAL';
  const [activeWhatsappContext, setActiveWhatsappContext] = useState<MessagingContextType>("MEDICAL");
  
  const [whatsappConfigs, setWhatsappConfigs] = useState<Record<MessagingContextType, any>>({
    MEDICAL: { endpoint: "", token: "", instanceId: "", clientToken: "", enabled: false, template: "", provider_type: 'NON_OFFICIAL_PROVIDER' },
    LEGAL: { endpoint: "", token: "", instanceId: "", clientToken: "", enabled: false, template: "", provider_type: 'NON_OFFICIAL_PROVIDER' },
    GLOBAL: { endpoint: "", token: "", instanceId: "", clientToken: "", enabled: false, template: "", provider_type: 'NON_OFFICIAL_PROVIDER' }
  });

  const updateWhatsappConfig = (context: MessagingContextType, field: string, value: any) => {
    setWhatsappConfigs(prev => ({
      ...prev,
      [context]: { ...prev[context], [field]: value }
    }));
  };


  const logoPreviewRef = useRef<HTMLDivElement>(null);
  const signaturePreviewRef = useRef<HTMLDivElement>(null);

  // Effect para capturar wheel event nativamente (não-passivo)
  useEffect(() => {
    const el = logoPreviewRef.current;
    if (!el || !logoUrl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -5 : 5;
      setLogoSettings(prev => ({
        ...prev,
        scale: Math.min(800, Math.max(50, prev.scale + delta))
      }));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [logoUrl]);

  // Effect para capturar wheel event na assinatura (redimensionar via scroll)
  useEffect(() => {
    const el = signaturePreviewRef.current;
    if (!el || !signatureUrl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -5 : 5;
      setSignatureSettings(prev => ({
        ...prev,
        scale: Math.min(200, Math.max(50, prev.scale + delta))
      }));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [signatureUrl]);

  const loadOfficeData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data: healthRaw, error: healthError } = await (supabase.rpc("lexos_healthcheck_session") as any);
      
      if (healthError) throw healthError;
      
      const healthArr = healthRaw as Array<{ ok: boolean; office_id: string; role?: string }> | null;
      const health = healthArr?.[0] ?? null;
      if (!health?.ok || !health.office_id) {
        toast.error("Sem escritório ativo");
        navigate("/meu-escritorio");
        return;
      }

      setOfficeId(health.office_id);

      // Fetch WhatsApp Configs (All contexts)
      const { data: whatsappConfigsData, error: whatsappError } = await (supabase
        .from("notificacao_config" as any) as any)
        .select("*")
        .eq("office_id", health.office_id);

      if (whatsappError) throw whatsappError;

      if (whatsappConfigsData && whatsappConfigsData.length > 0) {
        const newConfigs = { ...whatsappConfigs };
        whatsappConfigsData.forEach((cfg: any) => {
          const ctx = (cfg.context_type || 'GLOBAL') as MessagingContextType;
          if (newConfigs[ctx]) {
            newConfigs[ctx] = {
              endpoint: cfg.api_endpoint || "",
              token: cfg.api_token || "",
              instanceId: cfg.whatsapp_instance_id || "",
              clientToken: cfg.whatsapp_client_token || "",
              enabled: cfg.enabled ?? cfg.whatsapp_habilitado ?? false,
              template: cfg.template_lembrete || "",
              provider_type: cfg.provider_type || 'NON_OFFICIAL_PROVIDER'
            };
          }
        });
        setWhatsappConfigs(newConfigs);
        
        // Auto-switch to GLOBAL if only it exists
        if (whatsappConfigsData.some(c => c.context_type === 'GLOBAL') && 
            !whatsappConfigsData.some(c => c.context_type === 'MEDICAL')) {
          setActiveWhatsappContext('GLOBAL');
        }
      }

      const role = health.role;
      // Verificação de permissão desativada a pedido do usuário
      /*
      if (role !== "OWNER" && role !== "ADMIN") {
        toast.error("Acesso negado. Apenas OWNER ou ADMIN podem editar.");
        navigate("/meu-escritorio");
        return;
      }
      */

      const { data: office, error: officeError } = await (supabase
        .from("offices" as any) as any)
        .select(`
          id, name, slug, cnpj,
          responsible_lawyer_name, responsible_lawyer_oab_number, responsible_lawyer_oab_uf,
          contact_email, contact_phone,
          address_street, address_number, address_neighborhood, address_city, address_state, address_zip_code,
          primary_color, secondary_color, header_block,
          logo_storage_bucket, logo_storage_path, signature_storage_bucket, signature_storage_path,
          metadata
        `)
        .eq("id", health.office_id)
        .maybeSingle();

      if (officeError) throw officeError;

      if (office) {
        const metadataObj = (office.metadata as Record<string, any>) || {};
        setFormData({
          ...office,
          primary_color: office.primary_color || DEFAULT_VALUES.primary_color,
          secondary_color: office.secondary_color || DEFAULT_VALUES.secondary_color,
          metadata: metadataObj,
        });

        const savedLogoSettings = metadataObj?.logo_settings || {};
        setLogoSettings({ ...DEFAULT_LOGO_SETTINGS, ...savedLogoSettings });
        
        const savedSignatureSettings = metadataObj?.signature_settings || {};
        setSignatureSettings({ ...DEFAULT_SIGNATURE_SETTINGS, ...savedSignatureSettings });

        if (office.logo_storage_bucket && office.logo_storage_path) {
          const { data } = supabase.storage
            .from(office.logo_storage_bucket)
            .getPublicUrl(office.logo_storage_path);
          setLogoUrl(data?.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null);
        }

        if (office.signature_storage_bucket && office.signature_storage_path) {
          const { data } = supabase.storage
            .from(office.signature_storage_bucket)
            .getPublicUrl(office.signature_storage_path);
          setSignatureUrl(data?.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null);
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("Error loading office data:", err);
      }
      toast.error("Erro ao carregar dados do escritório");
    } finally {
      setLoading(false);
    }
  }, [user?.id, navigate]);

  useEffect(() => {
    loadOfficeData();
  }, [loadOfficeData]);

  const handleInputChange = (field: keyof OfficeData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value || null }));
  };

  const handleLogoSettingChange = (key: keyof LogoSettings, value: any) => {
    setLogoSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!officeId) return;

    // Validate enabled whatsapp configs
    for (const ctx of Object.keys(whatsappConfigs) as MessagingContextType[]) {
      const cfg = whatsappConfigs[ctx];
      if (cfg.enabled) {
        if (!cfg.endpoint?.trim() || !cfg.token?.trim() || !cfg.instanceId?.trim()) {
           toast.error(`A configuração do WhatsApp (${ctx}) está incompleta. Preencha Endpoint, Instance ID e Token, ou desabilite-a.`);
           setActiveWhatsappContext(ctx);
           return;
        }
      }
    }

    setSaving(true);
    try {
      const updatedMetadata = {
        ...(formData.metadata || {}),
        logo_settings: logoSettings,
        signature_settings: signatureSettings,
      };

      const { error } = await (supabase
        .from("offices" as any) as any)
        .update({
          name: formData.name,
          slug: formData.slug,
          cnpj: formData.cnpj,
          responsible_lawyer_name: formData.responsible_lawyer_name,
          responsible_lawyer_oab_number: formData.responsible_lawyer_oab_number,
          responsible_lawyer_oab_uf: formData.responsible_lawyer_oab_uf,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          address_street: formData.address_street,
          address_number: formData.address_number,
          address_neighborhood: formData.address_neighborhood,
          address_city: formData.address_city,
          address_state: formData.address_state,
          address_zip_code: formData.address_zip_code,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          header_block: formData.header_block,
          metadata: updatedMetadata,
        })
        .eq("id", officeId);

      if (error) throw error;

      // 5. Save WhatsApp Configs (for all contexts: MEDICAL, LEGAL, GLOBAL)
      const savePromises = (Object.keys(whatsappConfigs) as MessagingContextType[]).map(ctx => {
        const cfg = whatsappConfigs[ctx];
        
        // Only save if at least one parameter is present
        if (!cfg.endpoint && !cfg.token && !cfg.instanceId && !cfg.clientToken && !cfg.template) {
           return Promise.resolve({ data: null, error: null });
        }

        return (supabase
          .from("notificacao_config" as any) as any)
          .upsert({
            office_id: officeId,
            context_type: ctx,
            api_endpoint: cfg.endpoint,
            api_token: cfg.token,
            whatsapp_instance_id: cfg.instanceId,
            whatsapp_client_token: cfg.clientToken,
            whatsapp_habilitado: cfg.enabled,
            enabled: cfg.enabled,
            template_lembrete: cfg.template,
            provider_type: cfg.provider_type || 'NON_OFFICIAL_PROVIDER'
          }, { onConflict: 'office_id,context_type' });
      });

      const whatsappResults = await Promise.all(savePromises);
      const firstError = whatsappResults.find(r => r.error);
      if (firstError) throw firstError.error;

      toast.success("Configurações salvas com sucesso!");
      await refreshBranding();
      navigate("/meu-escritorio");
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("Error saving office settings:", err);
      }
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setFormData(prev => ({
      ...prev,
      primary_color: DEFAULT_VALUES.primary_color,
      secondary_color: DEFAULT_VALUES.secondary_color,
    }));
    toast.info("Cores restauradas para padrão");
  };

  const handleFileUpload = async (type: "logo" | "signature", file: File) => {
    if (!officeId) return;

    const bucket = "office-branding";
    const fileName = type === "logo" ? "logo.png" : "assinatura.png";
    const path = `${officeId}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type || "image/png" });

      if (uploadError) throw uploadError;

      const updateData = type === "logo"
        ? { logo_storage_bucket: bucket, logo_storage_path: path }
        : { signature_storage_bucket: bucket, signature_storage_path: path };

      const { error: updateError } = await (supabase
        .from("offices" as any) as any)
        .update(updateData)
        .eq("id", officeId);

      if (updateError) throw updateError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const cacheBustedUrl = `${data?.publicUrl}?t=${Date.now()}`;
      
      if (type === "logo") {
        setLogoUrl(cacheBustedUrl);
        setFormData(prev => ({ ...prev, logo_storage_bucket: bucket, logo_storage_path: path }));
      } else {
        setSignatureUrl(cacheBustedUrl);
        setFormData(prev => ({ ...prev, signature_storage_bucket: bucket, signature_storage_path: path }));
      }

      toast.success(`${type === "logo" ? "Logo" : "Assinatura"} atualizado(a) com sucesso!`);
      await refreshBranding();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`Error uploading ${type}:`, err);
      }
      toast.error(`Erro ao fazer upload do ${type === "logo" ? "logo" : "assinatura"}`);
    }
  };

  const handleRemoveAsset = async (type: "logo" | "signature") => {
    if (!officeId) return;

    try {
      const updateData = type === "logo"
        ? { logo_storage_bucket: null, logo_storage_path: null }
        : { signature_storage_bucket: null, signature_storage_path: null };

      const { error } = await (supabase
        .from("offices" as any) as any)
        .update(updateData)
        .eq("id", officeId);

      if (error) throw error;

      if (type === "logo") {
        setLogoUrl(null);
        setFormData(prev => ({ ...prev, logo_storage_bucket: null, logo_storage_path: null }));
      } else {
        setSignatureUrl(null);
        setFormData(prev => ({ ...prev, signature_storage_bucket: null, signature_storage_path: null }));
      }

      toast.success(`${type === "logo" ? "Logo" : "Assinatura"} removido(a) com sucesso!`);
      await refreshBranding();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`Error removing ${type}:`, err);
      }
      toast.error(`Erro ao remover ${type === "logo" ? "logo" : "assinatura"}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-28 md:pb-20">
      <div className="container max-w-6xl py-4 sm:py-8 px-4 sm:px-6 space-y-6 sm:space-y-8">
        
        {/* ═══════════════════════════════════════════════════════════════
            HERO SECTION - Premium SaaS Header
        ═══════════════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border/60 shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          
          <div className="relative px-6 py-8 md:px-10 md:py-10">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/meu-escritorio')} 
              className="gap-2 mb-6 -ml-2 text-muted-foreground/70 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Meu Escritório
            </Button>
            
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="flex-shrink-0">
                {logoUrl ? (
                  <div className="w-20 h-20 rounded-xl bg-white/80 backdrop-blur border shadow-sm flex items-center justify-center p-2 overflow-hidden">
                    <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-dashed border-primary/20 flex items-center justify-center">
                    <Settings className="h-8 w-8 text-primary/40" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0 space-y-2">
                <div className="space-y-1">
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
                    Configurações
                  </h1>
                  <p className="text-xs text-muted-foreground/60 font-medium tracking-widest uppercase">
                    Gestão Institucional • CRM • Identidade
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                   <Badge variant="outline" className="text-[10px] bg-background/50 border-border/60 text-muted-foreground uppercase tracking-wider">
                    Modo Edição
                  </Badge>
                   <Badge variant="outline" className="text-[10px] bg-emerald-500/5 border-emerald-500/10 text-emerald-500 uppercase tracking-wider">
                    Sincronizado
                  </Badge>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0 md:pt-1">
                <Button 
                  onClick={handleSave} 
                  disabled={saving} 
                  size="lg"
                  className="gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            TABS DE CONFIGURAÇÃO - Reorganizado
        ═══════════════════════════════════════════════════════════════ */}
        <Tabs defaultValue={window.location.hash === '#whatsapp-config' ? 'whatsapp' : 'identidade'} className="space-y-6">
          <TabsList className="bg-background/40 backdrop-blur border border-border/60 p-1 h-14 w-full md:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="identidade" className="gap-2 px-3 sm:px-6 h-full data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Institucional</span>
              <span className="sm:hidden">Instit.</span>
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2 px-3 sm:px-6 h-full data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Palette className="h-4 w-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2 px-3 sm:px-6 h-full border-2 border-emerald-500/0 data-[state=active]:border-emerald-500/20 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 text-emerald-500/70 text-xs sm:text-sm">
              <Phone className="h-4 w-4" />
              Configurar WhatsApp
            </TabsTrigger>
          </TabsList>

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: INSTITUCIONAL
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="identidade" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="shadow-sm border-border/60">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Layout className="h-4 w-4 text-muted-foreground" />
                    Identidade Jurídica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <EditableField label="Nome do Escritório" value={formData.name || null} onChange={(v) => handleInputChange("name", v)} placeholder="Ex: Escritório Advocacia" />
                  <EditableField label="Slug (URL)" value={formData.slug || null} onChange={(v) => handleInputChange("slug", v)} placeholder="seu-escritorio" />
                  <EditableField label="CNPJ" value={formData.cnpj || null} onChange={(v) => handleInputChange("cnpj", v)} placeholder="00.000.000/0000-00" />
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/60">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    Responsável Técnico
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <EditableField label="Nome Completo" value={formData.responsible_lawyer_name || null} onChange={(v) => handleInputChange("responsible_lawyer_name", v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <EditableField label="UF OAB" value={formData.responsible_lawyer_oab_uf || null} onChange={(v) => handleInputChange("responsible_lawyer_oab_uf", v)} maxLength={2} />
                    <EditableField label="Número OAB" value={formData.responsible_lawyer_oab_number || null} onChange={(v) => handleInputChange("responsible_lawyer_oab_number", v)} />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/60 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Endereço e Contato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                       <EditableField label="E-mail" value={formData.contact_email || null} onChange={(v) => handleInputChange("contact_email", v)} type="email" />
                       <EditableField label="Telefone" value={formData.contact_phone || null} onChange={(v) => handleInputChange("contact_phone", v)} />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                       <EditableField label="CEP" value={formData.address_zip_code || null} onChange={(v) => handleInputChange("address_zip_code", v)} />
                       <EditableField label="Rua/Logradouro" value={formData.address_street || null} onChange={(v) => handleInputChange("address_street", v)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <EditableField label="Número" value={formData.address_number || null} onChange={(v) => handleInputChange("address_number", v)} />
                    <EditableField label="Bairro" value={formData.address_neighborhood || null} onChange={(v) => handleInputChange("address_neighborhood", v)} />
                    <EditableField label="Cidade" value={formData.address_city || null} onChange={(v) => handleInputChange("address_city", v)} />
                    <EditableField label="Estado" value={formData.address_state || null} onChange={(v) => handleInputChange("address_state", v)} maxLength={2} />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/60 md:col-span-2 bg-muted/5">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Cabeçalho de Documentos (PDF)
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase">Ficha Técnica</Label>
                    <Textarea 
                      value={formData.header_block || ""} 
                      onChange={(e) => handleInputChange("header_block", e.target.value)} 
                      rows={6}
                      className="bg-background font-mono text-sm leading-relaxed"
                    />
                  </div>
                  <div className="bg-white border border-dashed rounded-lg p-6 text-gray-800 text-[11px] font-serif shadow-inner">
                    {formData.header_block || "O texto do cabeçalho aparecerá aqui..."}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: BRANDING
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="branding" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="shadow-sm border-border/60 h-fit">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    Cores Institucionais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase opacity-60">Primária</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={formData.primary_color || DEFAULT_VALUES.primary_color} onChange={(e) => handleInputChange("primary_color", e.target.value)} className="w-14 h-11" />
                        <Input value={formData.primary_color || DEFAULT_VALUES.primary_color} onChange={(e) => handleInputChange("primary_color", e.target.value)} className="flex-1 font-mono" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase opacity-60">Secundária</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={formData.secondary_color || DEFAULT_VALUES.secondary_color} onChange={(e) => handleInputChange("secondary_color", e.target.value)} className="w-14 h-11" />
                        <Input value={formData.secondary_color || DEFAULT_VALUES.secondary_color} onChange={(e) => handleInputChange("secondary_color", e.target.value)} className="flex-1 font-mono" />
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                     <Button variant="outline" size="sm" onClick={handleResetDefaults} className="w-full gap-2">
                        <RotateCcw className="h-3 w-3" /> Restaurar Cores Padrão
                     </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Logo e Assinatura ocupam a outra coluna */}
              <div className="space-y-6">
                 <Card className="shadow-sm border-border/60">
                   <CardHeader>
                      <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                        <Image className="h-4 w-4 text-muted-foreground" />
                        Logotipo
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-6">
                      <div 
                        ref={logoPreviewRef}
                        className="h-40 bg-muted/20 border-2 border-dashed rounded-xl flex items-center justify-center relative overflow-hidden group cursor-ns-resize"
                      >
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" style={{ transform: `scale(${logoSettings.scale / 100})` }} className="max-h-32 object-contain select-none" />
                        ) : <Image className="h-10 w-10 opacity-20" />}
                      </div>
                      <div className="flex gap-3">
                         <label className="flex-1">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("logo", e.target.files[0])} />
                            <Button variant="outline" className="w-full gap-2" asChild><span><Upload className="h-4 w-4" /> {logoUrl ? "Trocar" : "Enviar"} Logo</span></Button>
                         </label>
                         {logoUrl && <Button variant="ghost" className="text-destructive" onClick={() => handleRemoveAsset("logo")}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                   </CardContent>
                 </Card>

                 <Card className="shadow-sm border-border/60">
                   <CardHeader>
                      <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                        Assinatura Digital
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-6">
                      <div 
                        ref={signaturePreviewRef}
                        className="h-24 bg-muted/20 border-2 border-dashed rounded-xl flex items-center justify-center relative overflow-hidden cursor-ns-resize"
                      >
                        {signatureUrl ? (
                          <img src={signatureUrl} alt="Assinatura" style={{ transform: `scale(${signatureSettings.scale / 100})` }} className="max-h-20 object-contain select-none" />
                        ) : <Scale className="h-8 w-8 opacity-20" />}
                      </div>
                      <div className="flex gap-3">
                         <label className="flex-1">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("signature", e.target.files[0])} />
                            <Button variant="outline" className="w-full gap-2" asChild><span><Upload className="h-4 w-4" /> {signatureUrl ? "Trocar" : "Enviar"} Assinatura</span></Button>
                         </label>
                         {signatureUrl && <Button variant="ghost" className="text-destructive" onClick={() => handleRemoveAsset("signature")}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                   </CardContent>
                 </Card>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: WHATSAPP - A GRANDE NOVIDADE
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="whatsapp" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <Card id="whatsapp-config" className="shadow-xl border-emerald-500/20 bg-emerald-500/[0.02] overflow-hidden">
               <div className="bg-emerald-500/5 border-b border-emerald-500/10 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm shadow-emerald-500/10">
                      <Phone className="h-7 w-7" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">Configurar WhatsApp</CardTitle>
                      <CardDescription className="text-sm font-medium text-emerald-600/70">Integração oficial via WhatsApi Engine</CardDescription>
                    </div>
                  </div>
                  <div className="bg-background/80 backdrop-blur px-6 py-4 rounded-2xl border flex flex-col items-end gap-2 shadow-sm">
                    <div className="flex items-center gap-4 w-full justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Status da Integração</p>
                        <p className={`text-xs font-bold ${whatsappConfigs[activeWhatsappContext].enabled ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {whatsappConfigs[activeWhatsappContext].enabled ? 'HABILITADA' : 'DESABILITADA'}
                        </p>
                      </div>
                      <Switch 
                        checked={whatsappConfigs[activeWhatsappContext].enabled} 
                        onCheckedChange={(v) => updateWhatsappConfig(activeWhatsappContext, 'enabled', v)} 
                        className="data-[state=checked]:bg-emerald-500" 
                      />
                    </div>
                  </div>
               </div>

               <div className="px-8 pt-6 border-b border-emerald-500/10">
                  <Tabs value={activeWhatsappContext} onValueChange={(v) => setActiveWhatsappContext(v as MessagingContextType)} className="w-full">
                    <TabsList className="bg-emerald-500/5 p-1 h-12 w-full overflow-x-auto">
                      <TabsTrigger value="MEDICAL" className="gap-2 px-3 sm:px-8 h-full data-[state=active]:bg-white data-[state=active]:text-emerald-600 text-xs sm:text-sm">
                        MÉDICO
                      </TabsTrigger>
                      <TabsTrigger value="LEGAL" className="gap-2 px-3 sm:px-8 h-full data-[state=active]:bg-white data-[state=active]:text-emerald-600 text-xs sm:text-sm">
                        JURÍDICO
                      </TabsTrigger>
                      <TabsTrigger value="GLOBAL" className="gap-2 px-3 sm:px-8 h-full data-[state=active]:bg-white data-[state=active]:text-emerald-600 text-xs sm:text-sm">
                        GLOBAL
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
               </div>

               <CardContent className="p-4 sm:p-8">
                 <div className="grid md:grid-cols-2 gap-8 items-start">
                   <div className="space-y-6">
                     {officeId && <WhatsAppView officeId={officeId} />}

                     <div className="space-y-3">
                       <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Client Token / WABA ID (Opcional - Meta Oficial)</Label>
                       <Input 
                          type="password"
                          placeholder="Token de segurança ou ID do WhatsApp Business Account" 
                          value={whatsappConfigs[activeWhatsappContext].clientToken} 
                          onChange={(e) => updateWhatsappConfig(activeWhatsappContext, 'clientToken', e.target.value)}
                          className="h-12 bg-background border-border/80 focus:ring-emerald-500/20 focus:border-emerald-500/50 text-sm font-medium transition-all"
                       />
                     </div>

                     <div className="space-y-3">
                       <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Template de Lembrete</Label>
                       <Textarea 
                          placeholder={activeWhatsappContext === 'MEDICAL' ? "Olá {paciente}, lembramos da sua consulta..." : "Olá {cliente}, lembramos do seu compromisso..."} 
                          value={whatsappConfigs[activeWhatsappContext].template} 
                          onChange={(e) => updateWhatsappConfig(activeWhatsappContext, 'template', e.target.value)}
                          className="h-32 bg-background border-border/80 focus:ring-emerald-500/20 focus:border-emerald-500/50 text-sm font-medium transition-all"
                       />
                       <p className="text-[10px] text-muted-foreground italic px-1">
                          {activeWhatsappContext === 'MEDICAL' 
                            ? "Variáveis: {paciente}, {data}, {hora}, {clinica}" 
                            : "Variáveis: {cliente}, {processo}, {data}, {hora}"}
                       </p>
                     </div>
                   </div>

                   <div className="bg-emerald-500/5 rounded-2xl border border-emerald-500/10 p-8 flex flex-col justify-between h-full">
                      <div className="space-y-4">
                         <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
                            <FileText className="h-5 w-5" />
                         </div>
                         <h4 className="font-bold text-emerald-700">Como funciona a Mensageria?</h4>
                         <p className="text-sm text-emerald-600/80 leading-relaxed">
                           O Flaito utiliza a tecnologia <strong>WhatsApi (uazapi)</strong> para garantir máxima estabilidade e velocidade nas suas automações.
                         </p>
                         <ul className="space-y-2.5">
                           {['Multi-instância Isolada', 'Contexto GLOBAL de Fallback', 'Fila de Envio Inteligente', 'Variáveis Dinâmicas'].map(item => (
                             <li key={item} className="flex items-center gap-2 text-xs font-semibold text-emerald-700/70">
                               <div className="h-1 w-1 rounded-full bg-emerald-500" />
                               {item}
                             </li>
                           ))}
                         </ul>
                      </div>
                   </div>
                 </div>

                 <div className="mt-8 pt-8 border-t border-emerald-500/10 flex flex-col md:flex-row items-center gap-6">
                   <p className="text-xs text-muted-foreground leading-relaxed text-center md:text-left font-medium">
                     Contexto ativo: <strong className="text-emerald-600">{activeWhatsappContext}</strong>. 
                     {activeWhatsappContext === 'GLOBAL' 
                       ? " Esta configuração será usada para qualquer envio onde não houver uma configuração específica (Médica ou Jurídica)."
                       : " Se esta configuração estiver vazia, o sistema tentará usar a configuração GLOBAL."}
                   </p>
                 </div>
               </CardContent>
             </Card>
          </TabsContent>

        </Tabs>

        {/* ═══════════════════════════════════════════════════════════════
            FOOTER ACTIONS - Floating Style
        ═══════════════════════════════════════════════════════════════ */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-50">
           <div className="bg-background/80 backdrop-blur-xl border border-border/60 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-muted-foreground hidden md:block px-4">
                Alterações não salvas serão perdidas ao sair.
              </p>
              <div className="flex gap-3 w-full md:w-auto">
                <Button variant="ghost" onClick={() => navigate("/meu-escritorio")} className="flex-1 md:flex-none">Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} size="lg" className="flex-1 md:flex-none gap-2 px-8 bg-gradient-to-r from-primary to-primary/90">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Configurações
                </Button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
