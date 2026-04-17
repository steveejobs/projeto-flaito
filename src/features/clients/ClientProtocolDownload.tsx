import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Download, Loader2, Package, FileText, FileImage, 
  File, CheckSquare, Square, Check
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Props = { 
  clientId: string;
  officeId: string;
};

type SelectableFile = {
  id: string;
  kind: string;
  name: string;
  category: 'kit' | 'anexo';
  exists: boolean;
  storage_bucket?: string;
  storage_path?: string;
  mime_type?: string | null;
  file_size?: number | null;
  selected: boolean;
};

// Estrutura fixa de todos os tipos possíveis
const ALL_KIT_TYPES = [
  { kind: 'KIT_PROCURACAO', label: 'Procuração' },
  { kind: 'KIT_DECLARACAO', label: 'Declaração de Hipossuficiência' },
  { kind: 'KIT_CONTRATO', label: 'Contrato de Honorários' },
  { kind: 'KIT_RECIBO', label: 'Recibo de Pagamento' },
];

const ALL_ATTACHMENT_TYPES = [
  { kind: 'IDENTIDADE', label: 'Documento de Identidade' },
  { kind: 'CPF_CNPJ', label: 'CPF / CNPJ' },
  { kind: 'COMPROVANTE_ENDERECO', label: 'Comprovante de Endereço' },
  { kind: 'COMPROVANTE_RENDA', label: 'Comprovante de Renda' },
  { kind: 'CONTRATO_ASSINADO', label: 'Contrato Assinado' },
];

const CATEGORY_LABELS: Record<string, string> = {
  kit: 'Kit do Cliente',
  anexo: 'Anexos',
};

const CATEGORY_ORDER: ('kit' | 'anexo')[] = ['kit', 'anexo'];

