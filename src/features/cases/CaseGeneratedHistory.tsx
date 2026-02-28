import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Eye, RefreshCw, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type GeneratedDocument = Tables<'generated_documents'>;

interface CaseGeneratedHistoryProps {
  caseId: string;
}

export function CaseGeneratedHistory({ caseId }: CaseGeneratedHistoryProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<GeneratedDocument | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('generated_documents')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setDocuments(data || []);
      setError(null);
    } catch (err: any) {
      setError('Erro ao carregar histórico');
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openPreview = async (doc: GeneratedDocument) => {
    setPreviewDoc(doc);
    setPreviewContent('');
    setPreviewOpen(true);
    setLoadingPreview(true);

    try {
      if (!doc.template_id || !doc.data_used) {
        setPreviewContent('Dados insuficientes para renderizar preview.');
        setLoadingPreview(false);
        return;
      }

      const { data, error } = await supabase.rpc('render_template_preview', {
        p_template_id: doc.template_id,
        p_data: doc.data_used,
      });

      if (error) throw error;

      // render_template_preview retorna TEXT direto (string HTML)
      if (typeof data === 'string' && data.trim()) {
        setPreviewContent(data);
      } else {
        setPreviewContent('Erro: Template renderizou conteúdo vazio');
      }
    } catch (err: any) {
      setPreviewContent(`Erro: ${err.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando histórico...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchDocuments} variant="outline" size="sm" className="mt-3">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Histórico de Documentos Gerados</CardTitle>
          <Button onClick={fetchDocuments} variant="ghost" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead className="table-cell-actions w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableEmptyState colSpan={3} message="Nenhum documento gerado para este caso." />
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead className="table-cell-actions w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="table-cell-secondary">{formatDate(doc.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {doc.template_id?.slice(0, 8) || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="table-cell-actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openPreview(doc)}
                        title="Ver dados e preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documento Gerado</DialogTitle>
            <DialogDescription>
              Gerado em {previewDoc ? formatDate(previewDoc.created_at) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Dados Utilizados</h3>
              <ScrollArea className="h-[300px] border rounded-md p-3 bg-muted/30">
                <pre className="whitespace-pre-wrap text-xs font-mono">
                  {previewDoc?.data_used 
                    ? JSON.stringify(previewDoc.data_used, null, 2) 
                    : 'Nenhum dado disponível'}
                </pre>
              </ScrollArea>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Preview Renderizado</h3>
              <ScrollArea className="h-[300px] border rounded-md p-3 bg-muted/30">
                {loadingPreview ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-mono">{previewContent}</pre>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
