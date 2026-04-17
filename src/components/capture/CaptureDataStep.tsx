import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PremiumField } from "./PremiumField";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Paperclip, ChevronDown, X, FileText, Image, Building2 } from "lucide-react";
import { ScannedFile } from "./CaptureDocumentScanStep";

export type ClientType = "PF" | "PJ";

export interface PersonalData {
  nome: string;
  cpf: string;
  rg: string;
  rg_emissor: string;
  data_nascimento: string;
  nacionalidade: string;
  estado_civil: string;
  profissao: string;
  telefone: string;
  email: string;
}

export const MARITAL_STATUS_OPTIONS = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'uniao_estavel', label: 'União Estável' },
  { value: 'separado', label: 'Separado(a)' },
];

export interface PJData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  telefone: string;
  email: string;
  // Representative data
  representante_nome: string;
  representante_cpf: string;
  representante_rg: string;
  representante_rg_emissor: string;
  representante_data_nascimento: string;
  representante_nacionalidade: string;
  representante_estado_civil: string;
  representante_profissao: string;
}

interface CaptureDataStepProps {
  clientType: ClientType;
  onClientTypeChange: (type: ClientType) => void;
  personalData: PersonalData;
  onPersonalDataChange: (data: PersonalData) => void;
  pjData: PJData;
  onPJDataChange: (data: PJData) => void;
  onContinue: () => void;
  onBack: () => void;
  // Optional file attachments for manual mode
  files?: ScannedFile[];
  onFilesChange?: (files: ScannedFile[]) => void;
}

// Mask helpers
function maskCPF(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCNPJ(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function maskDate(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\d{2})(\d)/, "$1/$2");
}

