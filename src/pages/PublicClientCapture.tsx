import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

const SUPABASE_FUNCTIONS_BASE = "https://uxrakfbedmkiqhidruxx.supabase.co/functions/v1";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cmFrZmJlZG1raXFoaWRydXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2Nzc0NDksImV4cCI6MjA4MTI1MzQ0OX0.urYN1qLC5O_NHuiLamFEGTmjkskrOu6bldycZmOX-bo";
const PUBLIC_CAPTURE_FN_URL = `${SUPABASE_FUNCTIONS_BASE}/public-client-registration`;

import { CaptureShell } from "@/components/capture/CaptureShell";
import { CaptureStepIndicator } from "@/components/capture/CaptureStepIndicator";
import { StepTransition } from "@/components/capture/StepTransition";
import { CaptureEntryModeStep, EntryMode } from "@/components/capture/CaptureEntryModeStep";
import { CaptureDocumentScanStep, ScannedFile, ExtractedDocumentData } from "@/components/capture/CaptureDocumentScanStep";
import { CaptureDataStep, ClientType, PersonalData, PJData } from "@/components/capture/CaptureDataStep";
import { CaptureAddressStep, AddressData } from "@/components/capture/CaptureAddressStep";
import { CaptureSignatureStep } from "@/components/capture/CaptureSignatureStep";
import { CaptureSuccessScreen } from "@/components/capture/CaptureSuccessScreen";

interface OfficeBranding {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

const STEPS = [
  { key: "mode", label: "Modo" },
  { key: "data", label: "Dados" },
  { key: "address", label: "Endereço" },
  { key: "signature", label: "Assinatura" },
];

export default function PublicClientCapture() {
  const { officeSlug } = useParams<{ officeSlug: string }>();

  const [loading, setLoading] = useState(true);
  const [office, setOffice] = useState<OfficeBranding | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [showScan, setShowScan] = useState(false);
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [aiExtracted, setAiExtracted] = useState(false);

  const [clientType, setClientType] = useState<ClientType>("PF");
  const [personalData, setPersonalData] = useState<PersonalData>({
    nome: "", cpf: "", rg: "", rg_emissor: "", nacionalidade: "Brasileiro(a)", estado_civil: "", profissao: "", telefone: "", email: "",
  });
  const [pjData, setPJData] = useState<PJData>({
    cnpj: "", razao_social: "", nome_fantasia: "", telefone: "", email: "",
    representante_nome: "", representante_cpf: "", representante_rg: "", representante_rg_emissor: "",
    representante_nacionalidade: "Brasileiro(a)", representante_estado_civil: "", representante_profissao: "",
  });
  const [addressData, setAddressData] = useState<AddressData>({
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  });

  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [success, setSuccess] = useState(false);
  const [displayId, setDisplayId] = useState("");

  // Fetch office branding
  useEffect(() => {
    if (!officeSlug || officeSlug.startsWith(":")) {
      setError("Link inválido. Use /captacao/{slug-do-escritório}.");
      setLoading(false);
      return;
    }

    const fetchOffice = async () => {
      try {
        const response = await fetch(
          `${PUBLIC_CAPTURE_FN_URL}?officeSlug=${encodeURIComponent(officeSlug)}`,
          {
            method: "GET",
            headers: {
              apikey: SUPABASE_ANON_KEY,
            },
          }
        );

        const result = await response.json();

        if (!response.ok || !result.ok) {
          const errorMsg =
            result?.error === "office_not_found"
              ? "Escritório não encontrado"
              : result?.error || "Erro ao carregar dados do escritório";
          setError(errorMsg);
          setLoading(false);
          return;
        }

        setOffice(result.office);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching office:", err);
        setError("Erro ao carregar dados do escritório");
        setLoading(false);
      }
    };

    fetchOffice();
  }, [officeSlug]);

  const handleModeSelect = (mode: EntryMode) => {
    setEntryMode(mode);
    if (mode === "SCAN") {
      setShowScan(true);
    } else {
      setStep(1);
    }
  };

  const handleExtractedData = (data: ExtractedDocumentData) => {
    // Mark as AI extracted
    setAiExtracted(true);
    
    // Parse address_line to extract street and number
    let logradouro = data.address_line || "";
    let numero = "";
    
    if (logradouro) {
      // Try to extract number from end of address line (e.g., "Rua ABC, 123" or "Rua ABC 123")
      const match = logradouro.match(/[,\s]+(\d+[A-Za-z]?)$/);
      if (match) {
        numero = match[1];
        logradouro = logradouro.replace(/[,\s]+\d+[A-Za-z]?$/, "").trim();
      }
    }

    // Update personal data (only fill empty fields)
    setPersonalData((prev) => ({
      ...prev,
      nome: prev.nome || data.full_name || "",
      cpf: prev.cpf || data.cpf || "",
      rg: prev.rg || data.rg || "",
      rg_emissor: prev.rg_emissor || data.rg_issuer || "",
      nacionalidade: prev.nacionalidade || data.nationality || "Brasileiro(a)",
      estado_civil: prev.estado_civil || data.marital_status || "",
      profissao: prev.profissao || data.profession || "",
    }));

    // Update address data (only fill empty fields)
    setAddressData((prev) => ({
      ...prev,
      cep: prev.cep || data.cep || "",
      logradouro: prev.logradouro || logradouro,
      numero: prev.numero || numero,
      bairro: prev.bairro || data.neighborhood || "",
      cidade: prev.cidade || data.city || "",
      uf: prev.uf || data.state || "",
    }));
  };

  const handleScanContinue = () => {
    setShowScan(false);
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!office || !signatureDataUrl || !lgpdAccepted) return;

    setSubmitting(true);

    try {
      const payload = {
        officeSlug,
        entryMode: entryMode || "MANUAL",
        clientType,
        personal:
          clientType === "PF"
            ? personalData
            : {
                nome: pjData.razao_social,
                cpf: "",
                rg: "",
                rg_emissor: "",
                nacionalidade: "",
                estado_civil: "",
                profissao: "",
                telefone: pjData.telefone,
                email: pjData.email,
              },
        pj: clientType === "PJ" ? {
          cnpj: pjData.cnpj,
          razao_social: pjData.razao_social,
          nome_fantasia: pjData.nome_fantasia,
          telefone: pjData.telefone,
          email: pjData.email,
          representative: {
            nome: pjData.representante_nome,
            cpf: pjData.representante_cpf,
            rg: pjData.representante_rg,
            rg_emissor: pjData.representante_rg_emissor,
            nacionalidade: pjData.representante_nacionalidade,
            estado_civil: pjData.representante_estado_civil,
            profissao: pjData.representante_profissao,
          },
        } : undefined,
        address: addressData,
        signature: { dataUrlPng: signatureDataUrl },
        files: files.length > 0 ? files : undefined,
        lgpdAccepted: true,
        hp: "",
        aiExtracted: aiExtracted,
      };

      const response = await fetch(PUBLIC_CAPTURE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || "Erro ao cadastrar");
      }

      setDisplayId(result.display_id || result.client_id);
      setSuccess(true);
      toast.success("Cliente cadastrado com sucesso!");
    } catch (err: unknown) {
      console.error("Submit error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar cliente");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(0);
    setEntryMode(null);
    setShowScan(false);
    setFiles([]);
    setClientType("PF");
    setPersonalData({ nome: "", cpf: "", rg: "", rg_emissor: "", nacionalidade: "Brasileiro(a)", estado_civil: "", profissao: "", telefone: "", email: "" });
    setPJData({ 
      cnpj: "", razao_social: "", nome_fantasia: "", telefone: "", email: "",
      representante_nome: "", representante_cpf: "", representante_rg: "", representante_rg_emissor: "",
      representante_nacionalidade: "Brasileiro(a)", representante_estado_civil: "", representante_profissao: "",
    });
    setAddressData({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });
    setSignatureDataUrl(null);
    setLgpdAccepted(false);
    setSuccess(false);
    setDisplayId("");
    setAiExtracted(false);
  };

