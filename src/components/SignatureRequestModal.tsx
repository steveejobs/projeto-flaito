import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileSignature } from 'lucide-react';

interface SignatureRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string; // This is the documents.id (physical document)
  documentTitle?: string;
  caseId?: string | null;
  onSuccess?: () => void;
}

const PROVIDER_OPTIONS = [
  { value: 'internal', label: 'Interno (Assinatura Manual)' },
  { value: 'zapsign', label: 'ZapSign' },
  { value: 'docusign', label: 'DocuSign (em breve)', disabled: true },
  { value: 'clicksign', label: 'ClickSign (em breve)', disabled: true },
];

export function SignatureRequestModal({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  caseId,
  onSuccess,
}: SignatureRequestModalProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState('internal');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!documentId) {
      toast({
        title: 'Erro',
        description: 'Documento inválido para solicitar assinatura.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Call RPC to create signature request
      const { error: rpcError } = await supabase.rpc('request_document_signature', {
        p_document_id: documentId,
        p_provider: provider,
      });

      if (rpcError) throw rpcError;

      // If we have a caseId, also log to case_events
      if (caseId) {
        await supabase.from('case_events').insert({
          case_id: caseId,
          event_type: 'signature_requested',
          title: `Assinatura solicitada: ${documentTitle || 'Documento'}`,
          payload: { document_id: documentId, provider },
        });
      }

      toast({
        title: 'Sucesso',
        description: 'Solicitação de assinatura enviada com sucesso.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Signature request error:', err);
      toast({
        title: 'Erro ao solicitar assinatura',
        description: err.message || 'Não foi possível enviar a solicitação.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Solicitar Assinatura
          </DialogTitle>
          <DialogDescription>
            {documentTitle ? (
              <span className="block truncate">Documento: {documentTitle}</span>
            ) : (
              'Confirme a solicitação de assinatura para este documento.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provedor de Assinatura</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Selecione o provedor" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Escolha o método de coleta de assinatura digital.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Confirmar Solicitação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
