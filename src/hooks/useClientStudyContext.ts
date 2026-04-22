import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientStudyContextService } from "@/services/domain/clientStudyContextService";
import type { ClientStudyContext } from "@/types/clientStudyContext";
import { toast } from "@/hooks/use-toast";

export function useClientStudyContext(clientId: string | null, officeId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["client-study-context", clientId],
    queryFn: () => clientStudyContextService.getByClientId(clientId!),
    enabled: !!clientId,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (fields: Partial<ClientStudyContext>) => {
      if (!clientId || !officeId) throw new Error("clientId and officeId required");
      return clientStudyContextService.upsert(clientId, officeId, fields);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-study-context", clientId] });
      toast({ title: "Contexto salvo", description: "O contexto de estudo do cliente foi atualizado." });
    },
    onError: (err) => {
      console.error("[useClientStudyContext] save error:", err);
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar o contexto.", variant: "destructive" });
    },
  });

  return {
    studyContext: query.data ?? null,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    save: mutation.mutate,
    refetch: query.refetch,
  };
}
