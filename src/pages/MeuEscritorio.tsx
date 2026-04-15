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
  ZoomIn, AlignLeft, AlignCenter, AlignRight, Settings,
  Scale, MapPin, Mail, Phone, Palette, Image, FileText, Users
} from "lucide-react";

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
  colSpan,
  disabled = false
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  colSpan?: number;
  disabled?: boolean;
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
        disabled={disabled}
        readOnly={disabled}
        className={`h-11 text-sm font-medium focus:ring-2 focus:ring-primary/20 ${disabled ? 'bg-muted/30 opacity-80' : 'bg-background/50'}`}
      />
    </div>
  );
}

export default function MeuEscritorio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh: refreshBranding } = useOfficeBranding();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<OfficeData>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [logoSettings, setLogoSettings] = useState<LogoSettings>(DEFAULT_LOGO_SETTINGS);
  const [signatureSettings, setSignatureSettings] = useState<SignatureSettings>(DEFAULT_SIGNATURE_SETTINGS);
  const logoPreviewRef = useRef<HTMLDivElement>(null);
  const signaturePreviewRef = useRef<HTMLDivElement>(null);

  // O aplicativo agora é para uso pessoal/local, então a edição é sempre permitida.
  const canEdit = true;

  // Effect para capturar wheel event nativamente (não-passivo)
  useEffect(() => {
    const el = logoPreviewRef.current;
    if (!el || !logoUrl || !canEdit) return;

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
  }, [logoUrl, canEdit]);

  // Effect para capturar wheel event na assinatura (redimensionar via scroll)
  useEffect(() => {
    const el = signaturePreviewRef.current;
    if (!el || !signatureUrl || !canEdit) return;

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
  }, [signatureUrl, canEdit]);

  const loadOfficeData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data: healthRaw, error: healthError } = await supabase.rpc("lexos_healthcheck_session");

      if (healthError) throw healthError;

      const healthArr = healthRaw as Array<{ ok: boolean; office_id: string; role?: string }> | null;
      const health = healthArr?.[0] ?? null;
      if (!health?.ok || !health.office_id) {
        toast.error("Sem escritório logado");
        return;
      }

      setOfficeId(health.office_id);
      setUserRole(health.role || "MEMBER");

      const { data: office, error: officeError } = await supabase
        .from("offices")
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
  }, [user?.id]);

  useEffect(() => {
    loadOfficeData();
  }, [loadOfficeData]);

  const handleInputChange = (field: keyof OfficeData, value: string) => {
    if (!canEdit) return;
    setFormData(prev => ({ ...prev, [field]: value || null }));
  };

  const handleLogoSettingChange = (key: keyof LogoSettings, value: any) => {
    if (!canEdit) return;
    setLogoSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!officeId || !canEdit) return;

    setSaving(true);
    try {
      const updatedMetadata = {
        ...(formData.metadata || {}),
        logo_settings: logoSettings,
        signature_settings: signatureSettings,
      };

      const { error } = await supabase
        .from("offices")
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

      toast.success("Assinaturas e Informações de Escritório salvas com sucesso!");
      await refreshBranding();
      // Opcional: reload total da página após muito tempo só pra precaver
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("Error saving office settings:", err);
      }
      toast.error("Erro ao salvar dados do escritório");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (!canEdit) return;
    setFormData(prev => ({
      ...prev,
      primary_color: DEFAULT_VALUES.primary_color,
      secondary_color: DEFAULT_VALUES.secondary_color,
    }));
    toast.info("Cores restauradas para padrão");
  };

  const handleFileUpload = async (type: "logo" | "signature", file: File) => {
    if (!officeId || !canEdit) return;

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

      const { error: updateError } = await supabase
        .from("offices")
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
    if (!officeId || !canEdit) return;

    try {
      const updateData = type === "logo"
        ? { logo_storage_bucket: null, logo_storage_path: null }
        : { signature_storage_bucket: null, signature_storage_path: null };

      const { error } = await supabase
        .from("offices")
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-6xl py-8 space-y-8">

        {/* ═══════════════════════════════════════════════════════════════
            HERO SECTION - Meu Escritório Header Premium
        ═══════════════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border/60 shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/[0.02] rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

          <div className="relative px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Logo Preview */}
              <div className="flex-shrink-0">
                {logoUrl ? (
                  <div className="w-20 h-20 rounded-xl bg-white/80 backdrop-blur border shadow-sm flex items-center justify-center p-2 overflow-hidden">
                    <img src={logoUrl} alt="Logo do Escritório" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-dashed border-primary/20 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-primary/40" />
                  </div>
                )}
              </div>

              {/* Title & Meta - Enhanced Typography */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="space-y-1">
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
                    Meu Escritório
                  </h1>
                  <p className="text-xs text-muted-foreground/60 font-medium tracking-widest uppercase">
                    Advocacia & Consultoria Jurídica
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium border-border/60 uppercase tracking-wider ${canEdit ? "bg-primary/10 text-primary border-primary/20" : "bg-background/50 text-muted-foreground"
                      }`}
                  >
                    {canEdit ? "Edição Habitadada" : "Modo Visualização (Sem permissão)"}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex flex-col gap-2 flex-shrink-0 md:pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    size="lg"
                    className="gap-2 shadow-sm"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Alterações
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/settings/members')}
                    className="gap-2 text-muted-foreground bg-background"
                  >
                    <Users className="h-4 w-4" />
                    Gerenciar Membros
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            GRID DE CARDS - Operacionais em 2 colunas
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid gap-6 md:grid-cols-2">

          {/* Card: Identidade do Escritório */}
          <Card className="shadow-sm hover:shadow-md transition-shadow border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-muted/80">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">Identidade do Escritório</CardTitle>
                  <CardDescription className="text-xs">Nome e identificação oficial</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableField
                label="Nome do Escritório"
                value={formData.name || null}
                onChange={(v) => handleInputChange("name", v)}
                placeholder="Ex: Escritório de Advocacia Silva"
                disabled={!canEdit}
              />
              <EditableField
                label="Slug (Url Local)"
                value={formData.slug || null}
                onChange={(v) => handleInputChange("slug", v)}
                placeholder="silva-advogados"
                disabled={!canEdit}
              />
              <EditableField
                label="CNPJ"
                value={formData.cnpj || null}
                onChange={(v) => handleInputChange("cnpj", v)}
                placeholder="00.000.000/0000-00"
                disabled={!canEdit}
              />
            </CardContent>
          </Card>

          {/* Card: Responsável Técnico */}
          <Card className="shadow-sm hover:shadow-md transition-shadow border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-muted/80">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">Responsável Técnico</CardTitle>
                  <CardDescription className="text-xs">Advogado responsável e registro</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableField
                label="Nome Completo"
                value={formData.responsible_lawyer_name || null}
                onChange={(v) => handleInputChange("responsible_lawyer_name", v)}
                placeholder="Ex: Dr. João da Silva"
                disabled={!canEdit}
              />
              <div className="grid grid-cols-2 gap-3">
                <EditableField
                  label="UF OAB"
                  value={formData.responsible_lawyer_oab_uf || null}
                  onChange={(v) => handleInputChange("responsible_lawyer_oab_uf", v)}
                  placeholder="SP"
                  maxLength={2}
                  disabled={!canEdit}
                />
                <EditableField
                  label="Número OAB"
                  value={formData.responsible_lawyer_oab_number || null}
                  onChange={(v) => handleInputChange("responsible_lawyer_oab_number", v)}
                  placeholder="12345"
                  disabled={!canEdit}
                />
              </div>

              {/* OAB Preview badge */}
              {formData.responsible_lawyer_oab_number && (
                <div className="mt-4 p-3 rounded-lg bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] border border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Scale className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">
                        Registro OAB Configurado
                      </p>
                      <p className="text-lg font-bold text-foreground tracking-tight">
                        {formData.responsible_lawyer_oab_number}/{formData.responsible_lawyer_oab_uf || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Contato */}
          <Card className="shadow-sm hover:shadow-md transition-shadow border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-muted/80">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">Contato</CardTitle>
                  <CardDescription className="text-xs">E-mail e telefone do escritório</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableField
                label="E-mail"
                value={formData.contact_email || null}
                onChange={(v) => handleInputChange("contact_email", v)}
                placeholder="contato@escritorio.com.br"
                type="email"
                disabled={!canEdit}
              />
              <EditableField
                label="Telefone Corporativo"
                value={formData.contact_phone || null}
                onChange={(v) => handleInputChange("contact_phone", v)}
                placeholder="(11) 99999-0000"
                disabled={!canEdit}
              />
            </CardContent>
          </Card>

          {/* Card: Cores do Tema */}
          <Card className="shadow-sm hover:shadow-md transition-shadow border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-muted/80">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 flex justify-between items-center">
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">Cores do Tema</CardTitle>
                    <CardDescription className="text-xs">Personalização visual</CardDescription>
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      onClick={handleResetDefaults}
                      className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Resetar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.primary_color || DEFAULT_VALUES.primary_color}
                    onChange={(e) => handleInputChange("primary_color", e.target.value)}
                    disabled={!canEdit}
                    className="w-14 h-11 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color || DEFAULT_VALUES.primary_color}
                    onChange={(e) => handleInputChange("primary_color", e.target.value)}
                    placeholder="#111827"
                    disabled={!canEdit}
                    readOnly={!canEdit}
                    className={`flex-1 h-11 font-mono text-sm font-medium ${!canEdit ? 'bg-muted/30' : ''}`}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.secondary_color || DEFAULT_VALUES.secondary_color}
                    onChange={(e) => handleInputChange("secondary_color", e.target.value)}
                    disabled={!canEdit}
                    className="w-14 h-11 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color || DEFAULT_VALUES.secondary_color}
                    onChange={(e) => handleInputChange("secondary_color", e.target.value)}
                    placeholder="#D4AF37"
                    disabled={!canEdit}
                    readOnly={!canEdit}
                    className={`flex-1 h-11 font-mono text-sm font-medium ${!canEdit ? 'bg-muted/30' : ''}`}
                  />
                </div>
              </div>

              {/* Preview visual das cores */}
              <div className="pt-3 border-t border-border/30 space-y-3">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                  Prévia de Aplicação de Elementos
                </p>
                <div className="h-2.5 rounded-full overflow-hidden flex shadow-inner border border-border/30">
                  <div className="flex-[2]" style={{ backgroundColor: formData.primary_color || DEFAULT_VALUES.primary_color }} />
                  <div className="flex-1" style={{ backgroundColor: formData.secondary_color || DEFAULT_VALUES.secondary_color }} />
                </div>
                <div className="flex gap-2">
                  <div
                    className="px-4 py-2 rounded-md text-xs font-medium text-white shadow-sm"
                    style={{ backgroundColor: formData.primary_color || DEFAULT_VALUES.primary_color }}
                  >
                    Botão Primário
                  </div>
                  <div
                    className="px-4 py-2 rounded-md text-xs font-medium border shadow-sm bg-background"
                    style={{ borderColor: formData.secondary_color || DEFAULT_VALUES.secondary_color, color: formData.secondary_color || DEFAULT_VALUES.secondary_color }}
                  >
                    Secundário
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            LOCALIZAÇÃO (Full Width - Crítico)
        ═══════════════════════════════════════════════════════════════ */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-muted/80">
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">Localização do Escritório</CardTitle>
                <CardDescription className="text-xs">Endereço completo estruturado para documentos processuais</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-3">
                <EditableField
                  label="Logradouro"
                  value={formData.address_street || null}
                  onChange={(v) => handleInputChange("address_street", v)}
                  placeholder="Ex: Rua Direita, Avenida da Justiça"
                  disabled={!canEdit}
                />
              </div>
              <EditableField
                label="Número"
                value={formData.address_number || null}
                onChange={(v) => handleInputChange("address_number", v)}
                placeholder="Ex: 123, S/N"
                disabled={!canEdit}
              />
              <div className="md:col-span-2">
                <EditableField
                  label="Bairro"
                  value={formData.address_neighborhood || null}
                  onChange={(v) => handleInputChange("address_neighborhood", v)}
                  placeholder="Ex: Centro"
                  disabled={!canEdit}
                />
              </div>
              <div className="md:col-span-2">
                <EditableField
                  label="Cidade"
                  value={formData.address_city || null}
                  onChange={(v) => handleInputChange("address_city", v)}
                  placeholder="Sua cidade"
                  disabled={!canEdit}
                />
              </div>
              <EditableField
                label="Estado"
                value={formData.address_state || null}
                onChange={(v) => handleInputChange("address_state", v)}
                placeholder="SP"
                maxLength={2}
                disabled={!canEdit}
              />
              <div className="md:col-span-2">
                <EditableField
                  label="CEP"
                  value={formData.address_zip_code || null}
                  onChange={(v) => handleInputChange("address_zip_code", v)}
                  placeholder="00000-000"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            CABEÇALHO INSTITUCIONAL (Full Width - Crítico)
        ═══════════════════════════════════════════════════════════════ */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-muted/80">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">Cabeçalho Institucional</CardTitle>
                <CardDescription className="text-xs">Texto padronizado que será injetado no início de procurações e contratos automáticos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Editor */}
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Editor de Texto do Cabeçalho</Label>
                <Textarea
                  value={formData.header_block || ""}
                  onChange={(e) => handleInputChange("header_block", e.target.value)}
                  placeholder="Ex: ESCRITÓRIO DE ADVOCACIA SILVA\nInscrito no CNPJ sob o nº 00.000.000/0000-00\nRua Direita, 123, Centro, São Paulo - SP\nE-mail: contato@escritorio.com"
                  rows={8}
                  disabled={!canEdit}
                  readOnly={!canEdit}
                  className={`font-mono text-sm resize-none ${!canEdit ? 'bg-muted/30 opacity-80' : 'bg-background/50'}`}
                />
              </div>

              {/* Preview estilizado */}
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Visualização Aplicada em Documentos</Label>
                <div className="bg-white border border-border/50 rounded-lg p-6 min-h-[200px] shadow-inner">
                  {formData.header_block ? (
                    <div
                      className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-w-xl mx-auto text-center"
                      style={{ fontFamily: "'Times New Roman', serif" }}
                    >
                      {formData.header_block}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground/50 italic text-sm">
                      O preview do seu cabeçalho aparecerá aqui...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            IDENTIDADE VISUAL (Full Width - Crítico)
        ═══════════════════════════════════════════════════════════════ */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-muted/80">
                <Image className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">Identidade Visual (Uploads)</CardTitle>
                <CardDescription className="text-xs">Logo e assinatura digital para os documentos gerados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid lg:grid-cols-2 gap-8">

              {/* Logo Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Logo da Marca
                </h3>

                {/* Preview grande */}
                <div
                  ref={logoPreviewRef}
                  className={`bg-gradient-to-br from-muted/20 to-muted/40 border-2 border-dashed border-muted rounded-xl p-6 min-h-[200px] flex items-center relative group overflow-hidden ${canEdit ? 'cursor-ns-resize' : ''}`}
                  style={{
                    justifyContent: logoSettings.position === "center" ? "center" : logoSettings.position === "right" ? "flex-end" : "flex-start"
                  }}
                  title={canEdit ? "Scroll para redimensionar" : undefined}
                >
                  {logoUrl ? (
                    <>
                      <div
                        className="rounded-lg p-3 shadow-sm transition-all duration-200 flex items-center justify-center overflow-hidden"
                        style={{
                          borderRadius: `${logoSettings.border_radius}px`,
                          backgroundColor: logoSettings.background_enabled
                            ? logoSettings.background_color === "primary"
                              ? formData.primary_color || "#111827"
                              : logoSettings.background_color === "secondary"
                                ? formData.secondary_color || "#D4AF37"
                                : logoSettings.background_color === "transparent"
                                  ? "transparent"
                                  : logoSettings.background_color
                            : "white",
                          maxWidth: "100%",
                          maxHeight: "180px"
                        }}
                      >
                        <img
                          src={logoUrl}
                          alt="Logo"
                          draggable={false}
                          style={{
                            width: `${logoSettings.scale * 1.6}px`,
                            maxWidth: "100%",
                            maxHeight: "160px",
                            objectFit: "contain"
                          }}
                          className="transition-all duration-200 select-none"
                        />
                      </div>
                      {canEdit && (
                        <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          Scroll para redimensionar • {logoSettings.scale}%
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground mx-auto">
                      <Image className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum logo cadastrado</p>
                    </div>
                  )}
                </div>

                {/* Botões - Apenas para editores */}
                {canEdit && (
                  <>
                    <div className="flex gap-2">
                      <label className="cursor-pointer flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload("logo", file);
                          }}
                        />
                        <Button type="button" variant="outline" className="w-full gap-2" asChild>
                          <span>
                            <Upload className="h-4 w-4" />
                            {logoUrl ? "Trocar Logo" : "Enviar Novo Logo"}
                          </span>
                        </Button>
                      </label>
                      {logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleRemoveAsset("logo")}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {logoUrl && (
                      <div className="space-y-4 pt-4 border-t border-border/30">
                        {/* Escala */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider flex items-center gap-2">
                              <ZoomIn className="h-4 w-4" />
                              Tamanho da Logo
                            </Label>
                            <span className="text-sm font-mono text-muted-foreground">{logoSettings.scale}%</span>
                          </div>
                          <Slider
                            value={[logoSettings.scale]}
                            onValueChange={([val]) => handleLogoSettingChange("scale", val)}
                            min={50}
                            max={800}
                            step={10}
                          />
                        </div>

                        {/* Posição */}
                        <div className="space-y-2">
                          <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Alineamento Padrão</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={logoSettings.position === "left" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleLogoSettingChange("position", "left")}
                              className="flex-1"
                            >
                              <AlignLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant={logoSettings.position === "center" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleLogoSettingChange("position", "center")}
                              className="flex-1"
                            >
                              <AlignCenter className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant={logoSettings.position === "right" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleLogoSettingChange("position", "right")}
                              className="flex-1"
                            >
                              <AlignRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Arredondamento */}
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">Arredondamento do Fundo</Label>
                            <span className="text-sm font-mono text-muted-foreground">{logoSettings.border_radius}px</span>
                          </div>
                          <Slider
                            value={[logoSettings.border_radius]}
                            onValueChange={([val]) => handleLogoSettingChange("border_radius", val)}
                            min={0}
                            max={50}
                            step={2}
                          />
                        </div>

                        {/* Fundo da Logo */}
                        <div className="space-y-3 pt-3 border-t border-border/30">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider flex items-center gap-2">
                              <Palette className="h-4 w-4" />
                              Preenchimento do Fundo
                            </Label>
                            <Switch
                              checked={logoSettings.background_enabled}
                              onCheckedChange={(val) => handleLogoSettingChange("background_enabled", val)}
                            />
                          </div>

                          {logoSettings.background_enabled && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {LOGO_BACKGROUND_COLORS.map((color) => {
                                const isSelected = logoSettings.background_color === color.value;
                                const displayColor = color.value === "primary"
                                  ? formData.primary_color || "#111827"
                                  : color.value === "secondary"
                                    ? formData.secondary_color || "#D4AF37"
                                    : color.value === "transparent"
                                      ? "transparent"
                                      : color.value;

                                return (
                                  <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => handleLogoSettingChange("background_color", color.value)}
                                    className={`
                                      flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                      ${isSelected
                                        ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                                        : "bg-muted/50 hover:bg-muted text-muted-foreground"
                                      }
                                    `}
                                  >
                                    <div
                                      className="w-4 h-4 rounded-full border border-border/50"
                                      style={{
                                        backgroundColor: displayColor === "transparent" ? "transparent" : displayColor,
                                        backgroundImage: displayColor === "transparent"
                                          ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                                          : "none",
                                        backgroundSize: "8px 8px",
                                        backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px"
                                      }}
                                    />
                                    {color.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Assinatura Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
                  <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                  Assinatura do Responsável Técnico
                </h3>

                {/* Preview com fundo branco de simulação de papel */}
                <div
                  ref={signaturePreviewRef}
                  className={`bg-gradient-to-br from-white to-muted/30 border-2 border-dashed border-muted rounded-xl p-6 min-h-[200px] flex items-center justify-center relative ${canEdit ? 'cursor-ns-resize' : ''}`}
                  title={canEdit ? "Scroll para redimensionar" : undefined}
                >
                  {signatureUrl ? (
                    <img
                      src={signatureUrl}
                      alt="Assinatura Escaneada"
                      className="object-contain transition-all duration-150"
                      draggable={false}
                      style={{ maxHeight: `${signatureSettings.scale * 1.6}px` }}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground space-y-3 mx-auto">
                      <Scale className="h-12 w-12 mx-auto opacity-30" />
                      <p className="text-sm">Nenhuma assinatura digital anexada</p>
                      <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 text-left max-w-sm mx-auto">
                        <p className="font-medium mb-1">⚠️ Falta assinatura</p>
                        <p className="text-amber-600/80">Procurações e contratos gerados sairão sem a imagem da assinatura rubrica (exigido para total automatização).</p>
                      </div>
                    </div>
                  )}
                  {signatureUrl && canEdit && (
                    <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/60 bg-background/80 px-2 py-0.5 rounded">
                      Scroll p/ alterar proporção
                    </div>
                  )}
                </div>

                {/* Slider tamanho Assinatura */}
                {signatureUrl && canEdit && (
                  <div className="space-y-3 bg-muted/30 rounded-lg p-4 border border-border/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2 font-medium">
                        <ZoomIn className="h-3.5 w-3.5" />
                        Tamanho real em papel (A4)
                      </Label>
                      <span className="text-xs font-medium text-foreground/80 bg-background px-2 py-0.5 rounded border">
                        {signatureSettings.scale}%
                      </span>
                    </div>
                    <Slider
                      value={[signatureSettings.scale]}
                      onValueChange={(val) => setSignatureSettings(prev => ({ ...prev, scale: val[0] }))}
                      min={50}
                      max={200}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground/60">
                      <span>50%</span>
                      <span>100%</span>
                      <span>200%</span>
                    </div>
                  </div>
                )}

                {canEdit && (
                  <div className="flex gap-2">
                    <label className="cursor-pointer flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload("signature", file);
                        }}
                      />
                      <Button type="button" variant="outline" className="w-full gap-2" asChild>
                        <span>
                          <Upload className="h-4 w-4" />
                          {signatureUrl ? "Trocar Assinatura" : "Fazer Upload (.png/.jpg)"}
                        </span>
                      </Button>
                    </label>
                    {signatureUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleRemoveAsset("signature")}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            BOTTOM ACTIONS
        ═══════════════════════════════════════════════════════════════ */}
        {canEdit && (
          <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-6 pb-12 border-t border-border/40">
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className="w-full sm:w-auto gap-2 shadow-sm font-semibold"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Todas as Informações
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
