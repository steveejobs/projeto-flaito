import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  FileText,
  Download,
  Printer,
  Check,
  AlertTriangle,
  Shield,
  Target,
  Zap,
  Scale,
  Edit2,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NijaPetitionDraftGeneratorProps {
  tipoAnalise: 'prescricao' | 'decadencia';
  naturezaPretensao: string;
  marcoInicial: { data: string; descricao: string };
  cenarioSelecionado?: 'conservador' | 'provavel' | 'agressivo' | null;
  notaTecnica: string;
  caseTitle?: string;
  clientName?: string;
  officeName?: string;
  officeOab?: string;
}

interface DraftSection {
  id: string;
  title: string;
  content: string;
  editable: boolean;
  required: boolean;
}

const CENARIO_CONFIG = {
  conservador: {
    label: 'Conservador',
    icon: Shield,
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    teseIntro: 'Com base em interpretação consolidada da jurisprudência',
  },
  provavel: {
    label: 'Provável',
    icon: Target,
    className: 'bg-amber-100 text-amber-800 border-amber-300',
    teseIntro: 'Com fundamento na linha jurisprudencial majoritária',
  },
  agressivo: {
    label: 'Agressivo',
    icon: Zap,
    className: 'bg-red-100 text-red-800 border-red-300',
    teseIntro: 'Sustentando tese inovadora, com amparo doutrinário e jurisprudencial emergente',
  },
};

const RESPONSIBILITY_CLAUSE = `Este documento foi elaborado com auxílio de ferramenta de apoio à redação jurídica, devendo ser integralmente revisado, adaptado e validado pelo advogado responsável antes de qualquer uso processual. A responsabilidade técnica pelo conteúdo final, adequação ao caso concreto e protocolo perante órgãos jurisdicionais é exclusivamente do profissional subscritor.`;

const JURISPRUDENCE_PLACEHOLDER = `[INSERIR PRECEDENTES VERIFICADOS - OBRIGATÓRIO]

Exemplo de formatação:
- STJ, REsp nº XXX/UF, Rel. Min. [Nome], [Turma], julgado em XX/XX/XXXX, DJe XX/XX/XXXX.
- TJSP, Apelação Cível nº XXXXXXX-XX.XXXX.X.XX.XXXX, Rel. Des. [Nome], [Câmara], j. XX/XX/XXXX.

ATENÇÃO: Não utilize jurisprudência sem verificação prévia em fontes oficiais (sites dos tribunais, bases jurídicas confiáveis). A citação de precedentes inexistentes ou incorretos pode configurar litigância de má-fé.`;

