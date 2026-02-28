import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Eye } from "lucide-react";

type Doc = {
  id: string;
  case_id: string | null;
  filename: string | null;
  uploaded_at: string;
  storage_path: string | null;
  mime_type: string | null;
};

export function CaseInitialDocs({ caseId }: { caseId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("documents")
        .select("id, case_id, filename, uploaded_at, storage_path, mime_type")
        .eq("case_id", caseId)
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false });

      if (!error && data) {
        setDocs(data as Doc[]);
      }
      setLoading(false);
    }
    if (caseId) {
      load();
    }
  }, [caseId]);

  async function handleView(doc: Doc) {
    if (!doc.storage_path) {
      alert("Documento ainda não possui arquivo associado.");
      return;
    }

    setViewingDoc(doc.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "createSignedDownloadUrl",
        {
          body: {
            bucket: "documents",
            path: doc.storage_path,
          },
        }
      );

      if (error || !data?.signedUrl) {
        console.error(error);
        alert("Erro ao obter URL do documento.");
        return;
      }

      window.open(data.signedUrl, "_blank");
    } catch (err) {
      console.error("Erro ao visualizar documento:", err);
      alert("Erro ao visualizar documento.");
    } finally {
      setViewingDoc(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando documentos iniciais…</span>
      </div>
    );
  }

  if (!docs.length) {
    return (
      <div className="text-muted-foreground py-4 text-sm">
        Nenhum documento inicial foi encontrado.
      </div>
    );
  }

  return (
    <div className="mt-6 border border-border rounded-md p-4 bg-card">
      <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Documentos Iniciais do Caso
      </h2>
      <div className="space-y-1">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between border-b border-border py-2 last:border-b-0"
          >
            <div>
              <div className="font-medium text-foreground">
                {doc.filename || "Documento sem título"}
              </div>
              <div className="text-xs text-muted-foreground">
                Enviado em {new Date(doc.uploaded_at).toLocaleString("pt-BR")}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleView(doc)}
              disabled={viewingDoc === doc.id}
            >
              {viewingDoc === doc.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
