import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Props = {
  clientId: string;
  clientName: string;
  onDeleted?: () => void;
};

export function DeleteClientButton({ clientId, clientName, onDeleted }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("hard_delete_client", {
        p_client_id: clientId,
      });

      if (error) {
        console.error("[Lexos] Erro ao excluir cliente:", error);
        toast({
          title: "Erro ao excluir cliente",
          description: error.message || "Não foi possível excluir o cliente e os registros vinculados.",
          variant: "destructive",
        });
        return;
      }
      
      // Verificar resposta lógica da função
      if (data && typeof data === "object" && "success" in data && data.success === false) {
        console.error("[Lexos] Exclusão negada:", (data as any).error);
        toast({
          title: "Erro ao excluir cliente",
          description: (data as any).error || "Sem permissão para excluir cliente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Cliente excluído",
        description: `O cliente ${clientName} e tudo que era dele foram removidos.`,
      });

      // Close dialog immediately
      setOpen(false);

      // Invalidate clients queries for refetch
      queryClient.invalidateQueries({ queryKey: ["clients"] });

      // Call onDeleted callback (handles optimistic update in parent)
      if (onDeleted) onDeleted();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Excluir cliente
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cliente definitivamente?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação irá remover o cliente <strong>{clientName}</strong>, todos
            os casos, documentos e arquivos vinculados. Essa operação é
            permanente e não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading}>
            {loading ? "Excluindo..." : "Confirmar exclusão definitiva"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
