import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  User,
  Briefcase,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { isMemberProfileComplete, getMissingProfileFields } from "@/lib/lawyerIdentification";
import { AvatarUpload } from "@/components/AvatarUpload";

interface MemberData {
  id: string;
  user_id: string;
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
  role: string;
  is_active: boolean;
  avatar_url: string | null;
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

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MEMBER: "Membro",
};

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

export default function MemberProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [data, setData] = useState<MemberData | null>(null);
  const [officeName, setOfficeName] = useState<string>("");

  useEffect(() => {
    loadMemberData();
  }, []);

  const loadMemberData = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Get office context
      const { data: healthRaw } = await supabase.rpc("lexos_healthcheck_session");
      const healthArr = healthRaw as Array<{ ok: boolean; office_id: string; role: string }> | null;
      const health = healthArr?.[0] ?? null;

      if (!health?.ok || !health.office_id) {
        toast.error("Sem escritório ativo");
        navigate("/meu-escritorio");
        return;
      }

      // Get office name
      const { data: officeData } = await supabase
        .from("offices")
        .select("name")
        .eq("id", health.office_id)
        .single();

      if (officeData) {
        setOfficeName(officeData.name);
      }

      // Get member data
      const { data: member, error } = await supabase
        .from("office_members")
        .select(`
          id,
          user_id,
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
          address_zip_code,
          role,
          is_active,
          avatar_url
        `)
        .eq("office_id", health.office_id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      setData(member);
    } catch (error) {
      console.error("Error loading member:", error);
      toast.error("Erro ao carregar perfil");
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
    if (!data) return;

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
          avatar_url: data.avatar_url || null,
        })
        .eq("id", data.id);

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso");
    } catch (error) {
      console.error("Error saving member:", error);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const isLawyer = data?.profession?.toLowerCase().includes("advogado") || !data?.profession;
  const isComplete = data ? isMemberProfileComplete(data) : false;
  const missingFields = data ? getMissingProfileFields(data) : [];

  const getInitials = () => {
    if (data?.full_name) {
      const parts = data.full_name.trim().split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return parts[0]?.slice(0, 2).toUpperCase() || 'U';
    }
    return 'U';
  };

  const handleAvatarUpload = async (url: string) => {
    if (!data) return;
    
    try {
      const { error } = await supabase
        .from("office_members")
        .update({ avatar_url: url })
        .eq("id", data.id);
      
      if (error) throw error;
      
      setData({ ...data, avatar_url: url });
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast.error("Erro ao atualizar foto");
    }
  };

  const handleAvatarRemove = async () => {
    if (!data) return;
    
    try {
      const { error } = await supabase
        .from("office_members")
        .update({ avatar_url: null })
        .eq("id", data.id);
      
      if (error) throw error;
      
      setData({ ...data, avatar_url: null });
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error("Erro ao remover foto");
    }
  };

  if (loading) {
    return (
      <div className="container max-w-3xl py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container max-w-3xl py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não foi possível carregar seu perfil. Verifique se você está associado a um escritório.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/meu-escritorio")}
        className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Header */}
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">
          Meu Perfil
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Dados Profissionais
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Seus dados serão usados na geração de documentos jurídicos.
        </p>
      </div>

      {/* Status Card with Avatar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <AvatarUpload
                currentUrl={data.avatar_url}
                initials={getInitials()}
                userId={data.user_id}
                onUpload={handleAvatarUpload}
                onRemove={handleAvatarRemove}
                size="lg"
              />
              <div>
                <p className="font-medium">{data.full_name || "Nome não informado"}</p>
                <p className="text-sm text-muted-foreground">{officeName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{ROLE_LABELS[data.role] || data.role}</Badge>
              {isComplete ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Completo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-500/20 gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Incompleto
                </Badge>
              )}
            </div>
          </div>

          {!isComplete && (
            <Alert className="mt-4 border-amber-500/20 bg-amber-500/5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                Complete os campos obrigatórios para ser incluído em documentos:{" "}
                <strong>{missingFields.join(", ")}</strong>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-4 w-4" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Dados Profissionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Contato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Endereço Profissional
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
