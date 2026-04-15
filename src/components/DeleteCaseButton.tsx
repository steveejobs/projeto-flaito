import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface DeleteCaseButtonProps {
  caseId: string;
  caseTitle: string;
  onDeleted?: () => void;
  navigateAfterDelete?: boolean;
  /** Optional ID for programmatic triggering via document.getElementById */
  triggerId?: string;
  /** Hide the button visually (for programmatic use) */
  hidden?: boolean;
}

export function DeleteCaseButton({ 
  caseId, 
  caseTitle, 
  onDeleted,
  navigateAfterDelete = true,
  triggerId,
  hidden = false,
}: DeleteCaseButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Call the cascade delete RPC
      const { data, error } = await (supabase.rpc as any)('delete_case_cascade', {
        p_case_id: caseId,
      });

      if (error) {
        // Extract detailed error message
        const errorMessage = error.message || 'Erro desconhecido';
        const errorCode = error.code || '';
        const errorHint = error.hint || '';
        
        console.error('[DeleteCaseButton] RPC error:', { 
          message: errorMessage, 
          code: errorCode, 
          hint: errorHint,
          details: error.details 
        });
        
        throw new Error(
          errorHint 
            ? `${errorMessage} (${errorHint})` 
            : errorCode 
              ? `${errorMessage} [${errorCode}]`
              : errorMessage
        );
      }

      // Verify the response
      const result = data as { ok?: boolean } | null;
      if (!result?.ok) {
        throw new Error('A exclusão não foi confirmada pelo servidor.');
      }

      toast({
        title: 'Caso excluído',
        description: `O caso "${caseTitle}" foi excluído permanentemente.`,
      });

      setOpen(false);
      
      // Invalidate cases query to refresh lists
      await queryClient.invalidateQueries({ queryKey: ['cases'] });
      
      // Call callback if provided
      onDeleted?.();
      
      // Navigate to cases list if requested
      if (navigateAfterDelete) {
        navigate('/cases');
      }
    } catch (err: any) {
      console.error('[DeleteCaseButton] Erro:', err);
      
      // Build detailed error message for toast
      let description = 'Não foi possível excluir o caso.';
      if (err.message) {
        description = err.message;
      }
      
      toast({
        title: 'Erro ao excluir caso',
        description,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          id={triggerId}
          variant="destructive" 
          size="sm" 
          className={`gap-1.5 ${hidden ? 'sr-only' : ''}`}
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir caso permanentemente?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é <strong>irreversível</strong>. O caso "{caseTitle}" e todos os seus dados 
            associados (documentos, prazos, despesas, eventos, etc.) serão excluídos permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Sim, excluir permanentemente'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
