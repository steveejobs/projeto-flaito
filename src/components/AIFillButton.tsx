import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIFillButtonProps {
  caseId?: string;
  templateId: string;
  formDraft?: Record<string, any>;
  onFillComplete: (output: Record<string, any>) => void;
  disabled?: boolean;
}

export function AIFillButton({ caseId, templateId, formDraft = {}, onFillComplete, disabled }: AIFillButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      abortRef.current = true;
    };
  }, []);

  const handleAIFill = async () => {
    if (!templateId) {
      toast({ title: 'Erro', description: 'Selecione um template primeiro', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setStatus('Iniciando...');
    abortRef.current = false;

    try {
      const { data, error } = await supabase.rpc('enqueue_ai_fill_job', {
        p_case_id: caseId || null,
        p_template_id: templateId,
        p_input: formDraft,
      });

      if (error) {
        // Check for quota exceeded
        if (error.message?.includes('ai_quota_exceeded')) {
          toast({ 
            title: 'Limite atingido', 
            description: 'Você atingiu o limite de uso da IA neste mês.', 
            variant: 'destructive' 
          });
          setLoading(false);
          setStatus('');
          return;
        }
        throw error;
      }

      const jobId = data as string;
      toast({ title: 'Processando', description: 'Preenchendo com IA...' });
      setStatus('queued');

      // Start polling
      pollJobStatus(jobId);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao iniciar preenchimento', variant: 'destructive' });
      setLoading(false);
      setStatus('');
    }
  };

  const pollJobStatus = (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 60 * 3s = 3 min max

    pollingRef.current = setInterval(async () => {
      if (abortRef.current) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }

      attempts++;

      try {
        const { data, error } = await supabase
          .from('template_ai_jobs')
          .select('status, output, error')
          .eq('id', jobId)
          .single();

        if (error) throw error;

        setStatus(data.status);

        if (data.status === 'done' && data.output) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          toast({ title: 'Sucesso', description: 'Preenchimento com IA concluído' });
          setLoading(false);
          setStatus('');
          onFillComplete(data.output as Record<string, any>);
          return;
        }

        if (data.status === 'failed' || data.status === 'error') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          
          const errorMsg = data.error || 'Falha no preenchimento';
          
          // Check for quota exceeded in error message
          if (errorMsg.includes('ai_quota_exceeded') || errorMsg.includes('quota')) {
            toast({ 
              title: 'Limite atingido', 
              description: 'Você atingiu o limite de uso da IA neste mês.', 
              variant: 'destructive' 
            });
          } else {
            toast({ title: 'Erro', description: errorMsg, variant: 'destructive' });
          }
          
          setLoading(false);
          setStatus('');
          return;
        }

        if (attempts >= maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          toast({ title: 'Timeout', description: 'Processamento demorou demais', variant: 'destructive' });
          setLoading(false);
          setStatus('');
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Don't stop polling on transient errors
        if (attempts >= maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setLoading(false);
          setStatus('');
        }
      }
    }, 3000); // Poll every 3 seconds
  };

  const getStatusText = () => {
    switch (status) {
      case 'queued': return 'Na fila...';
      case 'processing': return 'Processando...';
      default: return 'Preencher com IA';
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleAIFill}
      disabled={disabled || loading || !templateId}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
          {getStatusText()}
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-1" />
          Preencher com IA
        </>
      )}
    </Button>
  );
}