export function CaptureDataStep({
  clientType,
  onClientTypeChange,
  personalData,
  onPersonalDataChange,
  pjData,
  onPJDataChange,
  onContinue,
  onBack,
  files = [],
  onFilesChange,
}: CaptureDataStepProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, kind: string) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || !onFilesChange) return;

    const file = selectedFiles[0];
    if (file.size > 10 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newFile: ScannedFile = {
        kind,
        fileName: file.name,
        mimeType: file.type,
        dataUrl,
        preview: file.type.startsWith("image/") ? dataUrl : undefined,
      };
      onFilesChange([...files, newFile]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    if (!onFilesChange) return;
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    const newErrors = { ...errors };

    if (clientType === "PF") {
      if (field === "nome") {
        if (!personalData.nome.trim()) {
          newErrors.nome = "Nome é obrigatório";
        } else {
          delete newErrors.nome;
        }
      }

      if (field === "cpf") {
        const cpfDigits = personalData.cpf.replace(/\D/g, "");
        if (!cpfDigits) {
          newErrors.cpf = "CPF é obrigatório";
        } else if (cpfDigits.length !== 11) {
          newErrors.cpf = "CPF deve ter 11 dígitos";
        } else {
          delete newErrors.cpf;
        }
      }

      if (field === "data_nascimento") {
        if (!personalData.data_nascimento.trim()) {
          newErrors.data_nascimento = "Data de nascimento é obrigatória";
        } else if (personalData.data_nascimento.replace(/\D/g, "").length !== 8) {
          newErrors.data_nascimento = "Data incompleta";
        } else {
          delete newErrors.data_nascimento;
        }
      }

      if (field === "rg") {
        if (!personalData.rg.trim()) {
          newErrors.rg = "RG é obrigatório";
        } else {
          delete newErrors.rg;
        }
      }

      if (field === "rg_emissor") {
        delete newErrors.rg_emissor;
      }

      if (field === "nacionalidade") {
        if (!personalData.nacionalidade.trim()) {
          newErrors.nacionalidade = "Nacionalidade é obrigatória";
        } else {
          delete newErrors.nacionalidade;
        }
      }

      if (field === "estado_civil") {
        if (!personalData.estado_civil) {
          newErrors.estado_civil = "Estado civil é obrigatório";
        } else {
          delete newErrors.estado_civil;
        }
      }

      if (field === "profissao") {
        if (!personalData.profissao.trim()) {
          newErrors.profissao = "Profissão é obrigatória";
        } else {
          delete newErrors.profissao;
        }
      }

      if (field === "telefone") {
        const phoneDigits = personalData.telefone.replace(/\D/g, "");
        if (phoneDigits.length > 0 && phoneDigits.length < 10) {
          newErrors.telefone = "Telefone inválido";
        } else {
          delete newErrors.telefone;
        }
      }

      if (field === "email") {
        if (personalData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalData.email)) {
          newErrors.email = "Email inválido";
        } else {
          delete newErrors.email;
        }
      }
    } else {
      // PJ validation
      if (field === "razao_social") {
        if (!pjData.razao_social.trim()) {
          newErrors.razao_social = "Razão Social é obrigatória";
        } else {
          delete newErrors.razao_social;
        }
      }

      if (field === "cnpj") {
        const cnpjDigits = pjData.cnpj.replace(/\D/g, "");
        if (!cnpjDigits) {
          newErrors.cnpj = "CNPJ é obrigatório";
        } else if (cnpjDigits.length !== 14) {
          newErrors.cnpj = "CNPJ deve ter 14 dígitos";
        } else {
          delete newErrors.cnpj;
        }
      }

      if (field === "telefone_pj") {
        const phoneDigits = pjData.telefone.replace(/\D/g, "");
        if (phoneDigits.length > 0 && phoneDigits.length < 10) {
          newErrors.telefone_pj = "Telefone inválido";
        } else {
          delete newErrors.telefone_pj;
        }
      }

      if (field === "email_pj") {
        if (pjData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pjData.email)) {
          newErrors.email_pj = "Email inválido";
        } else {
          delete newErrors.email_pj;
        }
      }

      // Representative validation
      if (field === "representante_nome") {
        if (!pjData.representante_nome.trim()) {
          newErrors.representante_nome = "Nome do representante é obrigatório";
        } else {
          delete newErrors.representante_nome;
        }
      }

      if (field === "representante_cpf") {
        const cpfDigits = pjData.representante_cpf.replace(/\D/g, "");
        if (!cpfDigits) {
          newErrors.representante_cpf = "CPF do representante é obrigatório";
        } else if (cpfDigits.length !== 11) {
          newErrors.representante_cpf = "CPF deve ter 11 dígitos";
        } else {
          delete newErrors.representante_cpf;
        }
      }

      if (field === "representante_data_nascimento") {
        if (!pjData.representante_data_nascimento.trim()) {
          newErrors.representante_data_nascimento = "Data de nascimento é obrigatória";
        } else if (pjData.representante_data_nascimento.replace(/\D/g, "").length !== 8) {
          newErrors.representante_data_nascimento = "Data incompleta";
        } else {
          delete newErrors.representante_data_nascimento;
        }
      }

      if (field === "representante_rg") {
        if (!pjData.representante_rg.trim()) {
          newErrors.representante_rg = "RG do representante é obrigatório";
        } else {
          delete newErrors.representante_rg;
        }
      }

      if (field === "representante_rg_emissor") {
        delete newErrors.representante_rg_emissor;
      }

      if (field === "representante_nacionalidade") {
        if (!pjData.representante_nacionalidade.trim()) {
          newErrors.representante_nacionalidade = "Nacionalidade é obrigatória";
        } else {
          delete newErrors.representante_nacionalidade;
        }
      }

      if (field === "representante_estado_civil") {
        if (!pjData.representante_estado_civil) {
          newErrors.representante_estado_civil = "Estado civil é obrigatório";
        } else {
          delete newErrors.representante_estado_civil;
        }
      }

      if (field === "representante_profissao") {
        if (!pjData.representante_profissao.trim()) {
          newErrors.representante_profissao = "Profissão é obrigatória";
        } else {
          delete newErrors.representante_profissao;
        }
      }
    }

    setErrors(newErrors);
  };

  const handlePersonalChange = (field: keyof PersonalData, value: string) => {
    let maskedValue = value;
    if (field === "cpf") maskedValue = maskCPF(value);
    if (field === "telefone") maskedValue = maskPhone(value);
    if (field === "data_nascimento") maskedValue = maskDate(value);

    onPersonalDataChange({ ...personalData, [field]: maskedValue });
  };

  const handlePJChange = (field: keyof PJData, value: string) => {
    let maskedValue = value;
    if (field === "cnpj") maskedValue = maskCNPJ(value);
    if (field === "telefone") maskedValue = maskPhone(value);
    if (field === "representante_cpf") maskedValue = maskCPF(value);
    if (field === "representante_data_nascimento") maskedValue = maskDate(value);

    onPJDataChange({ ...pjData, [field]: maskedValue });
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (clientType === "PF") {
      if (!personalData.nome.trim()) newErrors.nome = "Nome é obrigatório";
      
      const cpfDigits = personalData.cpf.replace(/\D/g, "");
      if (!cpfDigits) {
        newErrors.cpf = "CPF é obrigatório";
      } else if (cpfDigits.length !== 11) {
        newErrors.cpf = "CPF deve ter 11 dígitos";
      }
      
      if (!personalData.data_nascimento.trim()) newErrors.data_nascimento = "Data de nascimento é obrigatória";
      else if (personalData.data_nascimento.replace(/\D/g, "").length !== 8) newErrors.data_nascimento = "Data incompleta";

      if (!personalData.rg.trim()) newErrors.rg = "RG é obrigatório";
      if (!personalData.nacionalidade.trim()) newErrors.nacionalidade = "Nacionalidade é obrigatória";
      if (!personalData.estado_civil) newErrors.estado_civil = "Estado civil é obrigatório";
      if (!personalData.profissao.trim()) newErrors.profissao = "Profissão é obrigatória";
      if (!personalData.estado_civil) newErrors.estado_civil = "Estado civil é obrigatório";
      
      const phoneDigits = personalData.telefone.replace(/\D/g, "");
      if (phoneDigits.length > 0 && phoneDigits.length < 10) {
        newErrors.telefone = "Telefone inválido";
      }
      
      if (personalData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalData.email)) {
        newErrors.email = "Email inválido";
      }
    } else {
      if (!pjData.razao_social.trim()) newErrors.razao_social = "Razão Social é obrigatória";
      
      const cnpjDigits = pjData.cnpj.replace(/\D/g, "");
      if (!cnpjDigits) {
        newErrors.cnpj = "CNPJ é obrigatório";
      } else if (cnpjDigits.length !== 14) {
        newErrors.cnpj = "CNPJ deve ter 14 dígitos";
      }
      
      if (!pjData.representante_nome.trim()) newErrors.representante_nome = "Nome do representante é obrigatório";
      
      const repCpfDigits = pjData.representante_cpf.replace(/\D/g, "");
      if (!repCpfDigits) {
        newErrors.representante_cpf = "CPF do representante é obrigatório";
      } else if (repCpfDigits.length !== 11) {
        newErrors.representante_cpf = "CPF deve ter 11 dígitos";
      }
      
      if (!pjData.representante_data_nascimento.trim()) newErrors.representante_data_nascimento = "Data de nascimento é obrigatória";
      else if (pjData.representante_data_nascimento.replace(/\D/g, "").length !== 8) newErrors.representante_data_nascimento = "Data incompleta";

      if (!pjData.representante_rg.trim()) newErrors.representante_rg = "RG do representante é obrigatório";
      if (!pjData.representante_nacionalidade.trim()) newErrors.representante_nacionalidade = "Nacionalidade é obrigatória";
      if (!pjData.representante_estado_civil) newErrors.representante_estado_civil = "Estado civil é obrigatório";
      if (!pjData.representante_profissao.trim()) newErrors.representante_profissao = "Profissão é obrigatória";
      
      if (pjData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pjData.email)) {
        newErrors.email_pj = "Email inválido";
      }
      const phoneDigits = pjData.telefone.replace(/\D/g, "");
      if (phoneDigits.length > 0 && phoneDigits.length < 10) {
        newErrors.telefone_pj = "Telefone inválido";
      }
    }

    setErrors(newErrors);
    const allFields = Object.keys(newErrors);
    setTouched(allFields.reduce((acc, key) => ({ ...acc, [key]: true }), {}));

    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateAll()) {
      onContinue();
    }
  };

  return (
    <div className="space-y-5 capture-animate-in">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          Seus Dados
        </h2>
        <p className="text-base text-white/50 mt-1">
          Preencha com calma, seus dados estão seguros
        </p>
      </div>

      <div className="flex rounded-xl bg-white/[0.04] p-1.5 mb-6 border border-white/5">
        <button
          type="button"
          onClick={() => onClientTypeChange("PF")}
          className={cn(
            "flex-1 py-3 px-4 rounded-lg text-base font-medium transition-all duration-200",
            clientType === "PF"
              ? "bg-white/10 text-white shadow-sm"
              : "text-white/40 hover:text-white/70"
          )}
        >
          Pessoa Física
        </button>
        <button
          type="button"
          onClick={() => onClientTypeChange("PJ")}
          className={cn(
            "flex-1 py-3 px-4 rounded-lg text-base font-medium transition-all duration-200",
            clientType === "PJ"
              ? "bg-white/10 text-white shadow-sm"
              : "text-white/40 hover:text-white/70"
          )}
        >
          Pessoa Jurídica
        </button>
      </div>

      {clientType === "PF" ? (
        <div className="space-y-4">
          <PremiumField
            label="Nome Completo"
            name="nome"
            required
            autoComplete="name"
            value={personalData.nome}
            onChange={(e) => handlePersonalChange("nome", e.target.value)}
            onBlur={() => handleBlur("nome")}
            error={errors.nome}
            touched={touched.nome}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PremiumField
              label="CPF"
              name="cpf"
              required
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={personalData.cpf}
              onChange={(e) => handlePersonalChange("cpf", e.target.value)}
              onBlur={() => handleBlur("cpf")}
              error={errors.cpf}
              touched={touched.cpf}
            />
            <PremiumField
              label="Data de Nascimento"
              name="data_nascimento"
              required
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              value={personalData.data_nascimento}
              onChange={(e) => handlePersonalChange("data_nascimento", e.target.value)}
              onBlur={() => handleBlur("data_nascimento")}
              error={errors.data_nascimento}
              touched={touched.data_nascimento}
            />
          </div>

            <div className="flex gap-2">
              <PremiumField
                label="RG"
                name="rg"
                required
                placeholder="Número"
                value={personalData.rg}
                onChange={(e) => handlePersonalChange("rg", e.target.value)}
                onBlur={() => handleBlur("rg")}
                error={errors.rg}
                touched={touched.rg}
                className="flex-1"
              />
            </div>
            <PremiumField
              label="Profissão"
              name="profissao"
              required
              placeholder="Ex.: Empresário, etc."
              value={personalData.profissao}
              onChange={(e) => handlePersonalChange("profissao", e.target.value)}
              onBlur={() => handleBlur("profissao")}
              error={errors.profissao}
              touched={touched.profissao}
            />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PremiumField
              label="Nacionalidade"
              name="nacionalidade"
              required
              placeholder="Brasileiro(a)"
              value={personalData.nacionalidade}
              onChange={(e) => handlePersonalChange("nacionalidade", e.target.value)}
              onBlur={() => handleBlur("nacionalidade")}
              error={errors.nacionalidade}
              touched={touched.nacionalidade}
            />
            <div className="space-y-1.5">
              <label className="text-xs text-white/70 font-medium">
                Estado Civil <span className="text-red-400">*</span>
              </label>
              <select
                value={personalData.estado_civil}
                onChange={(e) => handlePersonalChange("estado_civil", e.target.value)}
                onBlur={() => handleBlur("estado_civil")}
                className={cn(
                  "w-full h-10 px-3 rounded-lg bg-white/5 border text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20",
                  errors.estado_civil && touched.estado_civil
                    ? "border-red-400/50"
                    : "border-white/10"
                )}
              >
                <option value="" className="bg-neutral-800">Selecione</option>
                {MARITAL_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-neutral-800">
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.estado_civil && touched.estado_civil && (
                <p className="text-xs text-red-400 mt-1">{errors.estado_civil}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PremiumField
              label="Telefone"
              name="telefone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              value={personalData.telefone}
              onChange={(e) => handlePersonalChange("telefone", e.target.value)}
              onBlur={() => handleBlur("telefone")}
              error={errors.telefone}
              touched={touched.telefone}
            />
            <PremiumField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="email@exemplo.com"
              value={personalData.email}
              onChange={(e) => handlePersonalChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              error={errors.email}
              touched={touched.email}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-white/50" />
            <span className="text-sm text-white/70 font-medium">Dados da Empresa</span>
          </div>
          
          <PremiumField
            label="CNPJ"
            name="cnpj"
            required
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            value={pjData.cnpj}
            onChange={(e) => handlePJChange("cnpj", e.target.value)}
            onBlur={() => handleBlur("cnpj")}
            error={errors.cnpj}
            touched={touched.cnpj}
          />

          <PremiumField
            label="Razão Social"
            name="razao_social"
            required
            value={pjData.razao_social}
            onChange={(e) => handlePJChange("razao_social", e.target.value)}
            onBlur={() => handleBlur("razao_social")}
            error={errors.razao_social}
            touched={touched.razao_social}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PremiumField
              label="Telefone"
              name="telefone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              value={pjData.telefone}
              onChange={(e) => handlePJChange("telefone", e.target.value)}
              onBlur={() => handleBlur("telefone_pj")}
              error={errors.telefone_pj}
              touched={touched.telefone_pj}
            />
            <PremiumField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="email@exemplo.com"
              value={pjData.email}
              onChange={(e) => handlePJChange("email", e.target.value)}
              onBlur={() => handleBlur("email_pj")}
              error={errors.email_pj}
              touched={touched.email_pj}
            />
          </div>

          <div className="border-t border-white/10 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-white/70 font-medium">Representante Legal</span>
            </div>

            <div className="space-y-4">
              <PremiumField
                label="Nome Completo"
                name="representante_nome"
                required
                value={pjData.representante_nome}
                onChange={(e) => handlePJChange("representante_nome", e.target.value)}
                onBlur={() => handleBlur("representante_nome")}
                error={errors.representante_nome}
                touched={touched.representante_nome}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PremiumField
                  label="CPF"
                  name="representante_cpf"
                  required
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={pjData.representante_cpf}
                  onChange={(e) => handlePJChange("representante_cpf", e.target.value)}
                  onBlur={() => handleBlur("representante_cpf")}
                  error={errors.representante_cpf}
                  touched={touched.representante_cpf}
                />
                <PremiumField
                  label="Data de Nascimento"
                  name="representante_data_nascimento"
                  required
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  value={pjData.representante_data_nascimento}
                  onChange={(e) => handlePJChange("representante_data_nascimento", e.target.value)}
                  onBlur={() => handleBlur("representante_data_nascimento")}
                  error={errors.representante_data_nascimento}
                  touched={touched.representante_data_nascimento}
                />
              </div>

              <div className="flex gap-2">
                <PremiumField
                  label="RG"
                  name="representante_rg"
                  required
                  placeholder="Número"
                  value={pjData.representante_rg}
                  onChange={(e) => handlePJChange("representante_rg", e.target.value)}
                  onBlur={() => handleBlur("representante_rg")}
                  error={errors.representante_rg}
                  touched={touched.representante_rg}
                  className="flex-1"
                />
              </div>
                <PremiumField
                  label="Profissão"
                  name="representante_profissao"
                  required
                  placeholder="Ex.: Administrador, etc."
                  value={pjData.representante_profissao}
                  onChange={(e) => handlePJChange("representante_profissao", e.target.value)}
                  onBlur={() => handleBlur("representante_profissao")}
                  error={errors.representante_profissao}
                  touched={touched.representante_profissao}
                />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PremiumField
                  label="Nacionalidade"
                  name="representante_nacionalidade"
                  required
                  placeholder="Brasileiro(a)"
                  value={pjData.representante_nacionalidade}
                  onChange={(e) => handlePJChange("representante_nacionalidade", e.target.value)}
                  onBlur={() => handleBlur("representante_nacionalidade")}
                  error={errors.representante_nacionalidade}
                  touched={touched.representante_nacionalidade}
                />
                <div className="space-y-1.5">
                  <label className="text-xs text-white/70 font-medium">
                    Estado Civil <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={pjData.representante_estado_civil}
                    onChange={(e) => handlePJChange("representante_estado_civil", e.target.value)}
                    onBlur={() => handleBlur("representante_estado_civil")}
                    className={cn(
                      "w-full h-10 px-3 rounded-lg bg-white/5 border text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20",
                      errors.representante_estado_civil && touched.representante_estado_civil
                        ? "border-red-400/50"
                        : "border-white/10"
                    )}
                  >
                    <option value="" className="bg-neutral-800">Selecione</option>
                    {MARITAL_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-neutral-800">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors.representante_estado_civil && touched.representante_estado_civil && (
                    <p className="text-xs text-red-400 mt-1">{errors.representante_estado_civil}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {onFilesChange && (
        <Collapsible open={attachmentsOpen} onOpenChange={setAttachmentsOpen} className="mt-6">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors w-full justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              <span>Anexar documentos (opcional)</span>
              {files.length > 0 && (
                <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{files.length}</span>
              )}
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform", attachmentsOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-white/5 border border-dashed border-white/20 text-white/70 text-sm cursor-pointer hover:bg-white/10 hover:border-white/30 transition-colors">
                <Image className="w-4 h-4" />
                <span>RG / CNH</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "IDENTIDADE")}
                />
              </label>
              <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-white/5 border border-dashed border-white/20 text-white/70 text-sm cursor-pointer hover:bg-white/10 hover:border-white/30 transition-colors">
                <FileText className="w-4 h-4" />
                <span>Comprovante</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "COMPROVANTE_ENDERECO")}
                />
              </label>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10">
                    {file.preview ? (
                      <img src={file.preview} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{file.fileName}</p>
                      <p className="text-xs text-white/50">{file.kind}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="flex-1 text-white/70 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all duration-200"
        >
          Voltar
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          className="flex-1 bg-white text-black hover:bg-white/90 active:scale-[0.98] transition-all duration-200 font-bold h-12 rounded-xl border-none shadow-xl"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
