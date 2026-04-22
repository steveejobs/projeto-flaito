import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { 
  UserPlus, 
  Phone, 
  CreditCard, 
  Loader2, 
  Save, 
  Scan, 
  Link as LinkIcon, 
  Copy, 
  MessageSquare,
  ArrowLeft,
  ChevronRight,
  FileText,
  MapPin,
  PenTool,
  Rocket
} from 'lucide-react';

// Capture Components
import { CaptureDocumentScanStep, ScannedFile, ExtractedDocumentData } from '@/components/capture/CaptureDocumentScanStep';
import { CaptureDataStep, ClientType, PersonalData, PJData } from '@/components/capture/CaptureDataStep';
import { CaptureAddressStep, AddressData } from '@/components/capture/CaptureAddressStep';
import { CaptureSignatureStep } from '@/components/capture/CaptureSignatureStep';
import { StepTransition } from '@/components/capture/StepTransition';

interface FirstClientWizardProps {
  officeId: string;
  onComplete: () => void;
}

export const FirstClientWizard: React.FC<FirstClientWizardProps> = ({ officeId, onComplete }) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0); // 0: scan, 1: data, 2: address, 3: signature, 4: remote-signature-link
  
  // Data States
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [clientType, setClientType] = useState<ClientType>("PF");
  const [personalData, setPersonalData] = useState<PersonalData>({
    nome: "", cpf: "", rg: "", rg_emissor: "", data_nascimento: "", nacionalidade: "Brasileiro(a)", estado_civil: "", profissao: "", telefone: "", email: "",
  });
  const [pjData, setPJData] = useState<PJData>({
    cnpj: "", razao_social: "", nome_fantasia: "", telefone: "", email: "",
    representante_nome: "", representante_cpf: "", representante_rg: "", representante_rg_emissor: "",
    representante_data_nascimento: "", representante_nacionalidade: "Brasileiro(a)", representante_estado_civil: "", representante_profissao: "",
  });
  const [addressData, setAddressData] = useState<AddressData>({
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  });
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [officeSlug, setOfficeSlug] = useState("");

  // Fetch office slug
  React.useEffect(() => {
    const fetchOffice = async () => {
      if (!officeId) return;
      const { data } = await supabase
        .from('offices')
        .select('slug')
        .eq('id', officeId)
        .single();
      
      if (data?.slug) {
        setOfficeSlug(data.slug);
      }
    };
    fetchOffice();
  }, [officeId]);

  const handleExtractedData = (data: ExtractedDocumentData) => {
    setPersonalData((prev) => ({
      ...prev,
      nome: prev.nome || data.full_name || "",
      cpf: prev.cpf || data.cpf || "",
      rg: prev.rg || data.rg || "",
      rg_emissor: prev.rg_emissor || data.rg_issuer || "",
      data_nascimento: prev.data_nascimento || data.birth_date || "",
      nacionalidade: prev.nacionalidade || data.nationality || "Brasileiro(a)",
      estado_civil: prev.estado_civil || data.marital_status || "",
      profissao: prev.profissao || data.profession || "",
    }));

    if (data.cep || data.address_line) {
      setAddressData((prev) => ({
        ...prev,
        cep: prev.cep || data.cep || "",
        logradouro: prev.logradouro || data.address_line || "",
        bairro: prev.bairro || data.neighborhood || "",
        cidade: prev.cidade || data.city || "",
        uf: prev.uf || data.state || "",
      }));
    }

    toast.success("Dados extraídos com sucesso! Avançando...");
    
    // Avanço automático após conferência visual
    setTimeout(() => {
      setStep(1);
    }, 1500);
  };

  const handleSave = async (isRemoteSignature = false) => {
    const nome = clientType === "PF" ? personalData.nome : pjData.razao_social;
    const identifier = clientType === "PF" ? personalData.cpf : pjData.cnpj;
    const telefone = clientType === "PF" ? personalData.telefone : pjData.telefone;

    if (!nome) {
      toast.error('O nome do cliente é obrigatório');
      return;
    }
    if (!identifier) {
      toast.error('O CPF/CNPJ é obrigatório');
      return;
    }

    setSaving(true);
    try {
      // 1. Criar o cliente com dados completos
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          office_id: officeId,
          full_name: nome,
          cpf: clientType === "PF" ? identifier.replace(/\D/g, "") : null,
          phone: telefone ? telefone.replace(/\D/g, "") : null,
          email: personalData.email || pjData.email || null,
          created_by: user?.id,
          status: 'active',
          metadata: {
            client_type: clientType,
            personal: clientType === "PF" ? personalData : undefined,
            pj: clientType === "PJ" ? pjData : undefined,
            address: addressData,
            has_signature: isRemoteSignature ? false : !!signatureDataUrl,
            signature_method: isRemoteSignature ? 'remote' : 'presential'
          }
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // 2. Marcar step como completo no onboarding
      const { error: onboardingError } = await supabase
        .rpc('complete_onboarding_step', { p_step: 'first_client' });

      if (onboardingError) {
        console.warn('Could not mark step as complete:', onboardingError);
      }

      if (isRemoteSignature) {
        setStep(4); // Show remote signature sharing screen
      } else {
        toast.success('Primeiro cliente cadastrado com sucesso!');
        onComplete();
      }
    } catch (err: any) {
      console.error('Error saving client:', err);
      let msg = 'Erro ao cadastrar cliente';
      if (err.message?.includes('ux_clients_office_cpf')) {
        msg = 'Já existe um cliente com este CPF neste escritório';
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    const link = `https://app.flaito.com/captacao/${officeSlug}`;
    navigator.clipboard.writeText(link);
    toast.success("Link de assinatura copiado!");
  };

  const shareWhatsApp = () => {
    const link = `https://app.flaito.com/captacao/${officeSlug}`;
    const text = encodeURIComponent(`Olá! Por favor, realize a assinatura digital do seu cadastro através deste link seguro: ${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Final Remote Signature Link Screen
  if (step === 4) {
    return (
      <div className="space-y-6 py-4">
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex p-3 rounded-full bg-blue-500/10 text-blue-400 mb-4 animate-bounce">
            <Rocket className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Quase tudo pronto!</h2>
          <p className="text-slate-400 text-sm px-8">Dados salvos com sucesso. Agora envie o link abaixo para o cliente assinar de onde ele estiver.</p>
        </div>

        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 uppercase tracking-widest font-bold ml-1">Link de Assinatura</Label>
            <div 
              className="bg-black/40 border border-white/5 p-4 rounded-xl break-all font-mono text-sm text-blue-400 text-center select-all cursor-pointer hover:bg-black/60 transition-colors"
              onClick={copyLink}
            >
              {`https://app.flaito.com/captacao/${officeSlug}`}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button onClick={copyLink} className="bg-slate-800 hover:bg-slate-700 text-white gap-2 h-12 rounded-xl border border-white/10 transition-transform active:scale-95">
              <Copy className="h-4 w-4" />
              Copiar Link
            </Button>
            <Button onClick={shareWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-3 h-12 rounded-xl shadow-lg shadow-emerald-500/20 transition-transform active:scale-95">
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </div>

        <div className="text-center pt-8">
          <Button 
            onClick={onComplete}
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 h-12 rounded-xl font-bold transition-all hover:px-14 active:scale-95 shadow-xl shadow-blue-500/20"
          >
            Finalizar e Explorar Painel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          {step === 0 && <><Scan className="h-5 w-5 text-blue-400" /> Documentos do Cliente</>}
          {step === 1 && <><FileText className="h-5 w-5 text-blue-400" /> Dados Pessoais</>}
          {step === 2 && <><MapPin className="h-5 w-5 text-blue-400" /> Endereço</>}
          {step === 3 && <><PenTool className="h-5 w-5 text-blue-400" /> Assinatura</>}
        </h2>
        
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 w-8 rounded-full transition-all duration-500 ${step === i ? 'bg-blue-500 ring-4 ring-blue-500/10 scale-110' : 'bg-slate-800'}`} />
          ))}
        </div>
      </div>

      <div className="relative min-h-[450px]">
        <StepTransition show={step === 0}>
           <div className="space-y-6">
              <CaptureDocumentScanStep
                files={files}
                onFilesChange={setFiles}
                onContinue={() => setStep(1)}
                onBack={() => {}}
                onExtractedData={handleExtractedData}
              />
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center text-xs font-medium">
                  <span className="bg-slate-950 px-4 text-slate-500 uppercase tracking-widest">Ou comece do zero</span>
                </div>
              </div>

              <div className="text-center">
                <Button 
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="text-white/60 hover:text-white text-sm h-10 px-6 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Pular e preencher manualmente
                </Button>
              </div>
           </div>
        </StepTransition>

        <StepTransition show={step === 1}>
          <CaptureDataStep
            clientType={clientType}
            onClientTypeChange={setClientType}
            personalData={personalData}
            onPersonalDataChange={setPersonalData}
            pjData={pjData}
            onPJDataChange={setPJData}
            onContinue={() => setStep(2)}
            onBack={() => setStep(0)}
            files={files}
            onFilesChange={setFiles}
          />
        </StepTransition>

        <StepTransition show={step === 2}>
          <CaptureAddressStep
            addressData={addressData}
            onAddressDataChange={setAddressData}
            onContinue={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        </StepTransition>

        <StepTransition show={step === 3}>
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-1 overflow-hidden">
              <CaptureSignatureStep
                signatureDataUrl={signatureDataUrl}
                onSignatureChange={setSignatureDataUrl}
                lgpdAccepted={lgpdAccepted}
                onLgpdChange={setLgpdAccepted}
                onSubmit={() => handleSave(false)}
                onBack={() => setStep(2)}
                submitting={saving}
              />
            </div>
            
          </div>
        </StepTransition>
      </div>
    </div>
  );
};
