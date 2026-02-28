import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { FileText, FileType, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentExportActionsProps {
  generatedDocumentId: string;
  onJobComplete?: () => void;
}

export function DocumentExportActions({ generatedDocumentId, onJobComplete }: DocumentExportActionsProps) {
  const { toast } = useToast();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const enqueueRenderJob = async (format: 'pdf' | 'docx') => {
    const setLoading = format === 'pdf' ? setPdfLoading : setDocxLoading;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('enqueue_render_job', {
        p_generated_document_id: generatedDocumentId,
        p_format: format,
        p_payload: {},
      });

      if (error) throw error;

      const jobId = data as string;
      setActiveJobId(jobId);
      toast({ title: 'Processando', description: `Gerando ${format.toUpperCase()}...` });

      // Poll for job status
      pollJobStatus(jobId, format);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const pollJobStatus = async (jobId: string, format: string) => {
    const maxAttempts = 30;
    let attempts = 0;
    const setLoading = format === 'pdf' ? setPdfLoading : setDocxLoading;

    const poll = async () => {
      attempts++;
      try {
        const { data, error } = await supabase
          .from('document_render_jobs')
          .select('status, storage_path, error')
          .eq('id', jobId)
          .single();

        if (error) throw error;

        if (data.status === 'done' && data.storage_path) {
          toast({ title: 'Sucesso', description: `${format.toUpperCase()} gerado com sucesso` });
          setLoading(false);
          setActiveJobId(null);
          onJobComplete?.();
          return;
        }

        if (data.status === 'error') {
          toast({ title: 'Erro', description: data.error || 'Falha na geração', variant: 'destructive' });
          setLoading(false);
          setActiveJobId(null);
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          toast({ title: 'Timeout', description: 'Aguardando processamento...', variant: 'destructive' });
          setLoading(false);
          setActiveJobId(null);
        }
      } catch (err) {
        setLoading(false);
        setActiveJobId(null);
      }
    };

    poll();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => enqueueRenderJob('pdf')}
        disabled={pdfLoading || docxLoading}
      >
        {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => enqueueRenderJob('docx')}
        disabled={pdfLoading || docxLoading}
      >
        {docxLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileType className="h-4 w-4 mr-1" />}
        DOCX
      </Button>
    </div>
  );
}