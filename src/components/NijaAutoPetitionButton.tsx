import { useState, useEffect } from "react";
import { runNijaAutoPetition } from "@/services/nijaAutoPetition";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canAnalyzeDocuments, getBlockingReason, type ReadingStatus } from "@/nija";

interface DocumentWithStatus {
  id: string;
  reading_status: ReadingStatus | null;
}

interface Props {
  caseId: string;
}

export function NijaAutoPetitionButton({ caseId }: Props) {
  const [open, setOpen] = useState(false);
  const [petitionText, setPetitionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentWithStatus[]>([]);

  // Fetch documents reading status
  useEffect(() => {
    async function fetchDocsStatus() {
      setLoadingDocs(true);
      try {
        const { data } = await supabase
          .from("documents")
          .select("id, reading_status")
          .eq("case_id", caseId)
          .is("deleted_at", null);

        setDocuments((data ?? []) as DocumentWithStatus[]);
      } catch (e) {
        console.error("[NijaAutoPetition] Error fetching docs:", e);
      } finally {
        setLoadingDocs(false);
      }
    }
    fetchDocsStatus();
  }, [caseId]);

  const canGenerate = canAnalyzeDocuments(documents);
  const blockingReason = getBlockingReason(documents);

  async function handleGenerate() {
    try {
      setLoading(true);
      setError(null);

      const { petitionText } = await runNijaAutoPetition({
        caseId,
      });

      setPetitionText(petitionText);
      setOpen(true);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Erro ao gerar petição automática com a NIJA.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || loadingDocs || !canGenerate;

  return (
    <>
      <div className="mt-4 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={isDisabled}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando peça…
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Gerar peça com NIJA
            </>
          )}
        </Button>
        {!canGenerate && blockingReason && !loadingDocs && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <FileWarning className="w-3 h-3" />
            {blockingReason}
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Petição gerada pela NIJA</DialogTitle>
            <DialogDescription>
              Revise, complemente os dados marcados como [DADO A COMPLETAR PELO
              ADVOGADO] e depois cole na sua peça ou crie um documento no
              Projeto Flaito.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-2">
            <Textarea
              className="min-h-[320px] font-mono text-sm"
              value={petitionText}
              onChange={(e) => setPetitionText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Dica: selecione todo o texto (Ctrl+A / Cmd+A) e copie (Ctrl+C /
              Cmd+C) para usar na sua peça ou em um novo documento.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
