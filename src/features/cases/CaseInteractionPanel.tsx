import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LexosTimeline } from "@/components/LexosTimeline";
import { DocumentStatusSelect } from "@/features/documents";
import { CaseForensicAuditPanel } from "./CaseForensicAuditPanel";

type CaseInteractionPanelProps = {
  caseId: string;
};

export function CaseInteractionPanel({ caseId }: CaseInteractionPanelProps) {
  const [caseData, setCaseData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: caseInfo } = await supabase
      .from("cases")
      .select("id, client_id, title, status, stage, side, updated_at")
      .eq("id", caseId)
      .maybeSingle();

    const { data: docs } = await supabase
      .from("documents")
      .select("id, filename, status, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    setCaseData(caseInfo || null);
    setDocuments(docs || []);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !caseData) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Carregando detalhes do caso...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* DADOS DO CASO */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="text-lg font-semibold">{caseData.title}</div>
          <div className="text-sm">Status: {caseData.status}</div>
          <div className="text-sm">Fase: {caseData.stage}</div>
          <div className="text-sm text-muted-foreground">
            Polo: {caseData.side}
          </div>
        </CardContent>
      </Card>

      {/* TABS PARA DIFERENTES VISUALIZAÇÕES */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="audit">Auditoria Forense</TabsTrigger>
        </TabsList>

        {/* DOCUMENTOS */}
        <TabsContent value="documents">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-lg font-semibold">Documentos do Caso</div>
              {documents.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  Nenhum documento vinculado.
                </div>
              )}

              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-md p-3 space-y-2 bg-muted/20"
                >
                  <div className="font-medium">{doc.filename}</div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Status:
                    </span>
                    <DocumentStatusSelect
                      documentId={doc.id}
                      value={doc.status}
                      onChange={async (status) => {
                        await supabase
                          .from("documents")
                          .update({ status })
                          .eq("id", doc.id);
                        load();
                      }}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.location.href = `/document-view/${doc.id}`;
                    }}
                  >
                    Abrir documento
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="text-lg font-semibold">Linha do Tempo do Caso</div>
              <Separator />
              <LexosTimeline caseId={caseId} showFilters={true} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDITORIA FORENSE */}
        <TabsContent value="audit">
          <CaseForensicAuditPanel caseId={caseId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
