import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  InstitutionalBranding, 
  InstitutionalUnit, 
  ProfessionalSettings 
} from "@/types/institutional";

export function useInstitutionalConfig(officeId: string | null) {
  const queryClient = useQueryClient();

  // 1. Query: Dados do Escritório (Global)
  const officeQuery = useQuery({
    queryKey: ["office-institutional", officeId],
    queryFn: async () => {
      if (!officeId) return null;
      const { data, error } = await supabase
        .from("offices")
        .select("*")
        .eq("id", officeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!officeId,
  });

  // 2. Query: Unidades
  const unitsQuery = useQuery({
    queryKey: ["office-units", officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from("office_units")
        .select("*")
        .eq("office_id", officeId)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!officeId,
  });

  // 3. Query: Configurações do Profissional Logado
  const mySettingsQuery = useQuery({
    queryKey: ["profile-professional-settings", officeId],
    queryFn: async () => {
      if (!officeId) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profile_professional_settings")
        .select("*")
        .eq("office_id", officeId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!officeId,
  });

  // --- MUTATIONS ---

  const updateOffice = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("offices")
        .update(updates)
        .eq("id", officeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-institutional", officeId] });
      toast.success("Configurações do escritório atualizadas.");
    },
  });

  const upsertUnit = useMutation({
    mutationFn: async (unit: Partial<InstitutionalUnit>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !officeId) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("office_units")
        .upsert({
          ...unit,
          office_id: officeId,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-units", officeId] });
      toast.success("Unidade salva com sucesso.");
    },
  });

  const updateProfessionalSettings = useMutation({
    mutationFn: async (settings: Partial<ProfessionalSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !officeId) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("profile_professional_settings")
        .upsert({
          user_id: user.id,
          office_id: officeId,
          professional_name: settings.name,
          ident_type: settings.identType,
          ident_number: settings.identNumber,
          ident_uf: settings.identUf,
          signatures: settings.signatureUrl ? [{ role: 'PRINCIPAL', signature_url: settings.signatureUrl }] : [],
        } as any, { 
          onConflict: 'user_id,office_id' 
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-professional-settings", officeId] });
      toast.success("Perfil profissional atualizado.");
    },
  });

  return {
    office: officeQuery.data,
    units: unitsQuery.data || [],
    mySettings: mySettingsQuery.data,
    isLoading: officeQuery.isLoading || unitsQuery.isLoading || mySettingsQuery.isLoading,
    mutations: {
      updateOffice,
      upsertUnit,
      updateProfessionalSettings,
    }
  };
}