export function NijaPetitionDraftGenerator({
  tipoAnalise,
  naturezaPretensao,
  marcoInicial,
  cenarioSelecionado,
  notaTecnica,
  caseTitle,
  clientName,
  officeName,
  officeOab,
}: NijaPetitionDraftGeneratorProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [humanReviewConfirmed, setHumanReviewConfirmed] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);

  const tipoLabel = tipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição';
  const cenarioConfig = cenarioSelecionado ? CENARIO_CONFIG[cenarioSelecionado] : null;
  const CenarioIcon = cenarioConfig?.icon;

  // Generate draft sections based on NIJA analysis
  const initialSections = useMemo((): DraftSection[] => {
    const preliminarTitle = tipoAnalise === 'decadencia' 
      ? 'DA PRELIMINAR DE DECADÊNCIA' 
      : 'DA PRELIMINAR DE PRESCRIÇÃO';

    const teseIntro = cenarioConfig?.teseIntro || 'Com fundamento na análise técnica realizada';

    // Extract key points from nota tecnica
    const extractFundamentacao = () => {
      const fundMatch = notaTecnica.match(/(?:FUNDAMENTAÇÃO|Fundamentação|FUNDAMENTO|Fundamento)[:\s]*\n?([\s\S]*?)(?=(?:PONTOS?|Pontos?|CONCLUS|Conclus|PRAZO|Prazo|$))/i);
      if (fundMatch) return fundMatch[1].trim();
      
      // Fallback: extract legal references
      const legalRefs = notaTecnica.match(/(?:art(?:igo)?\.?\s*\d+|§\s*\d+|inciso\s+[IVXLCDM]+|Lei\s+(?:n[º°]?\s*)?\d+)/gi);
      if (legalRefs && legalRefs.length > 0) {
        return `Conforme ${legalRefs.slice(0, 5).join(', ')}, entre outros dispositivos aplicáveis ao caso concreto.`;
      }
      return '[Inserir fundamentação legal específica do caso]';
    };

    return [
      {
        id: 'qualificacao',
        title: '1. QUALIFICAÇÃO DAS PARTES',
        content: `${clientName || '[NOME DO CLIENTE]'}, já devidamente qualificado(a) nos autos do processo em epígrafe, vem, respeitosamente, à presença de Vossa Excelência, por seu advogado que esta subscreve, apresentar a presente manifestação, com fundamento nos arts. 337, II e 487, II do CPC, expondo e requerendo o que segue.`,
        editable: true,
        required: true,
      },
      {
        id: 'sintese',
        title: '2. SÍNTESE FÁTICA',
        content: `Trata-se de ${caseTitle || '[descrição da demanda]'}, em que se discute ${naturezaPretensao || '[natureza da pretensão]'}.\n\nO marco inicial para contagem do prazo ${tipoAnalise === 'decadencia' ? 'decadencial' : 'prescricional'} é ${marcoInicial.data || '[data do marco]'} (${marcoInicial.descricao || '[descrição do evento]'}).`,
        editable: true,
        required: true,
      },
      {
        id: 'preliminar',
        title: `3. ${preliminarTitle}`,
        content: `${teseIntro}, sustenta-se que a pretensão ${tipoAnalise === 'decadencia' ? 'está fulminada pela decadência' : 'encontra-se prescrita'}, devendo ser reconhecida de plano por este Juízo.\n\nO prazo ${tipoAnalise === 'decadencia' ? 'decadencial' : 'prescricional'} aplicável à espécie é de [PRAZO] ${tipoAnalise === 'decadencia' ? '(prazo decadencial)' : '(prazo prescricional)'}, conforme será demonstrado a seguir.\n\nConsiderando que o termo a quo (${marcoInicial.data || '[data]'}) já se distancia em período superior ao prazo legal, a ${tipoAnalise === 'decadencia' ? 'decadência' : 'prescrição'} é manifesta.`,
        editable: true,
        required: true,
      },
      {
        id: 'fundamentacao',
        title: '4. FUNDAMENTAÇÃO LEGAL',
        content: extractFundamentacao(),
        editable: true,
        required: true,
      },
      {
        id: 'jurisprudencia',
        title: '5. JURISPRUDÊNCIA APLICÁVEL',
        content: JURISPRUDENCE_PLACEHOLDER,
        editable: true,
        required: true,
      },
      {
        id: 'pedidos',
        title: '6. DOS PEDIDOS',
        content: `Ante o exposto, requer-se:\n\na) O acolhimento da preliminar de ${tipoAnalise === 'decadencia' ? 'decadência' : 'prescrição'}, com a consequente extinção do feito com resolução de mérito, nos termos do art. 487, II, do CPC;\n\nb) Subsidiariamente, caso não seja esse o entendimento de Vossa Excelência, que seja reconhecida a ${tipoAnalise === 'decadencia' ? 'decadência' : 'prescrição'} parcial, abrangendo os periodos anteriores a [DATA];\n\nc) A condenação da parte adversa ao pagamento das custas processuais e honorarios advocaticios, nos termos do art. 85 do CPC.\n\nTermos em que,\nPede deferimento.\n\n[LOCAL], [DATA].\n\n${officeName || '[NOME DO ESCRITORIO]'}${officeOab ? '\n' + officeOab : '\n[OAB/UF no XXXXX]'}`,
        editable: true,
        required: true,
      },
      {
        id: 'responsabilidade',
        title: '7. CLÁUSULA DE RESPONSABILIDADE TÉCNICA',
        content: RESPONSIBILITY_CLAUSE,
        editable: false,
        required: true,
      },
    ];
  }, [tipoAnalise, naturezaPretensao, marcoInicial, cenarioConfig, notaTecnica, caseTitle, clientName, officeName, officeOab]);

  const [sections, setSections] = useState<DraftSection[]>(initialSections);

  const handleUpdateSection = useCallback((sectionId: string, newContent: string) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, content: newContent } : s
    ));
  }, []);

  const handleGenerateDraft = useCallback(() => {
    if (!humanReviewConfirmed) {
      toast({
        title: 'Confirmação obrigatória',
        description: 'Você deve confirmar que fará a revisão humana do rascunho.',
        variant: 'destructive',
      });
      return;
    }
    setSections(initialSections);
    setDraftGenerated(true);
    toast({
      title: 'Rascunho gerado',
      description: 'Revise e edite cada seção antes de exportar.',
    });
  }, [humanReviewConfirmed, initialSections, toast]);

  const fullDraftText = useMemo(() => {
    return sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n---\n\n');
  }, [sections]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullDraftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copiado!', description: 'Rascunho copiado para a área de transferência.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  }, [fullDraftText, toast]);

  const handleExportPdf = useCallback(() => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);

    const now = new Date();
    const printContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Rascunho Petição - ${tipoLabel}</title>
        <style>
          @page { size: A4; margin: 25mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8; color: #000; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .header h1 { font-size: 14pt; margin-bottom: 5px; }
          .header p { font-size: 10pt; color: #666; }
          .section { margin-bottom: 25px; }
          .section-title { font-weight: bold; font-size: 12pt; margin-bottom: 10px; text-transform: uppercase; }
          .section-content { text-align: justify; white-space: pre-wrap; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 15px 0; font-size: 10pt; }
          .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; text-align: center; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; margin-left: 10px; }
          .badge-cenario { background: ${cenarioConfig ? (cenarioSelecionado === 'conservador' ? '#dbeafe' : cenarioSelecionado === 'provavel' ? '#fef3c7' : '#fee2e2') : '#f3f4f6'}; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>RASCUNHO DE PETIÇÃO - ${tipoLabel.toUpperCase()}</h1>
          <p>${officeName || ''}${officeOab ? ` • ${officeOab}` : ''}</p>
          ${cenarioConfig ? `<span class="badge badge-cenario">Cenário: ${cenarioConfig.label}</span>` : ''}
        </div>
        
        <div class="warning">
          ⚠️ DOCUMENTO EM RASCUNHO - REQUER REVISÃO INTEGRAL DO ADVOGADO ANTES DE USO PROCESSUAL
        </div>
        
        ${sections.map(s => `
          <div class="section">
            <div class="section-title">${s.title}</div>
            <div class="section-content">${s.content.replace(/\n/g, '<br>')}</div>
          </div>
        `).join('')}
        
        <div class="footer">
          <p>Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          <p style="margin-top: 5px;">Este documento foi elaborado com auxílio de ferramenta de apoio à redação jurídica e requer revisão integral do advogado responsável.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        setIsExportingPdf(false);
      }, 500);
    } else {
      setIsExportingPdf(false);
      toast({ title: 'Erro', description: 'Não foi possível abrir a janela de impressão.', variant: 'destructive' });
    }
  }, [isExportingPdf, tipoLabel, sections, officeName, officeOab, cenarioConfig, cenarioSelecionado, toast]);

  const handleExportDocx = useCallback(async () => {
    if (isExportingDocx) return;
    setIsExportingDocx(true);

    try {
      const now = new Date();
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Header
            new Paragraph({
              children: [
                new TextRun({ text: `RASCUNHO DE PETIÇÃO - ${tipoLabel.toUpperCase()}`, bold: true, size: 28 }),
              ],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `${officeName || ''}${officeOab ? ` • ${officeOab}` : ''}`, size: 20, color: '666666' }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            cenarioConfig ? new Paragraph({
              children: [
                new TextRun({ text: `Cenário: ${cenarioConfig.label}`, size: 20, italics: true }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }) : new Paragraph({ children: [] }),
            
            // Warning
            new Paragraph({
              children: [
                new TextRun({ text: '⚠️ DOCUMENTO EM RASCUNHO - REQUER REVISÃO INTEGRAL DO ADVOGADO ANTES DE USO PROCESSUAL', bold: true, size: 20, color: 'B45309' }),
              ],
              border: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'FFC107' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'FFC107' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'FFC107' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'FFC107' },
              },
              shading: { fill: 'FFF3CD' },
              spacing: { before: 200, after: 400 },
            }),
            
            // Sections
            ...sections.flatMap(section => [
              new Paragraph({
                children: [
                  new TextRun({ text: section.title, bold: true, size: 24 }),
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
              }),
              ...section.content.split('\n').map(line => 
                new Paragraph({
                  children: [
                    new TextRun({ text: line, size: 24 }),
                  ],
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 100 },
                })
              ),
            ]),
            
            // Footer
            new Paragraph({
              children: [
                new TextRun({ text: `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, size: 18, color: '888888', italics: true }),
              ],
              spacing: { before: 400, after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Este documento foi elaborado com auxílio de ferramenta de apoio à redação jurídica e requer revisão integral do advogado responsável.', size: 18, color: '888888', italics: true }),
              ],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const filename = `rascunho-peticao-${tipoLabel.toLowerCase()}-${now.toISOString().split('T')[0]}.docx`;
      saveAs(blob, filename);
      toast({ title: 'DOCX exportado', description: 'Arquivo baixado com sucesso.' });
    } catch (error) {
      console.error('Erro ao exportar DOCX:', error);
      toast({ title: 'Erro', description: 'Não foi possível gerar o DOCX.', variant: 'destructive' });
    } finally {
      setIsExportingDocx(false);
    }
  }, [isExportingDocx, tipoLabel, sections, officeName, officeOab, cenarioConfig, toast]);

  if (!isOpen) {
    return (
      <Card className="border-dashed border-primary/30 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-medium">Gerar Rascunho Peticionável</h4>
                <p className="text-xs text-muted-foreground">
                  Crie um rascunho estruturado de petição baseado na análise NIJA
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Gerar Rascunho
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Rascunho Peticionável</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {cenarioConfig && CenarioIcon && (
              <Badge variant="outline" className={cenarioConfig.className}>
                <CenarioIcon className="h-3 w-3 mr-1" />
                {cenarioConfig.label}
              </Badge>
            )}
            <Badge variant="outline">{tipoLabel}</Badge>
          </div>
        </div>
        <CardDescription>
          Rascunho estruturado para arguição de {tipoLabel.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!draftGenerated ? (
          <>
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800">
                <strong>Revisão Humana Obrigatória:</strong> O rascunho gerado é apenas um ponto de partida. 
                Você DEVE revisar, adaptar e validar integralmente o conteúdo antes de qualquer uso processual.
                A jurisprudência indicada é um placeholder - você deve inserir precedentes verificados em fontes oficiais.
              </AlertDescription>
            </Alert>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="human-review"
                checked={humanReviewConfirmed}
                onCheckedChange={(checked) => setHumanReviewConfirmed(checked === true)}
              />
              <Label htmlFor="human-review" className="text-xs leading-relaxed cursor-pointer">
                Declaro que compreendo que este é um rascunho que exige revisão técnica integral, 
                substituição de placeholders, verificação de jurisprudência em fontes oficiais, 
                e assumo total responsabilidade pelo documento final.
              </Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleGenerateDraft}
                disabled={!humanReviewConfirmed}
              >
                <FileText className="h-4 w-4 mr-2" />
                Gerar Rascunho
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-[10px] text-amber-800">
                Edite cada seção conforme necessário. A seção de Jurisprudência contém placeholder obrigatório.
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[400px] pr-2">
              <div className="space-y-3">
                {sections.map((section) => (
                  <Collapsible key={section.id} defaultOpen={section.id === 'jurisprudencia'}>
                    <div className="border rounded-lg">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{section.title}</span>
                            {section.id === 'jurisprudencia' && (
                              <Badge variant="destructive" className="text-[9px]">
                                Placeholder - Verificar
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {section.editable && editingSection !== section.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSection(section.id);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3">
                          {editingSection === section.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={section.content}
                                onChange={(e) => handleUpdateSection(section.id, e.target.value)}
                                className="text-xs min-h-[150px] font-mono"
                              />
                              <Button
                                size="sm"
                                className="h-6 text-[10px]"
                                onClick={() => setEditingSection(null)}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                OK
                              </Button>
                            </div>
                          ) : (
                            <div className={`text-xs bg-muted/30 rounded p-2 whitespace-pre-wrap ${
                              section.id === 'jurisprudencia' ? 'bg-amber-50 border border-amber-200' : ''
                            }`}>
                              {section.content}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  setDraftGenerated(false);
                  setHumanReviewConfirmed(false);
                }}
              >
                Fechar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportDocx}
                  disabled={isExportingDocx}
                >
                  {isExportingDocx ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  DOCX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                >
                  {isExportingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
                  PDF
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
