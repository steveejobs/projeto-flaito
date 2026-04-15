import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileSignature, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentSignatureButtonProps {
  generatedDocumentId: string;
  documentContent: string;
  onSuccess?: () => void;
  disabled?: boolean;
}

export function DocumentSignatureButton({
  generatedDocumentId,
  documentContent,
  onSuccess,
  disabled,
}: DocumentSignatureButtonProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    signer_name: '',
    signer_doc: '',
    signer_type: 'cliente',
  });

  const calculateHash = async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSign = async () => {
    if (!formData.signer_name.trim() || !formData.signer_doc.trim()) {
      toast({ title: 'Erro', description: 'Nome e documento são obrigatórios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const hash = await calculateHash(documentContent);

      const { data, error } = await supabase.rpc('sign_generated_document', {
        p_generated_document_id: generatedDocumentId,
        p_signer_type: formData.signer_type,
        p_signer_name: formData.signer_name.trim(),
        p_signer_doc: formData.signer_doc.trim(),
        p_signature_base64: '', // Simplified - no actual signature canvas
        p_signed_hash: hash,
        p_metadata: {},
      } as any);

      if (error) throw error;

      // Log document access for compliance
      await supabase.rpc('log_document_access', {
        p_document_id: generatedDocumentId,
        p_action: 'sign',
        p_metadata: { signer_name: formData.signer_name, signer_doc: formData.signer_doc },
      } as any);

      toast({ title: 'Sucesso', description: 'Documento assinado com sucesso' });
      setDialogOpen(false);
      setFormData({ signer_name: '', signer_doc: '', signer_type: 'cliente' });
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
      >
        <FileSignature className="h-4 w-4 mr-1" />
        Assinar
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Assinar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={formData.signer_name}
                onChange={(e) => setFormData({ ...formData, signer_name: e.target.value })}
                placeholder="Nome do signatário"
              />
            </div>
            <div>
              <Label>CPF/CNPJ *</Label>
              <Input
                value={formData.signer_doc}
                onChange={(e) => setFormData({ ...formData, signer_doc: e.target.value })}
                placeholder="Documento do signatário"
              />
            </div>
            <div>
              <Label>Tipo de Signatário</Label>
              <select
                className="w-full h-10 px-3 border rounded-md bg-background"
                value={formData.signer_type}
                onChange={(e) => setFormData({ ...formData, signer_type: e.target.value })}
              >
                <option value="cliente">Cliente</option>
                <option value="advogado">Advogado</option>
                <option value="testemunha">Testemunha</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSign} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}