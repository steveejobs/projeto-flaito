/**
 * SignatureRequirementsAlert - Componente para exibir pendências de assinatura
 * antes de gerar documentos
 */
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, PenLine, Settings, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface SignatureStatus {
  clientSignature: boolean;
  officeSignature: boolean;
  clientName?: string;
}

interface SignatureRequirementsAlertProps {
  status: SignatureStatus;
  onCollectClientSignature?: () => void;
  onClose?: () => void;
}

export function SignatureRequirementsAlert({
  status,
  onCollectClientSignature,
  onClose,
}: SignatureRequirementsAlertProps) {
  const navigate = useNavigate();

  const allComplete = status.clientSignature && status.officeSignature;

  if (allComplete) {
    return null;
  }

  const handleGoToSettings = () => {
    navigate("/settings/office");
  };

  return (
    <Alert variant="destructive" className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Assinaturas pendentes
      </AlertTitle>
      <AlertDescription className="mt-3 space-y-4">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Para gerar documentos válidos, as seguintes assinaturas são necessárias:
        </p>

        <ul className="space-y-2">
          {/* Status da assinatura do cliente */}
          <li className="flex items-center gap-2 text-sm">
            {status.clientSignature ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className={status.clientSignature ? "text-green-700" : "text-amber-800 dark:text-amber-200"}>
              Assinatura do cliente{status.clientName ? ` (${status.clientName})` : ""}
            </span>
            {!status.clientSignature && onCollectClientSignature && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-7 text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={onCollectClientSignature}
              >
                <PenLine className="h-3 w-3" />
                Coletar
              </Button>
            )}
          </li>

          {/* Status da assinatura do escritório */}
          <li className="flex items-center gap-2 text-sm">
            {status.officeSignature ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className={status.officeSignature ? "text-green-700" : "text-amber-800 dark:text-amber-200"}>
              Assinatura do advogado responsável
            </span>
            {!status.officeSignature && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-7 text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={handleGoToSettings}
              >
                <Settings className="h-3 w-3" />
                Configurar
              </Button>
            )}
          </li>
        </ul>

        {onClose && (
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Entendi
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