  if (error) {
    return (
      <CaptureShell office={null} loading={false}>
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-sm text-white/50">Verifique o link e tente novamente</p>
        </div>
      </CaptureShell>
    );
  }

  if (success) {
    return (
      <CaptureShell office={office} loading={false}>
        <CaptureSuccessScreen
          displayId={displayId}
          officeName={office?.name}
          onNewClient={resetForm}
        />
      </CaptureShell>
    );
  }

  return (
    <CaptureShell office={office} loading={loading}>
      {!loading && (
        <>
          {step > 0 && !showScan && (
            <CaptureStepIndicator steps={STEPS} currentStep={step} />
          )}

          <div className="relative">
            <StepTransition show={step === 0 && !showScan}>
              <CaptureEntryModeStep onSelect={handleModeSelect} />
            </StepTransition>

            <StepTransition show={showScan}>
              <CaptureDocumentScanStep
                files={files}
                onFilesChange={setFiles}
                onContinue={handleScanContinue}
                onBack={() => { setShowScan(false); setEntryMode(null); }}
                onExtractedData={handleExtractedData}
              />
            </StepTransition>

            <StepTransition show={step === 1 && !showScan}>
              <CaptureDataStep
                clientType={clientType}
                onClientTypeChange={setClientType}
                personalData={personalData}
                onPersonalDataChange={setPersonalData}
                pjData={pjData}
                onPJDataChange={setPJData}
                onContinue={() => setStep(2)}
                onBack={() => setStep(0)}
                files={entryMode === "MANUAL" ? files : undefined}
                onFilesChange={entryMode === "MANUAL" ? setFiles : undefined}
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
              <CaptureSignatureStep
                signatureDataUrl={signatureDataUrl}
                onSignatureChange={setSignatureDataUrl}
                lgpdAccepted={lgpdAccepted}
                onLgpdChange={setLgpdAccepted}
                onSubmit={handleSubmit}
                onBack={() => setStep(2)}
                submitting={submitting}
              />
            </StepTransition>
          </div>
        </>
      )}
    </CaptureShell>
  );
}
