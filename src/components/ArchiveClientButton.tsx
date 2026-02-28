import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Props = {
  clientId: string;
  clientName: string;
  onArchived?: () => void;
};

export function ArchiveClientButton({ clientId, clientName, onArchived }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleArchive() {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("archive_client", {
        p_client_id: clientId,
        p_reason: reason || null,
      });

      if (error) {
        console.error("Erro ao arquivar cliente:", error);
        toast({
          title: "Erro ao arquivar cliente",
          description: error.message || "Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Cliente arquivado",
        description: `O cliente ${clientName} foi arquivado com sucesso.`,
      });

      setOpen(false);
      if (onArchived) onArchived();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-red-500 text-red-600 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        Arquivar cliente
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente será arquivado e removido da lista principal. Os dados permanecem no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-3">
            <p className="text-sm mb-1">Motivo (opcional)</p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente inativo, cadastro duplicado..."
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={loading}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {loading ? "Arquivando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
