import { useState } from "react";
import { cn } from "@/lib/utils";
import { useInstitutionalConfig } from "@/hooks/useInstitutionalConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, ArrowRight, ArrowLeft, Upload, Building2, UserCircle, Rocket, Image as ImageIcon, PenLine, Eraser, Maximize2, Minimize2, Signature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SignatureCanvas, SignatureCanvasApi } from "@/components/SignatureCanvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface WizardProps {
  officeId: string;
  onComplete: () => void;
}

export function SimpleConfigWizard({ officeId, onComplete }: WizardProps) {
  const [step, setStep] = useState(1);
  const { mutations, isLoading: isSaving } = useInstitutionalConfig(officeId);
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [signatureApi, setSignatureApi] = useState<SignatureCanvasApi | null>(null);

  // Form State
  const initialModule = user?.user_metadata?.main_module === 'MEDICO' ? 'CRM' : 'OAB';
  const initialName = user?.user_metadata?.full_name || "";

  const [profData, setProfData] = useState({
    name: initialName,
    identType: initialModule as "OAB" | "CRM",
    identNumber: "",
    identUf: "",
    signatureUrl: "",
  });

  const [brandingData, setBrandingData] = useState({
    logoUrl: "",
    watermarkUrl: "",
    watermarkEnabled: true,
    watermarkOpacity: 0.2,
  });

  const [unitData, setUnitData] = useState({
    name: "Vale do Silício",
    address: "",
    city: "",
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'signatures' | 'logos' | 'watermarks') => {
    const file = e.target.files?.[0];
    if (!file || !officeId) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB.");
      return;
    }

    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}_${Date.now()}.${fileExt}`;
      const path = `${officeId}/${type}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("office-branding")
        .upload(path, file, { 
          cacheControl: '3600',
          upsert: true 
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("office-branding").getPublicUrl(path);
      
      if (type === 'signatures') {
        setProfData(prev => ({ ...prev, signatureUrl: data.publicUrl }));
        toast.success("Assinatura carregada com sucesso.");
      } else if (type === 'logos') {
        setBrandingData(prev => ({ ...prev, logoUrl: data.publicUrl }));
        toast.success("Logotipo carregado com sucesso.");
      } else if (type === 'watermarks') {
        setBrandingData(prev => ({ ...prev, watermarkUrl: data.publicUrl }));
        toast.success("Marca d'água carregada com sucesso.");
      }
    } catch (error: any) {
      console.error("[Wizard] Falha no upload:", error);
      toast.error(`Falha no Upload: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveDrawnSignature = async () => {
    if (!signatureApi || signatureApi.isEmpty()) {
      toast.error("Por favor, faça sua assinatura antes de confirmar.");
      return;
    }

    setIsUploading(true);
    try {
      const dataUrl = signatureApi.getDataUrl();
      const parts = dataUrl.split(',');
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while(n--){
          u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: 'image/png' });
      const file = new File([blob], "signature.png", { type: 'image/png' });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");

      const fileName = `${session.user.id}_${Date.now()}.png`;
      const path = `${officeId}/signatures/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("office-branding")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("office-branding").getPublicUrl(path);
      
      setProfData(prev => ({ ...prev, signatureUrl: data.publicUrl }));
      toast.success("Assinatura salva com sucesso!");
      setShowSignatureModal(false);
    } catch (error: any) {
      console.error(error);
      toast.error(`Falha ao salvar assinatura: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const isNextDisabled = () => {
    if (isUploading) return true;
    if (step === 1) {
      return !profData.name?.trim() || !profData.identNumber?.trim() || (profData.identUf?.length || 0) < 2;
    }
    if (step === 2) return !brandingData.logoUrl;
    if (step === 4) return !profData.signatureUrl;
    if (step === 5) return !unitData.name.trim() || !unitData.address.trim() || isSaving;
    return false;
  };

  const handleFinish = async (directData?: any) => {
    const currentData = directData || profData;
    console.log("[SimpleConfigWizard] Iniciando salvamento final...", { currentData, brandingData, unitData });
    
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        console.error("[SimpleConfigWizard] Sem usuário na sessão");
        throw new Error("Usuário não encontrado");
      }

      // 1. Sincronizar nome no escritório
      if (officeId) {
        console.log("[SimpleConfigWizard] Atualizando nome do membro em office_members...");
        const { error: memberError } = await supabase
          .from('office_members')
          .update({ full_name: currentData.name })
          .eq('office_id', officeId)
          .eq('user_id', authUser.id);
        
        if (memberError) {
          console.error("[SimpleConfigWizard] Erro em office_members:", memberError);
          throw memberError;
        }
      }

      // 2. Salvar Branding (Logo e Marca d'água)
      console.log("[SimpleConfigWizard] Invocando mutação de branding...");
      await mutations.updateOffice.mutateAsync({
        branding: {
          logoPrimaryUrl: brandingData.logoUrl,
          watermark: {
            enabled: !!(brandingData.watermarkUrl || brandingData.logoUrl),
            imageUrl: brandingData.watermarkUrl,
            opacity: brandingData.watermarkOpacity,
            position: 'center',
            size: 'md'
          }
        }
      });

      // 3. Salvar Configurações Profissionais
      console.log("[SimpleConfigWizard] Invocando mutação de configurações profissionais...");
      await mutations.updateProfessionalSettings.mutateAsync({
        name: currentData.name,
        identType: currentData.identType,
        identNumber: currentData.identNumber,
        identUf: currentData.identUf,
        signatures: [{
          role: "Profissional",
          label: currentData.name,
          signatureUrl: currentData.signatureUrl
        }]
      });

      // 4. Salvar Unidade
      console.log("[SimpleConfigWizard] Invocando mutação de unidade...");
      await mutations.upsertUnit.mutateAsync({
        name: unitData.name,
        address_line: unitData.address,
        city: unitData.city,
        is_default: true,
        is_active: true
      });

      // 5. Concluir etapa no onboarding
      console.log("[SimpleConfigWizard] Chamando RPC: complete_onboarding_step para institutional_config");
      const { error: rpcError } = await supabase.rpc('complete_onboarding_step', { p_step: 'institutional_config' });
      
      if (rpcError) {
        console.error("[SimpleConfigWizard] Erro na RPC de onboarding:", rpcError);
        throw rpcError;
      }

      console.log("[SimpleConfigWizard] Sucesso! Chamando onComplete.");
      toast.success("Configurações salvas com sucesso!");
      setTimeout(() => onComplete(), 600);
    } catch (error: any) {
      console.error("[SimpleConfigWizard] Erro fatal no handleFinish:", error);
      let errorMessage = "Ocorreu um problema ao salvar suas configurações.";
      
      if (error.message?.includes("profile_professional_settings_user_id_office_id_key")) {
        errorMessage = "Você já possui uma configuração salva para este escritório. Tentamos atualizar, mas houve um conflito.";
      } else if (error.message === "New row violates row level security policy") {
        errorMessage = "Erro de permissão no banco de dados. Por favor, contate o suporte.";
      } else if (error.message) {
        errorMessage = `Erro: ${error.message}`;
      }

      toast.error(errorMessage);
    }
  };

  return (
    <>
      <Card className="w-full max-w-xl mx-auto shadow-2xl border-white/5 bg-slate-950">
        <CardHeader className="border-b border-white/5 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div 
                  key={s} 
                  className={`h-1.5 w-8 rounded-full transition-all duration-500 ${s <= step ? 'bg-blue-500' : 'bg-slate-800'}`} 
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Passo {step} de 5</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
            {step === 1 && <UserCircle className="text-blue-500" />}
            {step === 2 && <Building2 className="text-blue-500" />}
            {step === 3 && <ImageIcon className="text-blue-500" />}
            {step === 4 && <Signature className="text-blue-500" />}
            {step === 5 && <Rocket className="text-blue-500" />}
            {step === 1 && "Seu Perfil Profissional"}
            {step === 2 && "Logotipo do Escritório"}
            {step === 3 && "Marca d'água dos Documentos"}
            {step === 4 && "Sua Assinatura Digital"}
            {step === 5 && "Local de Atendimento"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {step === 1 && "Como seu nome e registro sairão nos documentos."}
            {step === 2 && (profData.identType === 'OAB' ? "A imagem principal do seu escritório." : "A imagem principal da sua unidade/clínica.")}
            {step === 3 && "A imagem de fundo que valida a autenticidade das peças."}
            {step === 4 && "A imagem da sua assinatura para firmar peças e documentos."}
            {step === 5 && (profData.identType === 'OAB' ? "Endereço principal do seu escritório." : "Endereço principal da sua unidade ou clínica.")}
          </CardDescription>
        </CardHeader>

        <CardContent className="py-8 min-h-[300px] flex flex-col">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Nome Completo</Label>
                <Input 
                  value={profData.name} 
                  onChange={e => setProfData({...profData, name: e.target.value})}
                  placeholder="Ex: Elon Musk"
                  className="bg-slate-900 border-white/10 text-white h-12"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Conselho</Label>
                  <Select value={profData.identType} onValueChange={v => setProfData({...profData, identType: v as any})}>
                    <SelectTrigger className="bg-slate-900 border-white/10 text-white h-12"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="OAB">OAB</SelectItem>
                      <SelectItem value="CRM">CRM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-slate-300">Número do Registro</Label>
                  <Input 
                    value={profData.identNumber} 
                    onChange={e => setProfData({...profData, identNumber: e.target.value})}
                    placeholder="12345"
                    className="bg-slate-900 border-white/10 text-white h-12"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">UF do Registro</Label>
                <Input 
                  value={profData.identUf} 
                  onChange={e => setProfData({...profData, identUf: e.target.value.toUpperCase()})}
                  maxLength={2}
                  placeholder="SP"
                  className="bg-slate-900 border-white/10 text-white h-12 w-24"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 text-center">
              <div className="mx-auto w-40 h-24 bg-slate-900 border-2 border-dashed border-blue-500/20 rounded-2xl flex items-center justify-center overflow-hidden group hover:border-blue-500/40 transition-all">
                {brandingData.logoUrl ? (
                  <img src={brandingData.logoUrl} className="max-h-full p-4 object-contain" alt="Logo preview" />
                ) : (
                  <Building2 className="h-10 w-10 text-slate-700" />
                )}
              </div>
              <div className="space-y-4">
                <Label className="text-white block">
                  {profData.identType === 'OAB' ? "Logotipo do Escritório" : "Logotipo da Unidade/Clínica"} (PNG/JPG)
                </Label>
                <div className="flex justify-center">
                  <label className="cursor-pointer">
                    <Input type="file" className="hidden" onChange={e => handleFileUpload(e, 'logos')} accept="image/*" />
                    <Button variant="secondary" asChild className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20">
                      <span className="flex items-center gap-2">
                        {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                        {brandingData.logoUrl ? "Trocar Logotipo" : "Selecionar Logotipo"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-48 h-32 bg-white rounded-lg shadow-2xl flex items-center justify-center overflow-hidden border border-white/20">
                  {(brandingData.watermarkUrl || brandingData.logoUrl) ? (
                    <img 
                      src={brandingData.watermarkUrl || brandingData.logoUrl} 
                      className="max-h-full p-4 object-contain transition-opacity duration-200" 
                      style={{ opacity: brandingData.watermarkOpacity }}
                      alt="Watermark preview" 
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-300">
                      <ImageIcon className="h-8 w-8 opacity-20" />
                      <span className="text-[10px] font-medium">Sem imagem</span>
                    </div>
                  )}
                  
                  {!brandingData.watermarkUrl && brandingData.logoUrl && (
                    <div className="absolute bottom-1 right-2">
                      <span className="text-[8px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter">Usando Logo</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Pré-visualização do Documento</p>
              </div>
              <div className="space-y-6 max-w-sm mx-auto">
                <div className="space-y-2">
                  <Label className="text-white block">Imagem Diferente para Marca d'água? (Opcional)</Label>
                  <div className="flex justify-center">
                    <label className="cursor-pointer">
                      <Input type="file" className="hidden" onChange={e => handleFileUpload(e, 'watermarks')} accept="image/*" />
                      <Button variant="outline" asChild className="border-white/10 hover:bg-white/5">
                        <span className="flex items-center gap-2">
                          <Upload className="h-4 w-4" /> Subir Imagem de Fundo
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-xs text-slate-400">Opacidade nos Documentos</Label>
                    <span className="text-xs font-mono text-blue-400 font-bold">{Math.round(brandingData.watermarkOpacity * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.05" max="0.4" step="0.05"
                    value={brandingData.watermarkOpacity}
                    onChange={e => setBrandingData({...brandingData, watermarkOpacity: parseFloat(e.target.value)})}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 text-center">
              <div className="mx-auto w-full max-w-sm h-40 bg-white/5 rounded-2xl border border-white/10 relative overflow-hidden flex items-center justify-center p-6 group transition-all duration-500 hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10">
                <div className="absolute top-2 right-2 z-20">
                  {profData.signatureUrl ? (
                     <div className="bg-emerald-500 p-1 rounded-full shadow-lg animate-in zoom-in-50">
                       <Check className="h-3 w-3 text-white" />
                     </div>
                  ) : (
                     <div className="bg-slate-800 p-1 rounded-full opacity-50">
                       <Signature className="h-3 w-3 text-slate-400" />
                     </div>
                  )}
                </div>
                
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none flex items-center justify-center">
                   <Signature className="w-32 h-32" />
                </div>

                {profData.signatureUrl ? (
                  <div className="bg-white rounded-lg p-2 shadow-xl translate-y-1 transform group-hover:translate-y-0 transition-transform duration-500 relative z-10 w-full max-w-[320px] mx-auto">
                    <img 
                      src={profData.signatureUrl} 
                      className="w-full h-auto object-contain block" 
                      alt="Signature preview" 
                      style={{ aspectRatio: '3.2 / 1' }}
                    />
                  </div>
                ) : (
                  <div className="text-center space-y-2 opacity-30">
                    <PenLine className="h-10 w-10 mx-auto text-slate-400" />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Aguardando Assinatura</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <Label className="text-white block">Sua Assinatura Profissional</Label>
                <div className="flex flex-col items-center gap-4">
                  <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                    <label className="cursor-pointer">
                      <Input type="file" className="hidden" onChange={e => handleFileUpload(e, 'signatures')} accept="image/*" />
                      <Button variant="secondary" asChild className="h-12 w-full sm:w-auto px-6 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl border border-white/5 shadow-lg">
                        <span className="flex items-center justify-center gap-2">
                          <Upload className="h-4 w-4" /> Subir Arquivo
                        </span>
                      </Button>
                    </label>
                    
                    <Button 
                      variant="secondary" 
                      onClick={() => setShowSignatureModal(true)}
                      className="h-12 w-full sm:w-auto px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20"
                    >
                      <PenLine className="h-4 w-4 mr-2" /> Assinar na Tela
                    </Button>
                  </div>
                  
                  {profData.signatureUrl && (
                    <p className="text-[10px] text-green-500 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Assinatura pronta para os documentos
                    </p>
                  )}
                </div>
              </div>

              <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
                <DialogContent className={cn(
                  "bg-slate-950 border-white/10 p-0 overflow-hidden transition-all duration-300",
                  isExpanded ? "w-screen h-screen max-w-none m-0 rounded-none flex flex-col" : "max-w-[95vw] sm:max-w-[700px]"
                )}>
                  <DialogHeader className="p-6 pb-2 border-b border-white/5 flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-white flex items-center gap-2">
                      <PenLine className="h-5 w-5 text-blue-500" />
                      Desenhe sua Assinatura
                    </DialogTitle>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="h-8 w-8 text-slate-400 hover:text-white"
                    >
                      {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </DialogHeader>
                  
                  <div className={cn(
                    "p-6 bg-slate-900/50",
                    isExpanded ? "flex-1 flex flex-col" : ""
                  )}>
                    <div className={cn(
                      "bg-white rounded-xl overflow-hidden shadow-inner",
                      isExpanded ? "flex-1" : ""
                    )}>
                      <SignatureCanvas 
                        onReady={setSignatureApi}
                        height={isExpanded ? undefined : 300}
                        className="w-full h-full min-h-[300px]"
                      />
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <p className="text-xs text-slate-500 italic">Dica: Use o mouse ou o dedo para assinar no campo branco.</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => signatureApi?.clear()}
                        className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 gap-2"
                      >
                        <Eraser className="h-4 w-4" /> Limpar Campo
                      </Button>
                    </div>
                  </div>

                  <DialogFooter className="p-6 pt-2 border-t border-white/5 bg-slate-950/80">
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowSignatureModal(false)}
                      className="text-slate-400"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleSaveDrawnSignature}
                      disabled={isUploading}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-8 font-bold"
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      Confirmar Assinatura
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-2">
                <Label className="text-slate-300">
                  {profData.identType === 'OAB' ? "Nome do Escritório" : "Nome da Unidade/Clínica"}
                </Label>
                <Input 
                  value={unitData.name} 
                  onChange={e => setUnitData({...unitData, name: e.target.value})}
                  placeholder={profData.identType === 'OAB' ? "Ex: Silva & Associados" : "Ex: Unidade Principal"}
                  className="bg-slate-900 border-white/10 text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Endereço Completo</Label>
                <Input 
                  value={unitData.address} 
                  onChange={e => setUnitData({...unitData, address: e.target.value})}
                  placeholder="Rua Exemplo, 123 - Sala 45"
                  className="bg-slate-900 border-white/10 text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Cidade</Label>
                <Input 
                  value={unitData.city} 
                  onChange={e => setUnitData({...unitData, city: e.target.value})}
                  placeholder="São Paulo"
                  className="bg-slate-900 border-white/10 text-white h-12"
                />
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t border-white/5 pt-6 pb-6">
          <Button 
            variant="ghost" 
            onClick={() => setStep(s => s - 1)} 
            disabled={step === 1 || isUploading}
            className="text-slate-400 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
          </Button>

          {step < 5 ? (
            <Button 
              onClick={() => setStep(s => s + 1)}
              disabled={isNextDisabled()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
            >
              Próximo Passo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={() => handleFinish()}
              disabled={isNextDisabled()}
              className="bg-green-600 hover:bg-green-500 text-white px-8 rounded-xl font-bold shadow-lg shadow-green-600/20"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Concluir Configuração
            </Button>
          )}
        </CardFooter>
      </Card>
    </>
  );
}
