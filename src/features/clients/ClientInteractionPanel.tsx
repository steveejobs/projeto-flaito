import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientDocumentKit } from "./ClientDocumentKit";
import { ArchiveClientButton } from "@/components/ArchiveClientButton";
import { DeleteClientButton } from "@/components/DeleteClientButton";
import { ClientFilesCard } from "./ClientFilesCard";
import { ClientSignaturePanel } from "./ClientSignaturePanel";
import { FileText } from "lucide-react";

type Props = {
  clientId: string;
  clientName: string;
  officeId: string;
  onClientChanged?: () => void;
};

export function ClientInteractionPanel({ clientId, clientName, officeId, onClientChanged }: Props) {
  return (
    <div className="space-y-4">
      {/* Header com nome e ações */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm md:text-base font-semibold truncate">
              {clientName}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <ArchiveClientButton
                clientId={clientId}
                clientName={clientName}
                onArchived={onClientChanged}
              />
              <DeleteClientButton
                clientId={clientId}
                clientName={clientName}
                onDeleted={onClientChanged}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 1: Kit Inicial de Documentos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
          Kit Inicial de Documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ClientDocumentKit clientId={clientId} compact />
        </CardContent>
      </Card>

      {/* Card 2: Arquivos e documentos do cliente */}
      <ClientFilesCard clientId={clientId} officeId={officeId} />

      {/* Card 3: Assinaturas do cliente */}
      <ClientSignaturePanel clientId={clientId} />
    </div>
  );
}