export function ClientProtocolDownload({ clientId, officeId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [files, setFiles] = useState<SelectableFile[]>([]);
  const [clientName, setClientName] = useState('CLIENTE');

  // Carrega todos os arquivos disponíveis
  const loadFiles = async () => {
    setLoading(true);

    try {
      // Buscar primeiro nome do cliente
      const { data: clientData } = await supabase
        .from('clients')
        .select('full_name')
        .eq('id', clientId)
        .single();

      const fullName = clientData?.full_name?.trim() || 'CLIENTE';
      setClientName(fullName);

      // Buscar arquivos existentes do cliente
      const { data: clientFiles } = await supabase
        .from('client_files')
        .select('id, file_name, storage_bucket, storage_path, mime_type, file_size, kind')
        .eq('client_id', clientId);

      // Criar mapa de arquivos existentes por kind
      const existingByKind: Record<string, any> = {};
      if (clientFiles) {
        clientFiles.forEach((file: any) => {
          existingByKind[file.kind] = file;
        });
      }

      // Montar lista combinando tipos fixos + dados existentes
      const allFiles: SelectableFile[] = [];

      // Kit do Cliente
      ALL_KIT_TYPES.forEach((type) => {
        const existing = existingByKind[type.kind];
        allFiles.push({
          id: existing?.id || `placeholder-${type.kind}`,
          kind: type.kind,
          name: type.label,
          category: 'kit',
          exists: !!existing,
          storage_bucket: existing?.storage_bucket,
          storage_path: existing?.storage_path,
          mime_type: existing?.mime_type,
          file_size: existing?.file_size,
          selected: !!existing, // Pré-selecionado se existir
        });
      });

      // Anexos
      ALL_ATTACHMENT_TYPES.forEach((type) => {
        const existing = existingByKind[type.kind];
        allFiles.push({
          id: existing?.id || `placeholder-${type.kind}`,
          kind: type.kind,
          name: type.label,
          category: 'anexo',
          exists: !!existing,
          storage_bucket: existing?.storage_bucket,
          storage_path: existing?.storage_path,
          mime_type: existing?.mime_type,
          file_size: existing?.file_size,
          selected: false, // Anexos não são pré-selecionados
        });
      });

      setFiles(allFiles);
    } catch (err) {
      console.error("[ClientProtocolDownload] Load error:", err);
      toast.error("Erro ao carregar arquivos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadFiles();
    }
  }, [open, clientId]);

  const toggleFile = (id: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id && f.exists ? { ...f, selected: !f.selected } : f
    ));
  };

  const selectAll = () => {
    setFiles(prev => prev.map(f => f.exists ? { ...f, selected: true } : f));
  };

  const selectNone = () => {
    setFiles(prev => prev.map(f => ({ ...f, selected: false })));
  };

  const existingFiles = files.filter(f => f.exists);
  const selectedCount = files.filter(f => f.selected).length;

  // Normaliza HTML para garantir estrutura completa (DOCTYPE + html + head + body)
  const normalizeHtml = (html: string): string => {
    const trimmed = html.trim();
    
    // Se já tem DOCTYPE, retorna como está
    if (trimmed.toLowerCase().startsWith('<!doctype')) {
      return trimmed;
    }
    
    // Se começa com <html>, adiciona apenas DOCTYPE
    if (trimmed.toLowerCase().startsWith('<html')) {
      return `<!DOCTYPE html>\n${trimmed}`;
    }
    
    // Caso contrário, envolve em estrutura HTML completa
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20mm; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
${trimmed}
</body>
</html>`;
  };

  // Gera e baixa o ZIP
  const handleDownload = async () => {
    const selectedFiles = files.filter(f => f.selected && f.exists);
    if (selectedFiles.length === 0) {
      toast.error("Selecione pelo menos um arquivo");
      return;
    }

    setGenerating(true);
    toast.loading("Preparando pacote para protocolo...", { id: 'protocol-zip' });

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      let successCount = 0;
      let errorCount = 0;

      for (const file of selectedFiles) {
        try {
          if (!file.storage_bucket || !file.storage_path) {
            errorCount++;
            continue;
          }

          let blob: Blob;

          // Obtém URL assinada do storage
          const { data: signedData, error: signedError } = await supabase.storage
            .from(file.storage_bucket)
            .createSignedUrl(file.storage_path, 300);

          if (signedError || !signedData?.signedUrl) {
            console.error(`[ClientProtocolDownload] Signed URL error for ${file.name}:`, signedError);
            errorCount++;
            continue;
          }

          const response = await fetch(signedData.signedUrl);
          if (!response.ok) {
            errorCount++;
            continue;
          }
          blob = await response.blob();

          // Verifica tipo do arquivo
          let mimeType = file.mime_type;
          const isPdf = file.storage_path?.endsWith('.pdf') || file.mime_type === 'application/pdf';
          const isHtml = file.storage_path?.endsWith('.html') || file.mime_type === 'text/html';
          
          if (isPdf) {
            mimeType = 'application/pdf';
          } else if (isHtml) {
            // Converter HTML para PDF via server-side (PDFShift)
            let htmlText = await blob.text();
            
            // Normaliza HTML para garantir DOCTYPE (documentos legados podem não ter)
            htmlText = normalizeHtml(htmlText);
            
            try {
              const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
                'lexos-html-to-pdf',
                { body: { html: htmlText } }
              );
              
              if (pdfError || !pdfData?.ok) {
                console.error(`[ClientProtocolDownload] PDF conversion failed for ${file.name}:`, pdfError || pdfData?.reason);
                mimeType = 'text/html';
              } else {
                // Sucesso: usar o PDF gerado
                const pdfBytes = Uint8Array.from(atob(pdfData.pdf_base64), c => c.charCodeAt(0));
                blob = new Blob([pdfBytes], { type: 'application/pdf' });
                mimeType = 'application/pdf';
                console.log(`[ClientProtocolDownload] Converted ${file.name} to PDF via PDFShift`);
              }
            } catch (e) {
              console.error(`[ClientProtocolDownload] PDF conversion error for ${file.name}:`, e);
              mimeType = 'text/html';
            }
          }

          // Determina extensão
          let extension = '';
          if (mimeType) {
            const mimeExtMap: Record<string, string> = {
              'text/html': '.html',
              'application/pdf': '.pdf',
              'image/png': '.png',
              'image/jpeg': '.jpg',
              'application/msword': '.doc',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            };
            extension = mimeExtMap[mimeType] || '';
          }
          if (!extension && file.storage_path?.includes('.')) {
            extension = '.' + file.storage_path.split('.').pop();
          }

          // Nome do arquivo: NomeDoArquivo.extensao
          const safeName = file.name
            .replace(/[^a-zA-Z0-9_\-\sáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g, '_')
            .replace(/\s+/g, '_');
          const fileName = `${safeName}${extension}`;

          // Estrutura: processo/NomeDoCliente/arquivo
          const safeClientName = clientName
            .replace(/[^a-zA-Z0-9_\-\sáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g, '_')
            .replace(/\s+/g, ' ')
            .trim();
          const folderPath = `processo/${safeClientName}`;
          zip.file(`${folderPath}/${fileName}`, blob);
          successCount++;

        } catch (fileErr) {
          console.error(`[ClientProtocolDownload] Error processing ${file.name}:`, fileErr);
          errorCount++;
        }
      }

      if (successCount === 0) {
        toast.dismiss('protocol-zip');
        toast.error("Não foi possível baixar nenhum arquivo");
        return;
      }

      // Gera o ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Baixa o arquivo
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const safeClientNameZip = clientName.replace(/[^a-zA-Z0-9_\-áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g, '_');
      a.download = `Processo_${safeClientNameZip}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.dismiss('protocol-zip');
      
      if (errorCount > 0) {
        toast.warning(`Pacote gerado com ${successCount} arquivo(s). ${errorCount} arquivo(s) com erro.`);
      } else {
        toast.success(`Pacote com ${successCount} arquivo(s) baixado com sucesso!`);
      }

      setOpen(false);
    } catch (err) {
      console.error("[ClientProtocolDownload] ZIP error:", err);
      toast.dismiss('protocol-zip');
      toast.error("Erro ao gerar pacote");
    } finally {
      setGenerating(false);
    }
  };

  const getFileIcon = (category: 'kit' | 'anexo', mimeType?: string | null) => {
    if (category === 'kit') return <FileText className="h-4 w-4 text-amber-500" />;
    if (mimeType?.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (mimeType?.includes('image')) return <FileImage className="h-4 w-4 text-green-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Agrupa arquivos por categoria
  const groupedFiles = CATEGORY_ORDER.reduce((acc, cat) => {
    const catFiles = files.filter(f => f.category === cat);
    if (catFiles.length > 0) {
      acc[cat] = catFiles;
    }
    return acc;
  }, {} as Record<string, SelectableFile[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Package className="h-4 w-4" />
          Baixar para Protocolo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pacote para Protocolo eProc
          </DialogTitle>
          <DialogDescription>
            Selecione os arquivos que deseja incluir no pacote ZIP para protocolar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando arquivos...
          </div>
        ) : (
          <>
            {/* Controles de seleção */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedCount} de {existingFiles.length} disponível(is) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                  <CheckSquare className="h-3 w-3 mr-1" />
                  Todos
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone} className="h-7 text-xs">
                  <Square className="h-3 w-3 mr-1" />
                  Nenhum
                </Button>
              </div>
            </div>

            {/* Lista de arquivos agrupados */}
            <ScrollArea className="max-h-[300px] pr-3">
              <div className="space-y-4">
                {Object.entries(groupedFiles).map(([category, catFiles]) => (
                  <div key={category}>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {CATEGORY_LABELS[category]}
                    </h4>
                    <div className="space-y-1">
                      {catFiles.map((file) => (
                        <label
                          key={file.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-md transition-colors",
                            !file.exists && "opacity-50 cursor-not-allowed",
                            file.exists && file.selected && "bg-primary/5 border border-primary/20 cursor-pointer",
                            file.exists && !file.selected && "hover:bg-muted/50 border border-transparent cursor-pointer"
                          )}
                        >
                          <Checkbox
                            checked={file.selected}
                            disabled={!file.exists}
                            onCheckedChange={() => file.exists && toggleFile(file.id)}
                          />
                          {getFileIcon(file.category, file.mime_type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            {file.exists ? (
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.file_size)}
                              </p>
                            ) : (
                              <p className="text-xs text-amber-600">Não disponível</p>
                            )}
                          </div>
                          {file.exists && (
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button 
            onClick={handleDownload} 
            disabled={loading || generating || selectedCount === 0}
            className="gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Baixar ZIP ({selectedCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
