import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import type { ValidationField } from "@/lib/clientKitValidation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingFields: ValidationField[];
  onComplete: () => void;
}

export function ClientKitValidationAlert({ 
  open, 
  onOpenChange, 
  missingFields, 
  onComplete 
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Dados incompletos
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Para gerar documentos jurídicos válidos, os seguintes campos são obrigatórios:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                {missingFields.map(({ field, label }) => (
                  <li key={field}>{label}</li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                Complete o cadastro do cliente antes de gerar o kit de documentos.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onComplete}>
            Completar Cadastro
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
