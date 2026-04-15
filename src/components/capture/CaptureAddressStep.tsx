import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PremiumField } from "./PremiumField";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface AddressData {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface CaptureAddressStepProps {
  addressData: AddressData;
  onAddressDataChange: (data: AddressData) => void;
  onContinue: () => void;
  onBack: () => void;
}

function maskCEP(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

export function CaptureAddressStep({
  addressData,
  onAddressDataChange,
  onContinue,
  onBack,
}: CaptureAddressStepProps) {
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCEPChange = async (value: string) => {
    const maskedCEP = maskCEP(value);
    onAddressDataChange({ ...addressData, cep: maskedCEP });

    const digits = maskedCEP.replace(/\D/g, "");
    if (digits.length === 8) {
      setLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await response.json();

        if (data.erro) {
          toast.error("CEP não encontrado");
        } else {
          onAddressDataChange({
            ...addressData,
            cep: maskedCEP,
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            uf: data.uf || "",
          });
        }
      } catch {
        toast.error("Erro ao buscar CEP");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    const newErrors = { ...errors };

    if (field === "cep") {
      const cepDigits = addressData.cep.replace(/\D/g, "");
      if (cepDigits.length > 0 && cepDigits.length !== 8) {
        newErrors.cep = "CEP deve ter 8 dígitos";
      } else {
        delete newErrors.cep;
      }
    }

    if (field === "logradouro") {
      if (!addressData.logradouro.trim()) {
        newErrors.logradouro = "Logradouro é obrigatório";
      } else {
        delete newErrors.logradouro;
      }
    }

    if (field === "numero") {
      if (!addressData.numero.trim()) {
        newErrors.numero = "Número é obrigatório";
      } else {
        delete newErrors.numero;
      }
    }

    if (field === "bairro") {
      if (!addressData.bairro.trim()) {
        newErrors.bairro = "Bairro é obrigatório";
      } else {
        delete newErrors.bairro;
      }
    }

    if (field === "cidade") {
      if (!addressData.cidade.trim()) {
        newErrors.cidade = "Cidade é obrigatória";
      } else {
        delete newErrors.cidade;
      }
    }

    if (field === "uf") {
      if (!addressData.uf.trim()) {
        newErrors.uf = "UF é obrigatória";
      } else {
        delete newErrors.uf;
      }
    }

    setErrors(newErrors);
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!addressData.logradouro.trim()) newErrors.logradouro = "Logradouro é obrigatório";
    if (!addressData.numero.trim()) newErrors.numero = "Número é obrigatório";
    if (!addressData.bairro.trim()) newErrors.bairro = "Bairro é obrigatório";
    if (!addressData.cidade.trim()) newErrors.cidade = "Cidade é obrigatória";
    if (!addressData.uf.trim()) newErrors.uf = "UF é obrigatória";

    const cepDigits = addressData.cep.replace(/\D/g, "");
    if (cepDigits.length > 0 && cepDigits.length !== 8) {
      newErrors.cep = "CEP deve ter 8 dígitos";
    }

    setErrors(newErrors);
    
    // Mark all fields as touched
    const allFields = ["logradouro", "numero", "bairro", "cidade", "uf"];
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
          Endereço
        </h2>
        <p className="text-base text-white/50 mt-1">
          Digite o CEP para preenchimento automático
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <PremiumField
            label="CEP"
            name="cep"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={addressData.cep}
            onChange={(e) => handleCEPChange(e.target.value)}
            onBlur={() => handleBlur("cep")}
            error={errors.cep}
            touched={touched.cep}
          />
          {loading && (
            <div className="absolute right-3 top-9">
              <Loader2 className="w-4 h-4 animate-spin text-white/50" />
            </div>
          )}
        </div>

        <PremiumField
          label="Logradouro"
          name="logradouro"
          required
          autoComplete="address-line1"
          placeholder="Rua, Avenida, etc."
          value={addressData.logradouro}
          onChange={(e) =>
            onAddressDataChange({ ...addressData, logradouro: e.target.value })
          }
          onBlur={() => handleBlur("logradouro")}
          error={errors.logradouro}
          touched={touched.logradouro}
        />

        <div className="grid grid-cols-3 gap-3">
          <PremiumField
            label="Número"
            name="numero"
            required
            placeholder="123"
            value={addressData.numero}
            onChange={(e) =>
              onAddressDataChange({ ...addressData, numero: e.target.value })
            }
            onBlur={() => handleBlur("numero")}
            error={errors.numero}
            touched={touched.numero}
          />
          <div className="col-span-2">
            <PremiumField
              label="Complemento"
              name="complemento"
              placeholder="Apto, Bloco, etc."
              value={addressData.complemento}
              onChange={(e) =>
                onAddressDataChange({ ...addressData, complemento: e.target.value })
              }
            />
          </div>
        </div>

        <PremiumField
          label="Bairro"
          name="bairro"
          required
          value={addressData.bairro}
          onChange={(e) =>
            onAddressDataChange({ ...addressData, bairro: e.target.value })
          }
          onBlur={() => handleBlur("bairro")}
          error={errors.bairro}
          touched={touched.bairro}
        />

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <PremiumField
              label="Cidade"
              name="cidade"
              required
              value={addressData.cidade}
              onChange={(e) =>
                onAddressDataChange({ ...addressData, cidade: e.target.value })
              }
              onBlur={() => handleBlur("cidade")}
              error={errors.cidade}
              touched={touched.cidade}
            />
          </div>
          <PremiumField
            label="UF"
            name="uf"
            required
            maxLength={2}
            placeholder="TO"
            value={addressData.uf}
            onChange={(e) =>
              onAddressDataChange({
                ...addressData,
                uf: e.target.value.toUpperCase(),
              })
            }
            onBlur={() => handleBlur("uf")}
            error={errors.uf}
            touched={touched.uf}
          />
        </div>
      </div>

      {/* Footer */}
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
