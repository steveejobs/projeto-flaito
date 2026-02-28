import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  AlertTriangle,
  Eye,
  Check,
  X,
  Calendar,
  Users,
  FileSearch,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExtractedContent {
  docId: string;
  docName: string;
  rawText: string;
  snippets: ExtractedSnippet[];
  selectedText: string;
}

interface ExtractedSnippet {
  type: 'date' | 'party' | 'object' | 'deadline' | 'clause';
  label: string;
  text: string;
  selected: boolean;
}

interface NijaDocumentContentExtractorProps {
  documents: Array<{
    id: string;
    filename: string;
    kind: string;
    storage_path?: string;
    mime_type?: string;
    extracted_text?: string | null;
  }>;
  selectedDocIds: string[];
  onContentChange: (content: string) => void;
  disabled?: boolean;
}

const DEFAULT_CHAR_LIMIT = 8000;
const MIN_CHAR_LIMIT = 1000;
const MAX_CHAR_LIMIT = 20000;

// Regex patterns for extracting relevant legal snippets (Portuguese)
const EXTRACTION_PATTERNS = {
  date: [
    /(?:em|data|dia|desde|até|a partir de|desde)\s*(?:de)?\s*(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{2,4})/gi,
    /(\d{1,2}\s*de\s*(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*de\s*\d{2,4})/gi,
    /(?:prazo|vencimento|vigência|validade).*?(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{2,4})/gi,
  ],
  party: [
    /(?:contratante|contratado|locador|locatário|cedente|cessionário|credor|devedor|autor|réu|requerente|requerido|exequente|executado|parte)[\s:]+([A-ZÀ-Ú][^,\n]{3,100})/gi,
    /(?:CPF|CNPJ)[\s:nº]*(\d{2,3}[\.\d\-\/]+\d{2})/gi,
    /(?:inscrito\s+no\s+(?:CPF|CNPJ)|portador\s+do\s+(?:CPF|CNPJ)).*?(\d{2,3}[\.\d\-\/]+\d{2})/gi,
  ],
  object: [
    /(?:objeto|do\s+presente|finalidade|cláusula\s+primeira|cláusula\s+1)[\s:]+([^\n]{20,300})/gi,
    /(?:tem\s+por\s+objeto|consiste\s+em)[\s:]+([^\n]{20,300})/gi,
  ],
  deadline: [
    /(?:prazo|período|vigência|duração)[\s:de]*(\d+\s*(?:dias?|meses?|anos?|horas?))/gi,
    /(?:no\s+prazo\s+de|dentro\s+de|em\s+até)[\s:]*(\d+\s*(?:dias?|meses?|anos?|horas?))/gi,
    /(?:prescrição|decadência|caducidade)[\s:de]*(\d+\s*(?:dias?|meses?|anos?))/gi,
  ],
  clause: [
    /(?:cláusula|artigo|parágrafo|§|inciso)[\s\d]+[º°ª\-:\.\s]+([^\n]{20,400})/gi,
    /(?:condição\s+resolutiva|condição\s+suspensiva|multa|penalidade|rescisão|resolução)[\s:]+([^\n]{20,300})/gi,
  ],
};

export function NijaDocumentContentExtractor({
  documents,
  selectedDocIds,
  onContentChange,
  disabled = false,
}: NijaDocumentContentExtractorProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [charLimit, setCharLimit] = useState(DEFAULT_CHAR_LIMIT);
  const [processing, setProcessing] = useState(false);
  const [extractedContents, setExtractedContents] = useState<ExtractedContent[]>([]);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(true);

  const selectedDocs = useMemo(() => 
    documents.filter(d => selectedDocIds.includes(d.id)),
    [documents, selectedDocIds]
  );

  // Extract snippets from text using patterns
  const extractSnippets = useCallback((text: string): ExtractedSnippet[] => {
    const snippets: ExtractedSnippet[] = [];
    const seen = new Set<string>();

    const addSnippet = (type: ExtractedSnippet['type'], label: string, matchText: string) => {
      const normalized = matchText.trim().toLowerCase();
      if (!seen.has(normalized) && matchText.trim().length > 3) {
        seen.add(normalized);
        snippets.push({
          type,
          label,
          text: matchText.trim(),
          selected: true, // default selected
        });
      }
    };

    // Extract dates
    EXTRACTION_PATTERNS.date.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        addSnippet('date', 'Data', match[0]);
      }
    });

    // Extract parties
    EXTRACTION_PATTERNS.party.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        addSnippet('party', 'Parte', match[0]);
      }
    });

    // Extract object
    EXTRACTION_PATTERNS.object.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        addSnippet('object', 'Objeto', match[1] || match[0]);
      }
    });

    // Extract deadlines
    EXTRACTION_PATTERNS.deadline.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        addSnippet('deadline', 'Prazo', match[0]);
      }
    });

    // Extract clauses (limit to first 5)
    let clauseCount = 0;
    EXTRACTION_PATTERNS.clause.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null && clauseCount < 5) {
        addSnippet('clause', 'Cláusula', match[0]);
        clauseCount++;
      }
    });

    return snippets.slice(0, 20); // Limit total snippets
  }, []);

  // Process documents and extract content
  const processDocuments = useCallback(async () => {
    if (selectedDocs.length === 0) {
      toast({
        title: 'Nenhum documento selecionado',
        description: 'Selecione documentos para extrair conteúdo.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    const extracted: ExtractedContent[] = [];

    for (const doc of selectedDocs) {
      try {
        // Use extracted_text if available (from documents table)
        let rawText = doc.extracted_text || '';
        
        if (!rawText) {
          // Simulate extraction for demo - in production, this would call OCR service
          rawText = `[Conteúdo do documento: ${doc.filename}]\n\nTexto extraído não disponível. O documento ${doc.filename} (${doc.kind}) requer processamento OCR que não está disponível nesta demonstração.\n\nPara documentos com texto extraído, os trechos relevantes aparecerão aqui automaticamente.`;
        }

        const snippets = extractSnippets(rawText);
        
        extracted.push({
          docId: doc.id,
          docName: doc.filename,
          rawText,
          snippets,
          selectedText: snippets.filter(s => s.selected).map(s => s.text).join('\n\n'),
        });
      } catch (err) {
        console.error(`Error processing document ${doc.filename}:`, err);
      }
    }

    setExtractedContents(extracted);
    setExpandedDocs(new Set(extracted.map(e => e.docId)));
    
    // Notify parent with combined selected text
    updateParentContent(extracted);
    
    setProcessing(false);
    
    if (extracted.length > 0) {
      toast({
        title: 'Conteúdo extraído',
        description: `${extracted.length} documento(s) processado(s). Revise os trechos selecionados.`,
      });
    }
  }, [selectedDocs, extractSnippets, toast]);

  // Update parent component with selected content
  const updateParentContent = useCallback((contents: ExtractedContent[]) => {
    const combined = contents
      .map(c => {
        const selected = c.snippets.filter(s => s.selected).map(s => s.text).join('\n');
        return selected ? `[${c.docName}]\n${selected}` : '';
      })
      .filter(Boolean)
      .join('\n\n---\n\n');
    
    // Apply character limit
    const limited = combined.slice(0, charLimit);
    onContentChange(limited);
  }, [charLimit, onContentChange]);

  // Toggle snippet selection
  const toggleSnippet = useCallback((docId: string, snippetIndex: number) => {
    setExtractedContents(prev => {
      const updated = prev.map(content => {
        if (content.docId === docId) {
          const newSnippets = [...content.snippets];
          newSnippets[snippetIndex] = {
            ...newSnippets[snippetIndex],
            selected: !newSnippets[snippetIndex].selected,
          };
          return {
            ...content,
            snippets: newSnippets,
            selectedText: newSnippets.filter(s => s.selected).map(s => s.text).join('\n\n'),
          };
        }
        return content;
      });
      
      // Update parent
      updateParentContent(updated);
      return updated;
    });
  }, [updateParentContent]);

  // Update custom text for a document
  const updateCustomText = useCallback((docId: string, text: string) => {
    setExtractedContents(prev => {
      const updated = prev.map(content => {
        if (content.docId === docId) {
          return { ...content, selectedText: text };
        }
        return content;
      });
      updateParentContent(updated);
      return updated;
    });
  }, [updateParentContent]);

  // Toggle document expansion
  const toggleDocExpansion = useCallback((docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  // Get icon for snippet type
  const getSnippetIcon = (type: ExtractedSnippet['type']) => {
    switch (type) {
      case 'date': return <Calendar className="h-3 w-3" />;
      case 'party': return <Users className="h-3 w-3" />;
      case 'object': return <FileSearch className="h-3 w-3" />;
      case 'deadline': return <AlertTriangle className="h-3 w-3" />;
      case 'clause': return <FileText className="h-3 w-3" />;
    }
  };

  // Calculate total selected characters
  const totalSelectedChars = useMemo(() => {
    return extractedContents
      .map(c => c.snippets.filter(s => s.selected).map(s => s.text).join('\n').length)
      .reduce((a, b) => a + b, 0);
  }, [extractedContents]);

  // Handle enable/disable toggle
  const handleToggle = useCallback((checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      // Clear extracted content when disabled
      setExtractedContents([]);
      onContentChange('');
    }
  }, [onContentChange]);

  if (selectedDocIds.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Toggle Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="use-doc-content"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={disabled}
          />
          <Label 
            htmlFor="use-doc-content" 
            className="text-sm font-medium cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Usar conteúdo dos documentos anexados
          </Label>
        </div>
        {enabled && (
          <Badge variant="outline" className="text-xs">
            {selectedDocIds.length} doc(s)
          </Badge>
        )}
      </div>

      {/* Enabled Content */}
      {enabled && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 space-y-4">
            {/* Character Limit Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Limite de caracteres para envio
                </Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {charLimit.toLocaleString()} chars
                </span>
              </div>
              <Slider
                value={[charLimit]}
                onValueChange={(v) => setCharLimit(v[0])}
                min={MIN_CHAR_LIMIT}
                max={MAX_CHAR_LIMIT}
                step={500}
                className="w-full"
                disabled={disabled}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{MIN_CHAR_LIMIT.toLocaleString()}</span>
                <span>{MAX_CHAR_LIMIT.toLocaleString()}</span>
              </div>
            </div>

            {/* Process Button */}
            {extractedContents.length === 0 && (
              <Button
                onClick={processDocuments}
                disabled={processing || disabled}
                size="sm"
                className="w-full"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando documentos...
                  </>
                ) : (
                  <>
                    <FileSearch className="h-4 w-4 mr-2" />
                    Extrair conteúdo relevante
                  </>
                )}
              </Button>
            )}

            {/* Extracted Content Preview */}
            {extractedContents.length > 0 && (
              <div className="space-y-3">
                {/* Usage Stats */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Caracteres selecionados: {totalSelectedChars.toLocaleString()} / {charLimit.toLocaleString()}
                  </span>
                  {totalSelectedChars > charLimit && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                      Excede limite
                    </Badge>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      totalSelectedChars > charLimit ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, (totalSelectedChars / charLimit) * 100)}%` }}
                  />
                </div>

                {/* Toggle Preview */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full text-xs"
                >
                  {showPreview ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {showPreview ? 'Ocultar pré-visualização' : 'Mostrar pré-visualização'}
                </Button>

                {/* Document Content Cards */}
                {showPreview && (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-3">
                      {extractedContents.map((content) => (
                        <Card key={content.docId} className="border">
                          <Collapsible
                            open={expandedDocs.has(content.docId)}
                            onOpenChange={() => toggleDocExpansion(content.docId)}
                          >
                            <CardHeader className="py-2 px-3">
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-1 -m-1">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <CardTitle className="text-sm font-medium truncate max-w-[200px]">
                                      {content.docName}
                                    </CardTitle>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {content.snippets.filter(s => s.selected).length}/{content.snippets.length} trechos
                                    </Badge>
                                  </div>
                                  {expandedDocs.has(content.docId) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </div>
                              </CollapsibleTrigger>
                            </CardHeader>

                            <CollapsibleContent>
                              <CardContent className="py-2 px-3 space-y-3">
                                {/* Extracted Snippets */}
                                {content.snippets.length > 0 ? (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                      Trechos extraídos (clique para selecionar/desselecionar)
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                      {content.snippets.map((snippet, idx) => (
                                        <Button
                                          key={idx}
                                          variant={snippet.selected ? 'default' : 'outline'}
                                          size="sm"
                                          className={`text-xs h-auto py-1 px-2 max-w-full ${
                                            snippet.selected 
                                              ? 'bg-primary/90 hover:bg-primary' 
                                              : 'hover:bg-muted'
                                          }`}
                                          onClick={() => toggleSnippet(content.docId, idx)}
                                          disabled={disabled}
                                        >
                                          {getSnippetIcon(snippet.type)}
                                          <span className="ml-1 truncate max-w-[150px]">
                                            {snippet.text.slice(0, 50)}
                                            {snippet.text.length > 50 ? '...' : ''}
                                          </span>
                                          {snippet.selected ? (
                                            <Check className="h-3 w-3 ml-1 flex-shrink-0" />
                                          ) : (
                                            <X className="h-3 w-3 ml-1 flex-shrink-0 opacity-50" />
                                          )}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <Alert>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription className="text-xs">
                                      Nenhum trecho relevante extraído automaticamente. 
                                      Edite manualmente o texto abaixo.
                                    </AlertDescription>
                                  </Alert>
                                )}

                                {/* Editable Preview */}
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Eye className="h-3 w-3" />
                                    Texto a enviar (editável)
                                  </Label>
                                  <Textarea
                                    value={content.selectedText}
                                    onChange={(e) => updateCustomText(content.docId, e.target.value)}
                                    className="min-h-[80px] text-xs font-mono"
                                    placeholder="Texto selecionado do documento..."
                                    disabled={disabled}
                                  />
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {/* Re-process Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={processDocuments}
                  disabled={processing || disabled}
                  className="w-full text-xs"
                >
                  <FileSearch className="h-3 w-3 mr-1" />
                  Reprocessar documentos
                </Button>
              </div>
            )}

            {/* Info Alert */}
            <Alert variant="default" className="border-blue-200 bg-blue-50">
              <FileSearch className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs text-blue-700">
                O conteúdo é processado localmente (em memória) e não é salvo no banco de dados. 
                Apenas o texto selecionado será enviado à análise NIJA.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
