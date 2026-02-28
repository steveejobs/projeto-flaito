import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { consumeQuota, getSecurityErrorMessage, QUOTA_ERROR_MSG, mbFromFile } from '@/lib/securityUtils';

interface DocumentFileActionsProps {
  documentId: string; // generated_docs.id
  hasFile?: boolean;
  onUploadComplete?: (newDocumentId?: string) => void;
  caseId?: string;
  officeId?: string;
  docTitle?: string;
  existingDocumentId?: string | null; // documents.id if already linked
}

export function DocumentFileActions({ 
  documentId, 
  hasFile = false, 
  onUploadComplete,
  caseId,
  officeId,
  docTitle,
  existingDocumentId
}: DocumentFileActionsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // QUOTA CHECK: Calculate MB and verify storage quota before upload
      const mb = mbFromFile(file);
      const quotaResult = await consumeQuota('storage_mb', mb);
      if (!quotaResult.ok) {
        toast({
          title: 'Limite atingido',
          description: QUOTA_ERROR_MSG,
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      // Get signed upload URL from edge function
      const { data, error } = await supabase.functions.invoke('createSignedUploadUrl', {
        body: { documentId, fileName: file.name },
      });

      if (error || !data?.signedUrl) {
        throw new Error(data?.error || error?.message || 'Falha ao obter URL de upload');
      }

      // Upload file to the signed URL via PUT
      const uploadResponse = await fetch(data.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Falha no upload do arquivo');
      }

      let linkedDocumentId = existingDocumentId;

      // If documents.id already exists, update it
      if (existingDocumentId) {
        const { error: updateDocError } = await supabase
          .from('documents')
          .update({
            storage_path: data.path,
            storage_bucket: data.bucket || 'case-documents',
            mime_type: file.type,
            file_size: file.size,
            filename: file.name,
            uploaded_at: new Date().toISOString(),
          })
          .eq('id', existingDocumentId);

        if (updateDocError) {
          console.error('Failed to update documents:', updateDocError);
        }
      } else if (caseId && officeId && user) {
        // Create a new documents record
        const { data: newDoc, error: insertDocError } = await supabase
          .from('documents')
          .insert({
            office_id: officeId,
            case_id: caseId,
            filename: file.name || docTitle || 'Documento.pdf',
            mime_type: file.type,
            file_size: file.size,
            storage_bucket: data.bucket || 'case-documents',
            storage_path: data.path,
            uploaded_by: user.id,
            kind: 'OUTRO' as const,
          })
          .select('id')
          .single();

        if (insertDocError) {
          console.error('Failed to create documents record:', insertDocError);
        } else if (newDoc) {
          linkedDocumentId = newDoc.id;

          // Link the generated_doc to the new documents record
          const { error: linkError } = await supabase
            .from('generated_docs_legacy')
            .update({ document_id: linkedDocumentId })
            .eq('id', documentId);

          if (linkError) {
            console.error('Failed to link document_id:', linkError);
          }
        }
      }

      // Update generated_docs_legacy with file_path
      const { error: updateError } = await supabase
        .from('generated_docs_legacy')
        .update({ file_path: data.path, mime_type: file.type })
        .eq('id', documentId);

      if (updateError) {
        console.error('Failed to update generated_doc:', updateError);
        throw new Error('Arquivo enviado, mas falha ao atualizar documento');
      }

      toast({ title: 'Sucesso', description: 'Arquivo enviado com sucesso!' });
      onUploadComplete?.(linkedDocumentId || undefined);
    } catch (err: unknown) {
      console.error('Upload error:', err);
      const errorMessage = getSecurityErrorMessage(err);
      toast({
        title: 'Erro no upload',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('createSignedDownloadUrl', {
        body: { documentId },
      });

      if (error || !data?.signedUrl) {
        throw new Error(data?.error || error?.message || 'Falha ao obter URL de download');
      }

      // Open signed URL in new tab
      window.open(data.signedUrl, '_blank');
    } catch (err: unknown) {
      console.error('Download error:', err);
      const errorMessage = getSecurityErrorMessage(err);
      toast({
        title: 'Erro no download',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="*/*"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={handleUploadClick}
        disabled={uploading}
        title="Upload de arquivo"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      </Button>
      {hasFile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          disabled={downloading}
          title="Download do arquivo"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}