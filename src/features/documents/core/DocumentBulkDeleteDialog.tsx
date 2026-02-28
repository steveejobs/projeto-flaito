import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface DocumentBulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  selectedCount: number;
  isLoading?: boolean;
}

export function DocumentBulkDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  selectedCount,
  isLoading,
}: DocumentBulkDeleteDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Excluir Documentos
            <Badge variant="destructive" className="text-xs">
              {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
            </Badge>
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação irá arquivar {selectedCount} documento{selectedCount !== 1 ? 's' : ''}. 
            Você poderá restaurá-los posteriormente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="bulk-delete-reason">Motivo da exclusão (opcional)</Label>
          <Textarea
            id="bulk-delete-reason"
            placeholder="Informe o motivo da exclusão em massa..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Excluindo...' : `Excluir ${selectedCount} documento${selectedCount !== 1 ? 's' : ''}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
