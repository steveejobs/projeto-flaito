import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DocumentHardDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  selectedCount: number;
  isLoading?: boolean;
  isBulk?: boolean;
}

const CONFIRMATION_TEXT = 'CONFIRMAR';

export function DocumentHardDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  selectedCount,
  isLoading,
  isBulk = false,
}: DocumentHardDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  const isConfirmed = confirmText === CONFIRMATION_TEXT;

  const handleConfirm = () => {
    if (!isConfirmed) return;
    onConfirm();
    setConfirmText('');
  };

  const handleCancel = () => {
    setConfirmText('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Exclusão Permanente
            <Badge variant="destructive" className="text-xs ml-2">
              {selectedCount} {isBulk ? 'documento' : ''}{selectedCount !== 1 ? 's' : ''}
            </Badge>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive">
                  ⚠️ Esta ação é IRREVERSÍVEL!
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  {isBulk
                    ? `Os ${selectedCount} documento(s) selecionados serão permanentemente excluídos do banco de dados e do armazenamento.`
                    : 'O documento será permanentemente excluído do banco de dados e do armazenamento.'}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Após a exclusão, não será possível recuperar os arquivos.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="confirm-delete" className="text-sm">
            Digite <span className="font-mono font-bold text-destructive">{CONFIRMATION_TEXT}</span> para confirmar:
          </Label>
          <Input
            id="confirm-delete"
            placeholder={CONFIRMATION_TEXT}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            className="mt-2 font-mono"
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
          >
            {isLoading ? (
              'Excluindo...'
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir Permanentemente
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
