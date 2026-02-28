import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Briefcase, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";

interface MemberData {
  id: string;
  full_name: string | null;
  cpf: string | null;
  rg: string | null;
  rg_issuer: string | null;
  nationality: string | null;
  marital_status: string | null;
  profession: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
}

interface MemberProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string | null;
  onSaved?: () => void;
}

const MARITAL_STATUS_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União Estável" },
  { value: "separado", label: "Separado(a)" },
];

const PROFESSION_OPTIONS = [
  { value: "Advogado", label: "Advogado(a)" },
  { value: "Estagiário", label: "Estagiário(a)" },
  { value: "Secretário", label: "Secretário(a)" },
  { value: "Assistente", label: "Assistente" },
  { value: "Administrador", label: "Administrador(a)" },
];

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

// Format helpers
const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export function MemberProfileDialog({
  open,
  onOpenChange,
  memberId,
  onSaved,
}: MemberProfileDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [data, setData] = useState<MemberData | null>(null);

  useEffect(() => {
    if (open && memberId) {
      loadMemberData();
    }
  }, [open, memberId]);

  const loadMemberData = async () => {
    if (!memberId) return;

    setLoading(true);
    try {
      const { data: member, error } = await supabase
        .from("office_members")
        .select(`
          id,
          full_name,
          cpf,
          rg,
          rg_issuer,
          nationality,
          marital_status,
          profession,
          oab_number,
          oab_uf,
          phone,
          email,
          address_street,
          address_neighborhood,
          address_city,
          address_state,
          address_zip_code
        `)
        .eq("id", memberId)
        .single();

      if (error) throw error;

      setData(member);
    } catch (error) {
      console.error("Error loading member:", error);
      toast.error("Erro ao carregar dados do membro");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof MemberData, value: string | null) => {
    if (!data) return;
    setData({ ...data, [field]: value });
  };

  const handleCepChange = async (value: string) => {
    const formatted = formatCep(value);
    handleFieldChange("address_zip_code", formatted);

    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 8) {
      setLoadingCep(true);
      try {
        const res = await supabase.functions.invoke("cep-proxy", {
          body: { cep: digits },
        });

        if (res.data && !res.data.erro) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  address_street: res.data.logradouro || prev.address_street,
                  address_neighborhood: res.data.bairro || prev.address_neighborhood,
                  address_city: res.data.localidade || prev.address_city,
                  address_state: res.data.uf || prev.address_state,
                }
              : prev
          );
        }
      } catch (err) {
        console.error("CEP lookup error:", err);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleSave = async () => {
    if (!data || !memberId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("office_members")
        .update({
          full_name: data.full_name?.trim() || null,
          cpf: data.cpf || null,
          rg: data.rg || null,
          rg_issuer: data.rg_issuer || null,
          nationality: data.nationality || "brasileiro(a)",
          marital_status: data.marital_status || null,
          profession: data.profession || "Advogado",
          oab_number: data.oab_number || null,
          oab_uf: data.oab_uf || null,
          phone: data.phone || null,
          email: data.email || null,
          address_street: data.address_street || null,
          address_neighborhood: data.address_neighborhood || null,
          address_city: data.address_city || null,
          address_state: data.address_state || null,
          address_zip_code: data.address_zip_code?.replace(/\D/g, "") || null,
        })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso");
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving member:", error);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const isLawyer = data?.profession?.toLowerCase().includes("advogado") || !data?.profession;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dados Profissionais</DialogTitle>
          <DialogDescription>
            Complete os dados para uso em documentos jurídicos (procurações, petições, etc.)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Dados Pessoais */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Dados Pessoais
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input
                    id="full_name"
                    value={data.full_name || ""}
                    onChange={(e) => handleFieldChange("full_name", e.target.value)}
                    placeholder="Nome completo conforme documento"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    value={data.cpf || ""}
                    onChange={(e) => handleFieldChange("cpf", formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rg">RG</Label>
                  <div className="flex gap-2">
                    <Input
                      id="rg"
                      value={data.rg || ""}
                      onChange={(e) => handleFieldChange("rg", e.target.value)}
                      placeholder="Número do RG"
                      className="flex-1"
                    />
                    <Input
                      value={data.rg_issuer || ""}
                      onChange={(e) => handleFieldChange("rg_issuer", e.target.value.toUpperCase())}
                      placeholder="SSP/TO"
                      className="w-24"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nationality">Nacionalidade</Label>
                  <Input
                    id="nationality"
                    value={data.nationality || ""}
                    onChange={(e) => handleFieldChange("nationality", e.target.value)}
                    placeholder="brasileiro(a)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marital_status">Estado Civil *</Label>
                  <Select
                    value={data.marital_status || ""}
                    onValueChange={(v) => handleFieldChange("marital_status", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARITAL_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dados Profissionais */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Dados Profissionais
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profession">Profissão</Label>
                  <Select
                    value={data.profession || "Advogado"}
                    onValueChange={(v) => handleFieldChange("profession", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFESSION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isLawyer && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="oab_number">Número da OAB *</Label>
                      <Input
                        id="oab_number"
                        value={data.oab_number || ""}
                        onChange={(e) => handleFieldChange("oab_number", e.target.value)}
                        placeholder="12345"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="oab_uf">UF da OAB *</Label>
                      <Select
                        value={data.oab_uf || ""}
                        onValueChange={(v) => handleFieldChange("oab_uf", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {UF_OPTIONS.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Contato */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Phone className="h-4 w-4" />
                Contato
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={data.phone || ""}
                    onChange={(e) => handleFieldChange("phone", formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail Profissional</Label>
                  <Input
                    id="email"
                    type="email"
                    value={data.email || ""}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    placeholder="advogado@escritorio.com"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Endereço */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Endereço Profissional
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={data.address_zip_code || ""}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    disabled={loadingCep}
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="street">Logradouro</Label>
                  <Input
                    id="street"
                    value={data.address_street || ""}
                    onChange={(e) => handleFieldChange("address_street", e.target.value)}
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={data.address_neighborhood || ""}
                    onChange={(e) => handleFieldChange("address_neighborhood", e.target.value)}
                    placeholder="Bairro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={data.address_city || ""}
                    onChange={(e) => handleFieldChange("address_city", e.target.value)}
                    placeholder="Cidade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">UF</Label>
                  <Select
                    value={data.address_state || ""}
                    onValueChange={(v) => handleFieldChange("address_state", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
