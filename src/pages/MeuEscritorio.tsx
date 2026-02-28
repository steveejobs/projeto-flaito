import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  MapPin,
  Scale,
  FileText,
  Mail,
  Phone,
  Trash2,
  Settings,
  Palette,
  Image,
  PenTool,
  Globe,
  Hash,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOfficeBranding } from '@/contexts/OfficeBrandingContext';
import { DEFAULT_BRANDING } from '@/lib/officeBranding';

export default function MeuEscritorio() {
  const navigate = useNavigate();
  
  const { branding, loading, refresh, getLogoUrl, getSignatureUrl } = useOfficeBranding();
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: healthRaw } = await supabase.rpc('lexos_healthcheck_session');
        const healthArr = healthRaw as Array<{ ok: boolean; role: string }> | null;
        const health = healthArr?.[0] ?? null;
        if (health?.ok && health.role) {
          setUserRole(health.role);
        }
      } catch {
        // Ignore errors
      }
    };
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (branding) {
      getLogoUrl().then((url) => setLogoUrl(url));
      getSignatureUrl().then((url) => setSignatureUrl(url));
    } else {
      setLogoUrl(null);
      setSignatureUrl(null);
    }
  }, [branding, getLogoUrl, getSignatureUrl]);

  const handleUploadAsset = async (
    file: File,
    kind: "logo" | "assinatura"
  ) => {
    if (!branding?.office_id) {
      toast.error("Escritório não identificado");
      return;
    }

    const fileName = kind === "logo" ? "logo.png" : "assinatura.png";
    const path = `${branding.office_id}/${fileName}`;
    const bucket = "office-branding";

    const isLogo = kind === "logo";
    isLogo ? setUploadingLogo(true) : setUploadingSignature(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: true,
          contentType: file.type || "image/png",
        });

      if (uploadError) throw uploadError;

      const updatePayload: Record<string, string> = {};
      if (isLogo) {
        updatePayload.logo_storage_bucket = bucket;
        updatePayload.logo_storage_path = path;
      } else {
        updatePayload.signature_storage_bucket = bucket;
        updatePayload.signature_storage_path = path;
      }

      const { error: updateError } = await supabase
        .from("offices")
        .update(updatePayload)
        .eq("id", branding.office_id);

      if (updateError) throw updateError;

      await refresh();

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      const cacheBustedUrl = `${publicUrlData?.publicUrl}?t=${Date.now()}`;
      if (isLogo) {
        setLogoUrl(cacheBustedUrl);
      } else {
        setSignatureUrl(cacheBustedUrl);
      }

      toast.success(isLogo ? "Logo atualizada com sucesso" : "Assinatura atualizada com sucesso");
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.warn("Erro ao enviar arquivo:", err);
      }
      toast.error(err?.message || "Erro ao enviar arquivo");
    } finally {
      isLogo ? setUploadingLogo(false) : setUploadingSignature(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadAsset(file, "logo");
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadAsset(file, "assinatura");
  };

  const handleRemoveAsset = async (kind: "logo" | "assinatura") => {
    if (!branding?.office_id) {
      toast.error("Escritório não identificado");
      return;
    }

    const isLogo = kind === "logo";
    isLogo ? setUploadingLogo(true) : setUploadingSignature(true);

    try {
      const updatePayload: Record<string, null> = {};
      if (isLogo) {
        updatePayload.logo_storage_bucket = null;
        updatePayload.logo_storage_path = null;
      } else {
        updatePayload.signature_storage_bucket = null;
        updatePayload.signature_storage_path = null;
      }

      const { error: updateError } = await supabase
        .from("offices")
        .update(updatePayload)
        .eq("id", branding.office_id);

      if (updateError) throw updateError;

      if (isLogo) {
        setLogoUrl(null);
      } else {
        setSignatureUrl(null);
      }

      toast.success(isLogo ? "Logo removida" : "Assinatura removida");
      await refresh();
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.warn("Erro ao remover:", err);
      }
      toast.error(err?.message || "Erro ao remover");
    } finally {
      isLogo ? setUploadingLogo(false) : setUploadingSignature(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      OWNER: 'Proprietário',
      ADMIN: 'Administrador',
      MEMBER: 'Membro',
    };
    return roles[role] || role;
  };

  const canEdit = userRole === 'OWNER' || userRole === 'ADMIN';
  const display = branding || DEFAULT_BRANDING;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-12 px-4 md:px-6">
      {/* Hero Section - Premium Institutional */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted/20 border border-border/60 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/[0.02] rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
        
        <div className="relative p-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {/* Main Row: Logo | Content | Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 md:gap-8">
            {/* Logo - Discrete Brand Seal */}
            <div className="flex-shrink-0 flex items-center gap-4 sm:block">
              {logoUrl ? (
                <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl bg-white shadow-md flex items-center justify-center p-2 border border-border/50">
                  <img
                    src={logoUrl}
                    alt="Logo do Escritório"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <Building2 className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-primary/40" />
                </div>
              )}
              
              {/* Mobile: Show name next to logo */}
              <div className="sm:hidden flex-1 min-w-0">
                <h1 className="text-xl font-bold text-foreground tracking-tight leading-tight line-clamp-2">
                  {display.nome_escritorio || 'Meu Escritório'}
                </h1>
                <p className="text-[10px] text-muted-foreground/60 font-medium tracking-widest uppercase mt-0.5">
                  Advocacia & Consultoria
                </p>
              </div>
            </div>

            {/* Central Content + Buttons together */}
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start gap-4">
              {/* Text Content */}
              <div className="min-w-0 flex-1">
                {/* Office Name - Desktop only (mobile shows above) */}
                <h1 className="hidden sm:block text-2xl md:text-3xl font-bold text-foreground tracking-tight leading-tight truncate">
                  {display.nome_escritorio || 'Meu Escritório'}
                </h1>
                
                {/* Subtitle - Desktop only */}
                <p className="hidden sm:block text-[11px] md:text-xs text-muted-foreground/60 font-medium tracking-widest uppercase mt-1">
                  Advocacia & Consultoria Jurídica
                </p>
                
                {/* Info Line: Location | OAB | Role */}
                <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 sm:mt-3 text-[11px] sm:text-xs text-muted-foreground">
                  {(display.cidade || display.estado) && (
                    <span className="flex items-center gap-1 sm:gap-1.5">
                      <MapPin className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-foreground/80 font-medium">
                        {display.cidade}{display.cidade && display.estado && ' – '}{display.estado}
                      </span>
                    </span>
                  )}
                  
                  {display.responsavel_oab && (
                    <span className="flex items-center gap-1 sm:gap-1.5">
                      <Scale className="h-3 w-3 text-primary/60" />
                      <span className="text-foreground/80 font-medium">
                        OAB {display.responsavel_oab}/{display.responsavel_oab_uf}
                      </span>
                    </span>
                  )}
                  
                  {userRole && (
                    <span className="flex items-center gap-1 sm:gap-1.5">
                      <User className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-muted-foreground/70">
                        {getRoleLabel(userRole)}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons - Desktop */}
              {canEdit && (
                <div className="hidden sm:flex flex-col gap-2 flex-shrink-0">
                  <Button 
                    onClick={() => navigate('/settings/office')} 
                    size="default"
                    className="gap-2 shadow-sm"
                  >
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Button>
                  <Button 
                    onClick={() => navigate('/settings/members')} 
                    variant="outline"
                    size="default"
                    className="gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Membros
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile Action Buttons */}
          {canEdit && (
            <div className="flex sm:hidden items-center gap-2 mt-4 pt-4 border-t border-border/40">
              <Button 
                onClick={() => navigate('/settings/office')} 
                size="sm"
                className="flex-1 gap-1.5 text-xs"
              >
                <Settings className="h-3.5 w-3.5" />
                Configurações
              </Button>
              <Button 
                onClick={() => navigate('/settings/members')} 
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
              >
                <Users className="h-3.5 w-3.5" />
                Membros
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Cards Grid - Improved mobile layout */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Identidade do Escritório */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground/90 uppercase tracking-wide">
              <div className="p-1.5 rounded-md bg-muted/80">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Identidade do Escritório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 divide-y divide-border/30">
            <InfoField label="Nome" value={display.nome_escritorio} />
            <div className="pt-4">
              <InfoField 
                label="Slug" 
                value={display.slug} 
                icon={<Globe className="h-3 w-3" />}
                mono 
              />
            </div>
            <div className="pt-4">
              <InfoField 
                label="CNPJ" 
                value={display.cnpj} 
                icon={<Hash className="h-3 w-3" />}
                mono 
              />
            </div>
          </CardContent>
        </Card>

        {/* Responsável Técnico - OAB Highlight */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground/90 uppercase tracking-wide">
              <div className="p-1.5 rounded-md bg-muted/80">
                <Scale className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Responsável Técnico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoField 
              label="Nome Completo" 
              value={display.responsavel_nome}
              icon={<User className="h-3 w-3" />}
            />
            
            {/* OAB Authority Credential */}
            {display.responsavel_oab && (
              <div className="mt-4 p-3 rounded-lg bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] border border-primary/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Scale className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">
                      Registro OAB
                    </p>
                    <p className="text-lg font-bold text-foreground tracking-tight">
                      {display.responsavel_oab}/{display.responsavel_oab_uf || '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {!display.responsavel_oab && (
              <InfoField 
                label="Registro OAB" 
                value={null}
                icon={<Scale className="h-3 w-3" />}
              />
            )}
          </CardContent>
        </Card>

        {/* Localização */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground/90 uppercase tracking-wide">
              <div className="p-1.5 rounded-md bg-muted/80">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 divide-y divide-border/30">
            <InfoField label="Endereço" value={display.endereco_completo} />
            <div className="pt-4">
              <InfoField 
                label="Cidade / UF" 
                value={display.cidade && display.estado 
                  ? `${display.cidade} - ${display.estado}` 
                  : display.cidade || display.estado
                } 
              />
            </div>
            <div className="pt-4">
              <InfoField label="CEP" value={display.cep} mono />
            </div>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground/90 uppercase tracking-wide">
              <div className="p-1.5 rounded-md bg-muted/80">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 divide-y divide-border/30">
            <InfoField 
              label="E-mail" 
              value={display.email}
              icon={<Mail className="h-3 w-3" />}
            />
            <div className="pt-4">
              <InfoField 
                label="Telefone" 
                value={display.telefone}
                icon={<Phone className="h-3 w-3" />}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cores do Tema - Enhanced with Preview */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground/90 uppercase tracking-wide">
              <div className="p-1.5 rounded-md bg-muted/80">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Cores do Tema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Color Swatches */}
            <div className="flex items-center gap-6">
              <ColorPreview 
                label="Primária" 
                color={(display.metadata as any)?.primary_color || '#111827'} 
              />
              <ColorPreview 
                label="Secundária" 
                color={(display.metadata as any)?.secondary_color || '#D4AF37'} 
              />
            </div>
            
            {/* Gradient Preview Bar */}
            <div className="h-2.5 rounded-full overflow-hidden flex shadow-inner border border-border/30">
              <div 
                className="flex-[2]"
                style={{ backgroundColor: (display.metadata as any)?.primary_color || '#111827' }}
              />
              <div 
                className="flex-1"
                style={{ backgroundColor: (display.metadata as any)?.secondary_color || '#D4AF37' }}
              />
            </div>
            
            {/* Application Preview */}
            <div className="pt-3 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-3">
                Prévia de Aplicação
              </p>
              <div className="flex gap-2">
                <div 
                  className="px-4 py-2 rounded-md text-xs font-medium text-white shadow-sm"
                  style={{ backgroundColor: (display.metadata as any)?.primary_color || '#111827' }}
                >
                  Botão Primário
                </div>
                <div 
                  className="px-4 py-2 rounded-md text-xs font-medium border shadow-sm bg-background"
                  style={{ 
                    borderColor: (display.metadata as any)?.secondary_color || '#D4AF37',
                    color: (display.metadata as any)?.secondary_color || '#D4AF37'
                  }}
                >
                  Secundário
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identidade Visual - Logo */}
        <Card className="shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground/90 uppercase tracking-wide">
              <div className="p-1.5 rounded-md bg-muted/80">
                <Image className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Identidade Visual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Preview */}
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Logo do Escritório</Label>
              <div className="relative group">
                <div className="aspect-video max-h-32 rounded-xl bg-muted/50 border-2 border-dashed border-border/50 flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo do escritório"
                      className="max-h-full max-w-full object-contain p-4"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Image className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <span className="text-xs text-muted-foreground">Sem logo</span>
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                    <Button asChild variant="secondary" size="sm" disabled={uploadingLogo}>
                      <label className="cursor-pointer">
                        {uploadingLogo ? "..." : logoUrl ? "Alterar" : "Enviar"}
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                      </label>
                    </Button>
                    {logoUrl && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={uploadingLogo}
                        onClick={() => handleRemoveAsset("logo")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Signature Preview */}
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Assinatura Digital</Label>
              <div className="relative group">
                <div className="h-24 rounded-xl bg-muted/50 border-2 border-dashed border-border/50 flex items-center justify-center overflow-hidden">
                  {signatureUrl ? (
                    <img
                      src={signatureUrl}
                      alt="Assinatura digital"
                      className="max-h-full max-w-full object-contain p-3"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <PenTool className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
                      <span className="text-xs text-muted-foreground">Sem assinatura</span>
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                    <Button asChild variant="secondary" size="sm" disabled={uploadingSignature}>
                      <label className="cursor-pointer">
                        {uploadingSignature ? "..." : signatureUrl ? "Alterar" : "Enviar"}
                        <input type="file" accept="image/*" className="hidden" onChange={handleSignatureChange} />
                      </label>
                    </Button>
                    {signatureUrl && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={uploadingSignature}
                        onClick={() => handleRemoveAsset("assinatura")}
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
      </div>

      {/* Cabeçalho Institucional - Full Width */}
      {display.header_block && (
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground/90 uppercase tracking-wide">
              <div className="p-1.5 rounded-md bg-muted/80">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Cabeçalho Institucional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white dark:bg-card rounded-xl border shadow-inner p-6 md:p-8">
              {/* Simulated Document Header */}
              <div className="max-w-2xl mx-auto">
                {logoUrl && (
                  <div className="flex justify-center mb-6">
                    <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
                  </div>
                )}
                <div 
                  className="text-center text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ fontFamily: 'Times New Roman, serif' }}
                >
                  {display.header_block}
                </div>
                <div className="mt-6 border-t border-border/30 pt-4 flex justify-center">
                  <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Prévia do cabeçalho utilizado em documentos e peças jurídicas
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper Components - Premium Styling
function InfoField({ 
  label, 
  value, 
  icon, 
  mono 
}: { 
  label: string; 
  value?: string | null; 
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-medium flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground/50">{icon}</span>}
        {label}
      </Label>
      <p className={`text-sm font-semibold text-foreground ${mono ? 'font-mono tracking-tight' : ''}`}>
        {value || <span className="text-muted-foreground/50 italic font-normal text-xs">Não informado</span>}
      </p>
    </div>
  );
}

function ColorPreview({ label, color }: { label: string; color: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-md border border-border/50 shadow-inner"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-mono text-muted-foreground/70 uppercase">
          {color}
        </span>
      </div>
    </div>
  );
}
