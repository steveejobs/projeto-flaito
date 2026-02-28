import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, AlertCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isMemberProfileComplete, getMissingProfileFields } from "@/lib/lawyerIdentification";

interface LawyerMember {
  id: string;
  full_name: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  profession: string | null;
  cpf: string | null;
  nationality: string | null;
  marital_status: string | null;
  rg: string | null;
  rg_issuer: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
}

interface ClientLawyerSelectorProps {
  officeId: string;
  clientId?: string | null;
  allLawyers: boolean;
  selectedLawyerIds: string[];
  primaryLawyerId: string | null;
  onAllLawyersChange: (value: boolean) => void;
  onSelectedLawyersChange: (ids: string[]) => void;
  onPrimaryLawyerChange: (id: string | null) => void;
  skipInitialLoad?: boolean; // Pular carregamento inicial se já tiver valores
}

export function ClientLawyerSelector({
  officeId,
  clientId,
  allLawyers,
  selectedLawyerIds,
  primaryLawyerId,
  onAllLawyersChange,
  onSelectedLawyersChange,
  onPrimaryLawyerChange,
  skipInitialLoad = false,
}: ClientLawyerSelectorProps) {
  const [lawyers, setLawyers] = useState<LawyerMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Separar advogados completos e incompletos
  const { completeLawyers, incompleteLawyers } = useMemo(() => {
    const complete: LawyerMember[] = [];
    const incomplete: LawyerMember[] = [];

    lawyers.forEach((lawyer) => {
      if (isMemberProfileComplete(lawyer)) {
        complete.push(lawyer);
      } else {
        incomplete.push(lawyer);
      }
    });

    return { completeLawyers: complete, incompleteLawyers: incomplete };
  }, [lawyers]);

  useEffect(() => {
    loadLawyers();
  }, [officeId]);

  useEffect(() => {
    // Só carregar atribuições existentes se não houver seleção prévia
    if (clientId && !skipInitialLoad && selectedLawyerIds.length === 0 && allLawyers) {
      loadExistingAssignments();
    }
  }, [clientId, skipInitialLoad]);

  const loadLawyers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("office_members")
        .select(`
          id,
          full_name,
          oab_number,
          oab_uf,
          profession,
          cpf,
          nationality,
          marital_status,
          rg,
          rg_issuer,
          phone,
          email,
          address_street,
          address_neighborhood,
          address_city,
          address_state,
          address_zip_code
        `)
        .eq("office_id", officeId)
        .eq("is_active", true);

      if (error) throw error;

      // Filter only lawyers (profession = Advogado OR has OAB number) AND has name
      const lawyerMembers = (data || []).filter(
        (m) =>
          m.full_name && // Must have a name
          (m.oab_number || m.profession?.toLowerCase().includes("advogado"))
      );

      setLawyers(lawyerMembers);
    } catch (error) {
      console.error("Error loading lawyers:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAssignments = async () => {
    if (!clientId) return;

    try {
      const { data: assignments } = await supabase
        .from("client_assigned_lawyers")
        .select("member_id, is_primary")
        .eq("client_id", clientId);

      if (assignments && assignments.length > 0) {
        onAllLawyersChange(false);
        onSelectedLawyersChange(assignments.map((a) => a.member_id));
        const primary = assignments.find((a) => a.is_primary);
        if (primary) {
          onPrimaryLawyerChange(primary.member_id);
        }
      }
    } catch (error) {
      console.error("Error loading assignments:", error);
    }
  };

  const handleToggleLawyer = (lawyerId: string) => {
    const newSelected = selectedLawyerIds.includes(lawyerId)
      ? selectedLawyerIds.filter((id) => id !== lawyerId)
      : [...selectedLawyerIds, lawyerId];

    onSelectedLawyersChange(newSelected);

    if (primaryLawyerId === lawyerId && !newSelected.includes(lawyerId)) {
      onPrimaryLawyerChange(null);
    }

    if (newSelected.length === 1) {
      onPrimaryLawyerChange(newSelected[0]);
    }
  };

  const handleSetPrimary = (lawyerId: string) => {
    if (!selectedLawyerIds.includes(lawyerId)) {
      onSelectedLawyersChange([...selectedLawyerIds, lawyerId]);
    }
    onPrimaryLawyerChange(lawyerId);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // Se não houver advogados completos
  if (completeLawyers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
        <AlertCircle className="h-8 w-8 mx-auto text-amber-600 mb-2" />
        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
          Nenhum advogado com cadastro completo
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
          Complete o perfil dos advogados em Configurações → Membros
        </p>
        {incompleteLawyers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-500/20">
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
              Advogados com cadastro incompleto:
            </p>
            {incompleteLawyers.map((lawyer) => (
              <div key={lawyer.id} className="text-xs text-muted-foreground">
                • {lawyer.full_name || "(sem nome)"} - Faltam: {getMissingProfileFields(lawyer).slice(0, 2).join(", ")}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Advogado(s) Responsável(is)</Label>
        <div className="flex items-center gap-2">
          <Switch
            id="all-lawyers"
            checked={allLawyers}
            onCheckedChange={onAllLawyersChange}
          />
          <Label htmlFor="all-lawyers" className="text-sm text-muted-foreground cursor-pointer">
            Todos os advogados
          </Label>
        </div>
      </div>

      {allLawyers ? (
        <div className="rounded-lg border border-dashed border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">
              {completeLawyers.length} advogado{completeLawyers.length !== 1 ? "s" : ""} com cadastro completo
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {completeLawyers.slice(0, 5).map((lawyer) => (
              <Badge key={lawyer.id} variant="secondary" className="text-xs">
                {lawyer.full_name}
                {lawyer.oab_number && ` - OAB ${lawyer.oab_number}`}
              </Badge>
            ))}
            {completeLawyers.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{completeLawyers.length - 5} mais
              </Badge>
            )}
          </div>
          {incompleteLawyers.length > 0 && (
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ {incompleteLawyers.length} advogado(s) com cadastro incompleto não serão incluídos
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Advogados com cadastro completo */}
          {completeLawyers.map((lawyer) => {
            const isSelected = selectedLawyerIds.includes(lawyer.id);
            const isPrimary = primaryLawyerId === lawyer.id;

            return (
              <div
                key={lawyer.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggleLawyer(lawyer.id)}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {lawyer.full_name}
                    </span>
                    {isPrimary && (
                      <Badge variant="default" className="text-[10px] gap-1 bg-amber-500 hover:bg-amber-600">
                        <Star className="h-3 w-3" />
                        Principal
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {lawyer.oab_number && lawyer.oab_uf
                      ? `OAB/${lawyer.oab_uf.toUpperCase()} ${lawyer.oab_number}`
                      : lawyer.oab_number
                      ? `OAB ${lawyer.oab_number}`
                      : "OAB não informada"}
                  </div>
                </div>

                {isSelected && selectedLawyerIds.length > 1 && !isPrimary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(lawyer.id)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Definir principal
                  </button>
                )}
              </div>
            );
          })}

          {selectedLawyerIds.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Selecione ao menos um advogado para os documentos
            </p>
          )}

          {/* Seção de advogados incompletos */}
          {incompleteLawyers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-dashed">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-medium">
                  Advogados com cadastro incompleto (não podem ser selecionados):
                </span>
              </div>
              {incompleteLawyers.map((lawyer) => (
                <div key={lawyer.id} className="text-xs text-muted-foreground ml-6 py-1">
                  • {lawyer.full_name || "(sem nome)"} - Faltam: {getMissingProfileFields(lawyer).slice(0, 3).join(", ")}
                  {getMissingProfileFields(lawyer).length > 3 && ` (+${getMissingProfileFields(lawyer).length - 3})`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
