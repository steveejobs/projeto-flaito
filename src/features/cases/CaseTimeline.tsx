import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NijaPetitionDraftGenerator } from '@/components/NijaPetitionDraftGenerator';
import { useToast } from '@/hooks/use-toast';
import { enrichDoc, clearTjtoCache, type EnrichedDoc } from '@/nija';
import { 
  History, 
  Loader2, 
  ChevronDown, 
  ChevronRight,
  Play,
  ArrowRight,
  CheckCircle,
  FileText,
  AlertCircle,
  Clock,
  Scale,
  AlertTriangle,
  Eye,
  Filter,
  Printer,
  ShieldCheck,
  User,
  Download,
  Edit2,
  Check,
  X,
  MessageSquare,
  Shield,
  Target,
  Zap,
  Copy,
  FileDown,
  Bell,
  Save,
  RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Footer, PageNumber } from 'docx';
import { saveAs } from 'file-saver';
import type { Json } from '@/integrations/supabase/types';

interface CaseEvent {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  payload: Json;
  created_at: string;
  created_by: string | null;
}

interface CaseTimelineProps {
  caseId: string;
  caseTitle?: string;
  caseCnj?: string;
  clientName?: string;
  officeName?: string;
  officeOab?: string;
  userRole?: string | null; // 'owner' | 'editor' | 'viewer' | null
  onDocumentSaved?: (docId: string) => void;
}

type TimelineFilter = 'todos' | 'checklist' | 'fase' | 'documentos' | 'nija' | 'nija_prescricao' | 'nija_decadencia';

const FILTER_OPTIONS: { value: TimelineFilter; label: string; subFilter?: boolean }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'fase', label: 'Fase' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'nija', label: 'NIJA' },
];

const NIJA_SUB_FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: 'nija', label: 'Todos' },
  { value: 'nija_prescricao', label: 'Prescrição' },
  { value: 'nija_decadencia', label: 'Decadência' },
];

const EVENT_TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; className: string }> = {
  stage_changed: { 
    icon: ArrowRight, 
    label: 'Mudança de Fase', 
    className: 'text-blue-600 bg-blue-100' 
  },
  task_status: { 
    icon: CheckCircle, 
    label: 'Checklist', 
    className: 'text-green-600 bg-green-100' 
  },
  task_created: { 
    icon: Play, 
    label: 'Tarefa Criada', 
    className: 'text-purple-600 bg-purple-100' 
  },
  cnj_sync: { 
    icon: Clock, 
    label: 'Sincronização CNJ', 
    className: 'text-amber-600 bg-amber-100' 
  },
  doc_created: { 
    icon: FileText, 
    label: 'Documento', 
    className: 'text-indigo-600 bg-indigo-100' 
  },
  doc_export: { 
    icon: FileText, 
    label: 'Exportação', 
    className: 'text-cyan-600 bg-cyan-100' 
  },
  nija_prescription_run: { 
    icon: Scale, 
    label: 'NIJA Prescrição', 
    className: 'text-blue-700 bg-blue-100' 
  },
  nija_decadence_run: { 
    icon: Scale, 
    label: 'NIJA Decadência', 
    className: 'text-purple-700 bg-purple-100' 
  },
  default: { 
    icon: AlertCircle, 
    label: 'Evento', 
    className: 'text-gray-600 bg-gray-100' 
  },
};

// Helper to check if event is NIJA type
const isNijaEvent = (eventType: string) => 
  eventType === 'nija_prescription_run' || eventType === 'nija_decadence_run';

// Filter events by category
const filterEvents = (events: CaseEvent[], filter: TimelineFilter): CaseEvent[] => {
  switch (filter) {
    case 'checklist':
      return events.filter(e => e.event_type === 'task_status' || e.event_type === 'task_created');
    case 'fase':
      return events.filter(e => e.event_type === 'stage_changed');
    case 'documentos':
      return events.filter(e => e.event_type === 'doc_created' || e.event_type === 'doc_export');
    case 'nija':
      return events.filter(e => isNijaEvent(e.event_type));
    case 'nija_prescricao':
      return events.filter(e => e.event_type === 'nija_prescription_run');
    case 'nija_decadencia':
      return events.filter(e => e.event_type === 'nija_decadence_run');
    default:
      return events;
  }
};

// Extract NIJA data from payload safely
const extractNijaPayload = (payload: Json): {
  tipoAnalise: string;
  naturezaPretensao: string;
  marcoInicial: { data: string; descricao: string };
  documentosAnalisados: number;
  observacoes: string | null;
  notaTecnica: string;
  // Audit fields
  executadoPor?: string | null;
  executadoEm?: string | null;
  cenarioSelecionado?: 'conservador' | 'provavel' | 'agressivo' | null;
  verificacaoHumana?: boolean;
  verificadoPor?: string | null;
  verificadoEm?: string | null;
  // Review fields
  revisado?: boolean;
  revisadoPor?: string | null;
  revisadoEm?: string | null;
  observacoesRevisor?: string | null;
} | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  
  const p = payload as Record<string, unknown>;
  return {
    tipoAnalise: String(p.tipo_analise || 'prescricao'),
    naturezaPretensao: String(p.natureza_pretensao || ''),
    marcoInicial: {
      data: String((p.marco_inicial as Record<string, unknown>)?.data || ''),
      descricao: String((p.marco_inicial as Record<string, unknown>)?.descricao || ''),
    },
    documentosAnalisados: Number(p.documentos_analisados || 0),
    observacoes: p.observacoes ? String(p.observacoes) : null,
    notaTecnica: String(p.nota_tecnica || ''),
    // Audit fields
    executadoPor: p.executado_por ? String(p.executado_por) : null,
    executadoEm: p.executado_em ? String(p.executado_em) : null,
    cenarioSelecionado: p.cenario_selecionado as 'conservador' | 'provavel' | 'agressivo' | null,
    verificacaoHumana: Boolean(p.verificacao_humana),
    verificadoPor: p.verificado_por ? String(p.verificado_por) : null,
    verificadoEm: p.verificado_em ? String(p.verificado_em) : null,
    // Review fields
    revisado: Boolean(p.revisado),
    revisadoPor: p.revisado_por ? String(p.revisado_por) : null,
    revisadoEm: p.revisado_em ? String(p.revisado_em) : null,
    observacoesRevisor: p.observacoes_revisor ? String(p.observacoes_revisor) : null,
  };
};

// Standardized legal disclaimer text
const LEGAL_DISCLAIMER = 'Esta análise é meramente orientativa e não substitui a análise técnica do advogado responsável. Os prazos prescricionais e decadenciais podem variar conforme jurisprudência atualizada, legislação específica e particularidades do caso concreto. Recomenda-se a verificação independente das informações aqui contidas antes de qualquer decisão processual.';

// Cenario config for display
const CENARIO_BADGES: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  conservador: { label: 'Conservador', icon: Shield, className: 'bg-blue-100 text-blue-800 border-blue-300' },
  provavel: { label: 'Provável', icon: Target, className: 'bg-amber-100 text-amber-800 border-amber-300' },
  agressivo: { label: 'Agressivo', icon: Zap, className: 'bg-red-100 text-red-800 border-red-300' },
};

export function CaseTimeline({ caseId, caseTitle, caseCnj, clientName, officeName, officeOab, userRole: propUserRole, onDocumentSaved }: CaseTimelineProps) {
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<TimelineFilter>('todos');
  
  // User permission state
  const [userRole, setUserRole] = useState<string | null>(propUserRole || null);
  const [loadingPermission, setLoadingPermission] = useState(!propUserRole);
  
  // Permission checks (normalize role to lowercase for comparison)
  const normalizedRole = userRole?.toLowerCase();
  const canViewNija = normalizedRole === 'owner' || normalizedRole === 'editor' || normalizedRole === 'viewer';
  const canEditReview = normalizedRole === 'owner' || normalizedRole === 'editor';
  const canExportNija = normalizedRole === 'owner' || normalizedRole === 'editor' || normalizedRole === 'viewer';
  
  // NIJA detail modal state (READ-ONLY - no re-execution possible)
  const [nijaModalOpen, setNijaModalOpen] = useState(false);
  const [selectedNijaEvent, setSelectedNijaEvent] = useState<CaseEvent | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Review editing state
  const [editingReviewEventId, setEditingReviewEventId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  
  // Text copy state
  const [textCopied, setTextCopied] = useState(false);
  const [isSavingDocument, setIsSavingDocument] = useState(false);

  // TJTO Dictionary enrichment state
  const [enrichedTitles, setEnrichedTitles] = useState<Record<string, EnrichedDoc>>({});
  const [loadingEnrich, setLoadingEnrich] = useState(false);

  // Effect to enrich titles containing "Visualizar"
  useEffect(() => {
    let alive = true;

    async function run() {
      if (!events?.length) return;

      const toEnrich = (events ?? []).filter(
        (e: CaseEvent) => typeof e.title === "string" && e.title.includes("Visualizar")
      );
      if (!toEnrich.length) return;

      setLoadingEnrich(true);
      const out: Record<string, EnrichedDoc> = {};
      for (const ev of toEnrich) out[String(ev.id)] = await enrichDoc(ev.title);

      if (alive) {
        setEnrichedTitles(out);
        setLoadingEnrich(false);
      }
    }

    run();
    return () => { alive = false; };
  }, [events]);

  // Export disclaimer
  const EXPORT_DISCLAIMER = 'Documento gerado com auxílio de ferramenta de apoio à redação jurídica, sob curadoria e revisão do advogado responsável.';

  // PDF Export function via window.print() - with guard against multiple clicks
  const handleExportPdf = () => {
    if (!nijaPayload || !selectedNijaEvent || isExportingPdf) return;
    
    setIsExportingPdf(true);

    const tipoLabel = nijaPayload.tipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição';
    const dateTime = formatDateTime(selectedNijaEvent.created_at);
    const now = new Date();
    
    // Cenario label
    const cenarioLabels: Record<string, string> = {
      conservador: 'Conservador',
      provavel: 'Provável',
      agressivo: 'Agressivo'
    };
    
    const printContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Nota Técnica NIJA - ${tipoLabel}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #1a1a1a;
            background: white;
          }
          
          .container {
            max-width: 100%;
          }
          
          /* Office Header */
          .office-header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid #1a365d;
          }
          
          .office-name {
            font-size: 16pt;
            font-weight: 700;
            color: #1a365d;
          }
          
          .office-oab {
            font-size: 10pt;
            color: #718096;
            margin-top: 4px;
          }
          
          /* Document Title */
          .doc-title {
            text-align: center;
            margin: 24px 0;
          }
          
          .doc-title h1 {
            font-size: 18pt;
            font-weight: 700;
            color: #1a365d;
            margin-bottom: 8px;
          }
          
          .doc-title .subtitle {
            font-size: 10pt;
            color: #4a5568;
          }
          
          .badge {
            display: inline-block;
            padding: 4px 16px;
            border-radius: 4px;
            font-size: 10pt;
            font-weight: 600;
            margin-top: 12px;
          }
          
          .badge-prescricao {
            background-color: #ebf8ff;
            color: #2b6cb0;
            border: 1px solid #90cdf4;
          }
          
          .badge-decadencia {
            background-color: #faf5ff;
            color: #6b46c1;
            border: 1px solid #d6bcfa;
          }
          
          /* Section styles */
          .section {
            margin-top: 24px;
          }
          
          .section-title {
            font-size: 12pt;
            font-weight: 700;
            color: #1a365d;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .section-number {
            display: inline-block;
            width: 24px;
            height: 24px;
            background-color: #1a365d;
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 24px;
            font-size: 10pt;
            margin-right: 8px;
          }
          
          /* Info Grid */
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            background-color: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
          }
          
          .info-item {
            margin-bottom: 4px;
          }
          
          .info-label {
            font-size: 9pt;
            color: #718096;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          
          .info-value {
            font-size: 10pt;
            color: #1a202c;
            font-weight: 500;
          }
          
          /* Content */
          .content-box {
            background-color: #fafafa;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
          }
          
          .content-text {
            font-size: 10pt;
            line-height: 1.8;
            white-space: pre-wrap;
            text-align: justify;
          }
          
          /* Review Status */
          .review-box {
            background-color: #f0fff4;
            border: 1px solid #9ae6b4;
            border-radius: 6px;
            padding: 12px 16px;
            margin-top: 16px;
          }
          
          .review-title {
            font-size: 10pt;
            font-weight: 600;
            color: #276749;
            margin-bottom: 4px;
          }
          
          .review-text {
            font-size: 9pt;
            color: #2f855a;
          }
          
          /* Disclaimer */
          .disclaimer {
            margin-top: 32px;
            padding: 16px;
            background-color: #fffbeb;
            border: 1px solid #fbbf24;
            border-radius: 6px;
          }
          
          .disclaimer-title {
            font-size: 10pt;
            font-weight: 700;
            color: #92400e;
            margin-bottom: 8px;
          }
          
          .disclaimer-text {
            font-size: 9pt;
            color: #b45309;
            line-height: 1.5;
            text-align: justify;
          }
          
          /* Footer */
          .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 2px solid #e2e8f0;
            font-size: 8pt;
            color: #a0aec0;
            text-align: center;
          }
          
          .footer-disclaimer {
            font-size: 8pt;
            color: #718096;
            font-style: italic;
            margin-top: 8px;
          }
          
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${officeName ? `
          <div class="office-header">
            <div class="office-name">${officeName}</div>
            ${officeOab ? `<div class="office-oab">OAB ${officeOab}</div>` : ''}
          </div>
          ` : ''}
          
          <div class="doc-title">
            <h1>NOTA TÉCNICA – NIJA</h1>
            <div class="subtitle">Módulo NIJA (Núcleo Inteligente Jurídico de Análise)</div>
            <span class="badge ${nijaPayload.tipoAnalise === 'decadencia' ? 'badge-decadencia' : 'badge-prescricao'}">
              ${tipoLabel}
            </span>
          </div>
          
          <!-- Section 1: Identification -->
          <div class="section">
            <div class="section-title">
              <span class="section-number">1</span>
              IDENTIFICAÇÃO
            </div>
            <div class="info-grid">
              ${clientName ? `
              <div class="info-item">
                <div class="info-label">Cliente</div>
                <div class="info-value">${clientName}</div>
              </div>
              ` : ''}
              ${caseTitle ? `
              <div class="info-item">
                <div class="info-label">Caso / Processo</div>
                <div class="info-value">${caseTitle}</div>
              </div>
              ` : ''}
              <div class="info-item">
                <div class="info-label">Natureza da Pretensão</div>
                <div class="info-value">${nijaPayload.naturezaPretensao || 'Não informada'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Tipo de Análise</div>
                <div class="info-value">${tipoLabel}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Marco Inicial</div>
                <div class="info-value">${nijaPayload.marcoInicial.data}${nijaPayload.marcoInicial.descricao ? ` - ${nijaPayload.marcoInicial.descricao}` : ''}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Data da Análise</div>
                <div class="info-value">${dateTime.date} às ${dateTime.time}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Documentos Analisados</div>
                <div class="info-value">${nijaPayload.documentosAnalisados}</div>
              </div>
              ${nijaPayload.cenarioSelecionado ? `
              <div class="info-item">
                <div class="info-label">Cenário Selecionado</div>
                <div class="info-value">${cenarioLabels[nijaPayload.cenarioSelecionado] || nijaPayload.cenarioSelecionado}</div>
              </div>
              ` : ''}
            </div>
          </div>
          
          ${nijaPayload.observacoes ? `
          <!-- Section 2: Observations -->
          <div class="section">
            <div class="section-title">
              <span class="section-number">2</span>
              OBSERVAÇÕES
            </div>
            <div class="content-box">
              <div class="content-text">${nijaPayload.observacoes}</div>
            </div>
          </div>
          ` : ''}
          
          <!-- Section 3: Technical Note -->
          <div class="section">
            <div class="section-title">
              <span class="section-number">${nijaPayload.observacoes ? '3' : '2'}</span>
              NOTA TÉCNICA COMPLETA
            </div>
            <div class="content-box">
              <div class="content-text">${nijaPayload.notaTecnica || 'Nota técnica não disponível.'}</div>
            </div>
          </div>
          
          ${nijaPayload.revisado ? `
          <!-- Review Status -->
          <div class="review-box">
            <div class="review-title">✓ Análise Revisada</div>
            <div class="review-text">
              Revisado pelo advogado responsável${nijaPayload.revisadoEm ? ` em ${new Date(nijaPayload.revisadoEm).toLocaleDateString('pt-BR')}` : ''}
              ${nijaPayload.observacoesRevisor ? `<br/>Observações: "${nijaPayload.observacoesRevisor}"` : ''}
            </div>
          </div>
          ` : ''}
          
          <!-- Disclaimer -->
          <div class="disclaimer">
            <div class="disclaimer-title">⚠️ AVISO DE RESPONSABILIDADE</div>
            <div class="disclaimer-text">
              ${LEGAL_DISCLAIMER}
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            Documento gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            <div class="footer-disclaimer">${EXPORT_DISCLAIMER}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      // Small delay to ensure styles are loaded
      setTimeout(() => {
        printWindow.print();
        // Release the export lock after print dialog
        setIsExportingPdf(false);
      }, 250);
    } else {
      setIsExportingPdf(false);
    }
  };

  const { toast } = useToast();

  // Fetch user permission for this case
  useEffect(() => {
    if (propUserRole) {
      setUserRole(propUserRole);
      setLoadingPermission(false);
      return;
    }

    const fetchPermission = async () => {
      setLoadingPermission(true);
      try {
        const { data, error } = await supabase.rpc('get_my_case_role', { p_case_id: caseId });
        if (error) {
          console.error('Erro ao buscar permissão:', error);
          setUserRole(null);
        } else {
          setUserRole(data || null);
        }
      } catch (err) {
        console.error('Erro ao buscar permissão:', err);
        setUserRole(null);
      } finally {
        setLoadingPermission(false);
      }
    };

    fetchPermission();
  }, [caseId, propUserRole]);

  // Fetch events on mount
  useEffect(() => {
    fetchEvents();
  }, [caseId]);

  // Real-time subscription for NIJA event notifications
  useEffect(() => {
    // Don't subscribe if user doesn't have permission
    if (!canViewNija) return;

    const channel = supabase
      .channel(`nija-events-${caseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'case_events',
          filter: `case_id=eq.${caseId}`
        },
        (payload) => {
          const newEvent = payload.new as CaseEvent;
          
          // Check if it's a NIJA event
          if (isNijaEvent(newEvent.event_type)) {
            const nijaData = extractNijaPayload(newEvent.payload);
            const tipoLabel = newEvent.event_type === 'nija_prescription_run' ? 'Prescrição' : 'Decadência';
            const natureza = nijaData?.naturezaPretensao || 'Não informada';
            
            // Show toast notification
            toast({
              title: `🔔 Nova Análise NIJA: ${tipoLabel}`,
              description: (
                <div className="flex flex-col gap-2">
                  <p className="text-sm">
                    <span className="font-medium">Natureza:</span> {natureza}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1 mt-1"
                    onClick={() => {
                      // Add to events and open modal
                      setEvents(prev => [newEvent, ...prev]);
                      openNijaModal(newEvent);
                    }}
                  >
                    <Eye className="h-3 w-3" />
                    Ver Análise
                  </Button>
                </div>
              ),
              duration: 10000,
            });
            
            // Also update the events list
            setEvents(prev => {
              // Avoid duplicates
              if (prev.some(e => e.id === newEvent.id)) return prev;
              return [newEvent, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId, toast, canViewNija]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('case_events')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Erro ao carregar timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => filterEvents(events, filter), [events, filter]);

  // Group NIJA events by type for collapsible summary
  const nijaGroups = useMemo(() => {
    const prescricaoEvents = events.filter(e => e.event_type === 'nija_prescription_run');
    const decadenciaEvents = events.filter(e => e.event_type === 'nija_decadence_run');
    return {
      prescricao: prescricaoEvents,
      decadencia: decadenciaEvents,
      total: prescricaoEvents.length + decadenciaEvents.length,
    };
  }, [events]);

  // State for collapsed NIJA groups
  const [collapsedNijaGroups, setCollapsedNijaGroups] = useState<Set<string>>(new Set());

  const toggleNijaGroup = (groupType: string) => {
    setCollapsedNijaGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupType)) {
        next.delete(groupType);
      } else {
        next.add(groupType);
      }
      return next;
    });
  };

  // Group events by date for better organization
  const groupedEvents = useMemo(() => {
    const groups: Record<string, CaseEvent[]> = {};
    filteredEvents.forEach((event) => {
      const dateKey = new Date(event.created_at).toLocaleDateString('pt-BR');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    });
    return groups;
  }, [filteredEvents]);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getEventConfig = (eventType: string) => {
    return EVENT_TYPE_CONFIG[eventType] || EVENT_TYPE_CONFIG.default;
  };

  const formatPayload = (payload: Json): string => {
    if (!payload || typeof payload !== 'object') return '';
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  const hasPayload = (payload: Json): boolean => {
    if (!payload) return false;
    if (typeof payload !== 'object') return true;
    return Object.keys(payload).length > 0;
  };

  const openNijaModal = (event: CaseEvent) => {
    if (!canViewNija) {
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para visualizar análises NIJA deste caso.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedNijaEvent(event);
    setNijaModalOpen(true);
  };

  const nijaPayload = selectedNijaEvent ? extractNijaPayload(selectedNijaEvent.payload) : null;
  const selectedNijaDateTime = selectedNijaEvent ? formatDateTime(selectedNijaEvent.created_at) : null;

  // Generate plain text report for NIJA event
  const generateNijaTextReport = useCallback((event: CaseEvent) => {
    const payload = extractNijaPayload(event.payload);
    if (!payload) return '';
    
    const dateTime = formatDateTime(event.created_at);
    const tipoLabel = payload.tipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição';
    const now = new Date();
    
    let report = `═══════════════════════════════════════════════════════════════
                    NOTA TÉCNICA – NIJA (${tipoLabel})
                    Módulo NIJA (Núcleo Inteligente Jurídico de Análise)
═══════════════════════════════════════════════════════════════

`;

    if (officeName) {
      report += `ESCRITÓRIO: ${officeName}\n`;
      if (officeOab) report += `OAB: ${officeOab}\n`;
      report += '\n';
    }

    report += `─────────────────────────────────────────────────────────────────
                           IDENTIFICAÇÃO
─────────────────────────────────────────────────────────────────

`;
    if (clientName) report += `Cliente: ${clientName}\n`;
    if (caseTitle) report += `Caso/Processo: ${caseTitle}\n`;
    report += `Natureza da Pretensão: ${payload.naturezaPretensao || 'Não informada'}\n`;
    report += `Marco Inicial: ${payload.marcoInicial.data}${payload.marcoInicial.descricao ? ` - ${payload.marcoInicial.descricao}` : ''}\n`;
    report += `Data da Análise: ${dateTime.date} às ${dateTime.time}\n`;
    report += `Tipo de Análise: ${tipoLabel}\n`;
    report += `Documentos Analisados: ${payload.documentosAnalisados}\n`;
    
    if (payload.cenarioSelecionado) {
      const cenarioLabels: Record<string, string> = {
        conservador: 'Conservador',
        provavel: 'Provável',
        agressivo: 'Agressivo'
      };
      report += `Cenário Selecionado: ${cenarioLabels[payload.cenarioSelecionado] || payload.cenarioSelecionado}\n`;
    }

    if (payload.observacoes) {
      report += `\n─────────────────────────────────────────────────────────────────
                           OBSERVAÇÕES
─────────────────────────────────────────────────────────────────

${payload.observacoes}\n`;
    }

    report += `
─────────────────────────────────────────────────────────────────
                        NOTA TÉCNICA COMPLETA
─────────────────────────────────────────────────────────────────

${payload.notaTecnica || 'Nota técnica não disponível.'}\n`;

    if (payload.revisado) {
      report += `
─────────────────────────────────────────────────────────────────
                         STATUS DE REVISÃO
─────────────────────────────────────────────────────────────────

✓ Revisado pelo advogado responsável`;
      if (payload.revisadoEm) {
        report += ` em ${new Date(payload.revisadoEm).toLocaleDateString('pt-BR')}`;
      }
      if (payload.observacoesRevisor) {
        report += `\nObservações do revisor: "${payload.observacoesRevisor}"`;
      }
      report += '\n';
    }

    report += `
═══════════════════════════════════════════════════════════════
                    AVISO DE RESPONSABILIDADE
═══════════════════════════════════════════════════════════════

${LEGAL_DISCLAIMER}

───────────────────────────────────────────────────────────────
Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
${EXPORT_DISCLAIMER}
───────────────────────────────────────────────────────────────
`;

    return report;
  }, [officeName, officeOab, clientName, caseTitle, EXPORT_DISCLAIMER]);

  // Copy text report to clipboard
  const handleCopyText = useCallback(async () => {
    if (!selectedNijaEvent) return;
    
    const textReport = generateNijaTextReport(selectedNijaEvent);
    try {
      await navigator.clipboard.writeText(textReport);
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  }, [selectedNijaEvent, generateNijaTextReport]);

  // Quick export from timeline (copies to clipboard)
  const handleQuickExport = useCallback(async (event: CaseEvent) => {
    const textReport = generateNijaTextReport(event);
    try {
      await navigator.clipboard.writeText(textReport);
      // Could add a toast here if needed
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  }, [generateNijaTextReport]);

  // TXT Export - download file
  const handleExportTxt = useCallback(() => {
    if (!selectedNijaEvent || !nijaPayload) return;

    const textReport = generateNijaTextReport(selectedNijaEvent);
    const tipoLabel = nijaPayload.tipoAnalise === 'decadencia' ? 'Decadencia' : 'Prescricao';
    const dateStr = new Date(selectedNijaEvent.created_at).toISOString().split('T')[0].replace(/-/g, '');
    const identifier = caseCnj?.replace(/[^0-9]/g, '') || caseId.substring(0, 8);
    const filename = `NIJA_${tipoLabel}_${identifier}_${dateStr}.txt`;

    const blob = new Blob([textReport], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, filename);

    toast({
      title: 'Arquivo exportado',
      description: `${filename} baixado com sucesso.`,
    });
  }, [selectedNijaEvent, nijaPayload, generateNijaTextReport, caseCnj, caseId, toast]);

  // Save as generated document
  const handleSaveAsDocument = useCallback(async () => {
    if (!selectedNijaEvent || !nijaPayload || isSavingDocument) return;

    setIsSavingDocument(true);

    try {
      // Get user's office_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: memberData, error: memberError } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (memberError || !memberData) throw new Error('Escritório não encontrado');

      const tipoLabel = nijaPayload.tipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição';
      const docTitle = `NIJA - ${tipoLabel} - ${nijaPayload.naturezaPretensao || 'Análise'}`;
      const textReport = generateNijaTextReport(selectedNijaEvent);

      const { data: newDoc, error: insertError } = await supabase
        .from('generated_docs_legacy')
        .insert({
          case_id: caseId,
          office_id: memberData.office_id,
          title: docTitle,
          content: textReport,
          kind: 'OUTRO',
          created_by: user.id,
          metadata: {
            source: 'nija_export',
            nija_event_id: selectedNijaEvent.id,
            tipo_analise: nijaPayload.tipoAnalise,
            natureza_pretensao: nijaPayload.naturezaPretensao,
          },
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      toast({
        title: 'Documento salvo',
        description: 'Nota técnica NIJA salva como documento do caso.',
      });

      setNijaModalOpen(false);

      // Callback to open document editor
      if (newDoc?.id && onDocumentSaved) {
        onDocumentSaved(newDoc.id);
      }
    } catch (err) {
      console.error('Erro ao salvar documento:', err);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o documento. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingDocument(false);
    }
  }, [selectedNijaEvent, nijaPayload, isSavingDocument, caseId, generateNijaTextReport, onDocumentSaved, toast]);

  // DOCX Export function
  const handleExportDocx = useCallback(async () => {
    if (!nijaPayload || !selectedNijaEvent || isExportingDocx) return;
    
    setIsExportingDocx(true);

    try {
      const tipoLabel = nijaPayload.tipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição';
      const dateTime = formatDateTime(selectedNijaEvent.created_at);
      const now = new Date();

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Office header
            ...(officeName ? [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: officeName, bold: true, size: 28 }),
                ],
              }),
              ...(officeOab ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: `OAB ${officeOab}`, size: 20, color: '666666' }),
                  ],
                  spacing: { after: 300 },
                }),
              ] : []),
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1a365d' } },
                spacing: { after: 400 },
                children: [],
              }),
            ] : []),

            // Title
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `NOTA TÉCNICA – NIJA (${tipoLabel})`, bold: true, size: 32 }),
              ],
              spacing: { after: 400 },
            }),

            // Case/Client info section
            new Paragraph({
              children: [
                new TextRun({ text: 'IDENTIFICAÇÃO', bold: true, size: 24 }),
              ],
              spacing: { before: 200, after: 200 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' } },
            }),
            ...(clientName ? [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Cliente: ', bold: true }),
                  new TextRun({ text: clientName }),
                ],
                spacing: { after: 100 },
              }),
            ] : []),
            ...(caseTitle ? [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Caso/Processo: ', bold: true }),
                  new TextRun({ text: caseTitle }),
                ],
                spacing: { after: 100 },
              }),
            ] : []),
            new Paragraph({
              children: [
                new TextRun({ text: 'Natureza da Pretensão: ', bold: true }),
                new TextRun({ text: nijaPayload.naturezaPretensao || 'Não informada' }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Marco Inicial: ', bold: true }),
                new TextRun({ text: `${nijaPayload.marcoInicial.data}${nijaPayload.marcoInicial.descricao ? ` - ${nijaPayload.marcoInicial.descricao}` : ''}` }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Data da Análise: ', bold: true }),
                new TextRun({ text: `${dateTime.date} às ${dateTime.time}` }),
              ],
              spacing: { after: 300 },
            }),

            // Analysis body
            new Paragraph({
              children: [
                new TextRun({ text: 'ANÁLISE', bold: true, size: 24 }),
              ],
              spacing: { before: 200, after: 200 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' } },
            }),
            ...nijaPayload.notaTecnica.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun({ text: line })],
                spacing: { after: 100 },
              })
            ),

            // Footer with disclaimer
            new Paragraph({
              children: [],
              spacing: { before: 600 },
            }),
            new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' } },
              children: [
                new TextRun({ 
                  text: `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 
                  size: 18, 
                  color: '888888',
                  italics: true,
                }),
              ],
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ 
                  text: EXPORT_DISCLAIMER, 
                  size: 18, 
                  color: '888888',
                  italics: true,
                }),
              ],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const filename = `nota-tecnica-nija-${tipoLabel.toLowerCase()}-${now.toISOString().split('T')[0]}.docx`;
      saveAs(blob, filename);
    } catch (error) {
      console.error('Erro ao exportar DOCX:', error);
    } finally {
      setIsExportingDocx(false);
    }
  }, [nijaPayload, selectedNijaEvent, isExportingDocx, officeName, officeOab, clientName, caseTitle]);

  // Toggle review status for NIJA event
  const handleToggleReview = useCallback(async (eventId: string, currentPayload: Record<string, unknown>, newRevisado: boolean, observacoesRevisor?: string) => {
    setSavingReview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      
      const updatedPayload: Record<string, Json | undefined> = {
        ...currentPayload as Record<string, Json | undefined>,
        revisado: newRevisado,
        revisado_por: newRevisado ? (user?.id || null) : null,
        revisado_em: newRevisado ? now : null,
        observacoes_revisor: observacoesRevisor || (currentPayload.observacoes_revisor as string | null) || null,
      };

      const { error } = await supabase
        .from('case_events')
        .update({ payload: updatedPayload })
        .eq('id', eventId);

      if (error) throw error;

      // Update local state
      setEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, payload: updatedPayload as Json } : e
      ));

      setEditingReviewEventId(null);
      setReviewNotes('');
    } catch (err) {
      console.error('Error updating review status:', err);
    } finally {
      setSavingReview(false);
    }
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Timeline do Caso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum evento registrado para este caso.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Timeline do Caso
          </CardTitle>
          <CardDescription className="text-xs">
            Histórico de eventos e alterações do processo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filter buttons */}
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="h-3 w-3 text-muted-foreground mr-1" />
              {FILTER_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={filter === opt.value || (opt.value === 'nija' && (filter === 'nija_prescricao' || filter === 'nija_decadencia')) ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setFilter(opt.value)}
                >
                  {opt.label}
                  {opt.value === 'nija' && (
                    <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">
                      {events.filter(e => isNijaEvent(e.event_type)).length}
                    </Badge>
                  )}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1 ml-2"
                disabled={loadingEnrich}
                onClick={() => {
                  clearTjtoCache();
                  setEnrichedTitles({});
                  setTimeout(async () => {
                    const toEnrich = (events ?? []).filter(
                      (e: CaseEvent) => typeof e.title === "string" && e.title.includes("Visualizar")
                    );
                    const out: Record<string, EnrichedDoc> = {};
                    for (const ev of toEnrich) out[String(ev.id)] = await enrichDoc(ev.title);
                    setEnrichedTitles(out);
                  }, 0);
                }}
              >
                <RefreshCw className={`h-3 w-3 ${loadingEnrich ? 'animate-spin' : ''}`} />
                Atualizar dicionário
              </Button>
            </div>
            
            {/* NIJA sub-filters - show when NIJA filter is active */}
            {(filter === 'nija' || filter === 'nija_prescricao' || filter === 'nija_decadencia') && (
              <div className="flex items-center gap-1 pl-5">
                <span className="text-[10px] text-muted-foreground mr-1">Tipo:</span>
                {NIJA_SUB_FILTERS.map((sub) => (
                  <Button
                    key={sub.value}
                    variant={filter === sub.value ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`h-5 text-[9px] px-2 ${
                      sub.value === 'nija_prescricao' ? 'text-blue-700' : 
                      sub.value === 'nija_decadencia' ? 'text-purple-700' : ''
                    }`}
                    onClick={() => setFilter(sub.value)}
                  >
                    {sub.label}
                    <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">
                      {sub.value === 'nija' 
                        ? events.filter(e => isNijaEvent(e.event_type)).length
                        : sub.value === 'nija_prescricao'
                          ? events.filter(e => e.event_type === 'nija_prescription_run').length
                          : events.filter(e => e.event_type === 'nija_decadence_run').length
                      }
                    </Badge>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum evento encontrado com o filtro "{FILTER_OPTIONS.find(f => f.value === filter)?.label}".
            </p>
          ) : (
            <>
              {/* NIJA Summary Cards - Show when NIJA filter is active and there are multiple events */}
              {(filter === 'nija' || filter === 'nija_prescricao' || filter === 'nija_decadencia') && nijaGroups.total > 1 && (
              <div className="space-y-2 mb-4">
                {filter !== 'nija_decadencia' && nijaGroups.prescricao.length > 1 && (
                  <div className="border rounded-lg overflow-hidden bg-blue-50/50 border-blue-200">
                    <button
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
                      onClick={() => toggleNijaGroup('prescricao')}
                    >
                      <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-blue-700" />
                        <span className="text-sm font-medium text-blue-800">
                          Análises de Prescrição
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-300">
                          {nijaGroups.prescricao.length}
                        </Badge>
                      </div>
                      {collapsedNijaGroups.has('prescricao') ? (
                        <ChevronRight className="h-4 w-4 text-blue-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                    {collapsedNijaGroups.has('prescricao') && (
                      <div className="px-3 pb-2 text-[10px] text-blue-600">
                        {nijaGroups.prescricao.length} análise(s) de prescrição agrupada(s). Clique para expandir.
                      </div>
                    )}
                  </div>
                )}
                
                {filter !== 'nija_prescricao' && nijaGroups.decadencia.length > 1 && (
                  <div className="border rounded-lg overflow-hidden bg-purple-50/50 border-purple-200">
                    <button
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-purple-100/50 transition-colors"
                      onClick={() => toggleNijaGroup('decadencia')}
                    >
                      <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-purple-700" />
                        <span className="text-sm font-medium text-purple-800">
                          Análises de Decadência
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700 border-purple-300">
                          {nijaGroups.decadencia.length}
                        </Badge>
                      </div>
                      {collapsedNijaGroups.has('decadencia') ? (
                        <ChevronRight className="h-4 w-4 text-purple-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-purple-600" />
                      )}
                    </button>
                    {collapsedNijaGroups.has('decadencia') && (
                      <div className="px-3 pb-2 text-[10px] text-purple-600">
                        {nijaGroups.decadencia.length} análise(s) de decadência agrupada(s). Clique para expandir.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-4">
                {Object.entries(groupedEvents).map(([dateKey, dateEvents]) => {
                  // Check if NIJA group is collapsed
                  const shouldHideEvent = (event: CaseEvent) => {
                    if (event.event_type === 'nija_prescription_run' && collapsedNijaGroups.has('prescricao')) {
                      // Show only the most recent one
                      const mostRecent = nijaGroups.prescricao[0];
                      return event.id !== mostRecent?.id;
                    }
                    if (event.event_type === 'nija_decadence_run' && collapsedNijaGroups.has('decadencia')) {
                      const mostRecent = nijaGroups.decadencia[0];
                      return event.id !== mostRecent?.id;
                    }
                    return false;
                  };

                  const visibleEvents = dateEvents.filter(e => !shouldHideEvent(e));
                  if (visibleEvents.length === 0) return null;

                  return (
                  <div key={dateKey}>
                    {/* Date separator */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {dateKey}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

                      <div className="space-y-3">
                        {visibleEvents.map((event) => {
                          const config = getEventConfig(event.event_type);
                          const Icon = config.icon;
                          const { time } = formatDateTime(event.created_at);
                          const isExpanded = expandedEvents.has(event.id);
                          const showPayload = hasPayload(event.payload);
                          const isNija = isNijaEvent(event.event_type);

                          return (
                            <div key={event.id} className="relative pl-8">
                              {/* Icon circle */}
                              <div
                                className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center ${config.className}`}
                              >
                                <Icon className="h-3 w-3" />
                              </div>

                              <div className="bg-muted/30 rounded-md p-3 border">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* NIJA badges with tooltips */}
                                      {isNija ? (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge 
                                                variant="outline" 
                                                className={`text-[10px] cursor-help ${
                                                  event.event_type === 'nija_prescription_run' 
                                                    ? 'bg-blue-50 text-blue-700 border-blue-300' 
                                                    : 'bg-purple-50 text-purple-700 border-purple-300'
                                                }`}
                                              >
                                                <Scale className="h-2.5 w-2.5 mr-1" />
                                                {event.event_type === 'nija_prescription_run' ? 'Prescrição' : 'Decadência'}
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs">
                                              <p className="text-xs font-semibold text-amber-600 mb-1">📋 Análise Orientativa</p>
                                              {event.event_type === 'nija_prescription_run' ? (
                                                <p className="text-xs">
                                                  <strong>Prescrição:</strong> Análise da perda da pretensão (direito de ação) pelo decurso do tempo.
                                                </p>
                                              ) : (
                                                <p className="text-xs">
                                                  <strong>Decadência:</strong> Análise da perda do próprio direito potestativo pelo não exercício no prazo.
                                                </p>
                                              )}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px]">
                                          {config.label}
                                        </Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        às {time}
                                      </span>
                                      {/* Review status badge for NIJA events */}
                                      {isNija && event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) && (
                                        (() => {
                                          const p = event.payload as Record<string, unknown>;
                                          const isRevisado = Boolean(p.revisado);
                                          const cenario = p.cenario_selecionado as string | null;
                                          const CenarioIcon = cenario && CENARIO_BADGES[cenario] ? CENARIO_BADGES[cenario].icon : null;
                                          
                                          return (
                                            <>
                                              {/* Cenario badge */}
                                              {cenario && CENARIO_BADGES[cenario] && (
                                                <Badge variant="outline" className={`text-[9px] gap-0.5 ${CENARIO_BADGES[cenario].className}`}>
                                                  {CenarioIcon && <CenarioIcon className="h-2.5 w-2.5" />}
                                                  {CENARIO_BADGES[cenario].label}
                                                </Badge>
                                              )}
                                              {/* Review status badge */}
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Badge 
                                                      variant="outline" 
                                                      className={`text-[9px] gap-0.5 cursor-pointer ${
                                                        isRevisado 
                                                          ? 'bg-green-50 text-green-700 border-green-300' 
                                                          : 'bg-amber-50 text-amber-700 border-amber-300'
                                                      }`}
                                                    >
                                                      {isRevisado ? (
                                                        <>
                                                          <Check className="h-2.5 w-2.5" />
                                                          Revisado
                                                        </>
                                                      ) : (
                                                        <>
                                                          <AlertTriangle className="h-2.5 w-2.5" />
                                                          Não revisado
                                                        </>
                                                      )}
                                                    </Badge>
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                    <p className="text-xs">
                                                      {isRevisado 
                                                        ? `Revisado pelo advogado em ${p.revisado_em ? new Date(String(p.revisado_em)).toLocaleDateString('pt-BR') : 'data não informada'}`
                                                        : 'Análise ainda não revisada pelo advogado responsável'
                                                      }
                                                    </p>
                                                    {p.observacoes_revisor && (
                                                      <p className="text-xs mt-1 italic">"{String(p.observacoes_revisor)}"</p>
                                                    )}
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            </>
                                          );
                                        })()
                                      )}
                                    </div>
                                    {(() => {
                                      const enriched = enrichedTitles[String(event.id)];
                                      if (enriched?.label && enriched.label !== event.title) {
                                        return (
                                          <div className="mt-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-sm font-medium">{enriched.label}</span>
                                              {enriched.category && <Badge variant="secondary" className="text-[9px]">{enriched.category}</Badge>}
                                            </div>
                                            {(enriched.code || enriched.legal_desc) && (
                                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {enriched.code ? enriched.code : ""}
                                                {enriched.legal_desc ? ` — ${enriched.legal_desc}` : ""}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      }
                                      return <p className="text-sm font-medium mt-1">{event.title}</p>;
                                    })()}
                                    
                                    {/* NIJA Summary Card - inline expandable */}
                                    {isNija && event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) && (
                                      (() => {
                                        const p = event.payload as Record<string, unknown>;
                                        const nijaData = {
                                          natureza: String(p.natureza_pretensao || 'Não informada'),
                                          marco: (p.marco_inicial as Record<string, unknown>)?.data 
                                            ? String((p.marco_inicial as Record<string, unknown>).data)
                                            : null,
                                          verificado: Boolean(p.verificacao_humana),
                                          verificadoEm: p.verificado_em ? String(p.verificado_em) : null,
                                          notaTecnica: String(p.nota_tecnica || ''),
                                          executadoPor: p.executado_por ? String(p.executado_por) : null,
                                          executadoEm: p.executado_em ? String(p.executado_em) : null,
                                          cenario: p.cenario_selecionado as string | null,
                                          revisado: Boolean(p.revisado),
                                          revisadoPor: p.revisado_por ? String(p.revisado_por) : null,
                                          revisadoEm: p.revisado_em ? String(p.revisado_em) : null,
                                          observacoesRevisor: p.observacoes_revisor ? String(p.observacoes_revisor) : null,
                                        };
                                        const isNijaExpanded = expandedEvents.has(`nija-${event.id}`);
                                        const isEditingReview = editingReviewEventId === event.id;
                                        
                                        return (
                                          <div className="mt-2 space-y-2">
                                            {/* Summary row */}
                                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                                              <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                <span className="text-foreground">Executado em {nijaData.executadoEm ? new Date(nijaData.executadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'data desconhecida'}</span>
                                              </span>
                                              <span className="text-muted-foreground/50">•</span>
                                              <span className="flex items-center gap-1">
                                                <FileText className="h-3 w-3" />
                                                <span className="font-medium text-foreground">{nijaData.natureza}</span>
                                              </span>
                                              {nijaData.marco && (
                                                <>
                                                  <span className="text-muted-foreground/50">•</span>
                                                  <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Marco: {nijaData.marco}
                                                  </span>
                                                </>
                                              )}
                                            </div>

                                            {/* Review section - only show edit controls if user can edit */}
                                            <div className={`rounded border p-2 ${nijaData.revisado ? 'bg-green-50/50 border-green-200' : 'bg-amber-50/50 border-amber-200'}`}>
                                              <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                  {canEditReview ? (
                                                    <Switch
                                                      checked={nijaData.revisado}
                                                      onCheckedChange={(checked) => {
                                                        if (!isEditingReview) {
                                                          setEditingReviewEventId(event.id);
                                                          setReviewNotes(nijaData.observacoesRevisor || '');
                                                        }
                                                        handleToggleReview(event.id, p, checked, reviewNotes);
                                                      }}
                                                      disabled={savingReview}
                                                      className="scale-75"
                                                    />
                                                  ) : (
                                                    <div className={`w-4 h-4 rounded-full ${nijaData.revisado ? 'bg-green-500' : 'bg-amber-500'}`} />
                                                  )}
                                                  <Label className="text-[10px] font-medium cursor-pointer">
                                                    {nijaData.revisado ? (
                                                      <span className="text-green-700 flex items-center gap-1">
                                                        <Check className="h-3 w-3" />
                                                        Revisado pelo advogado
                                                      </span>
                                                    ) : (
                                                      <span className="text-amber-700 flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Não revisado
                                                      </span>
                                                    )}
                                                  </Label>
                                                </div>
                                                {nijaData.revisadoEm && (
                                                  <span className="text-[9px] text-muted-foreground">
                                                    {new Date(nijaData.revisadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                  </span>
                                                )}
                                              </div>
                                              
                                              {/* Reviewer notes */}
                                              {(nijaData.observacoesRevisor || isEditingReview) && (
                                                <div className="mt-2">
                                                  {isEditingReview ? (
                                                    <div className="space-y-2">
                                                      <Textarea
                                                        value={reviewNotes}
                                                        onChange={(e) => setReviewNotes(e.target.value)}
                                                        placeholder="Observações do revisor (opcional)"
                                                        className="text-[10px] min-h-[50px] bg-background"
                                                      />
                                                      <div className="flex gap-1 justify-end">
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-6 text-[10px] px-2"
                                                          onClick={() => {
                                                            setEditingReviewEventId(null);
                                                            setReviewNotes('');
                                                          }}
                                                        >
                                                          <X className="h-3 w-3 mr-1" />
                                                          Cancelar
                                                        </Button>
                                                        <Button
                                                          size="sm"
                                                          className="h-6 text-[10px] px-2"
                                                          onClick={() => handleToggleReview(event.id, p, nijaData.revisado, reviewNotes)}
                                                          disabled={savingReview}
                                                        >
                                                          {savingReview ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                          ) : (
                                                            <>
                                                              <Check className="h-3 w-3 mr-1" />
                                                              Salvar
                                                            </>
                                                          )}
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-start gap-1">
                                                      <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                                                      <p className="text-[10px] text-muted-foreground italic">
                                                        "{nijaData.observacoesRevisor}"
                                                      </p>
                                                      {canEditReview && (
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-5 w-5 p-0 ml-auto"
                                                          onClick={() => {
                                                            setEditingReviewEventId(event.id);
                                                            setReviewNotes(nijaData.observacoesRevisor || '');
                                                          }}
                                                        >
                                                          <Edit2 className="h-2.5 w-2.5" />
                                                        </Button>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              
                                              {/* Add notes button if no notes yet - only for editors */}
                                              {!nijaData.observacoesRevisor && !isEditingReview && canEditReview && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-5 text-[9px] px-1 mt-1 text-muted-foreground"
                                                  onClick={() => {
                                                    setEditingReviewEventId(event.id);
                                                    setReviewNotes('');
                                                  }}
                                                >
                                                  <MessageSquare className="h-2.5 w-2.5 mr-1" />
                                                  Adicionar observação
                                                </Button>
                                              )}
                                            </div>
                                            
                                            {/* Expand/Collapse button */}
                                            <Collapsible 
                                              open={isNijaExpanded} 
                                              onOpenChange={() => toggleExpand(`nija-${event.id}`)}
                                            >
                                              <CollapsibleTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-5 text-[10px] px-2 text-muted-foreground hover:text-foreground w-full justify-start"
                                                >
                                                  {isNijaExpanded ? (
                                                    <>
                                                      <ChevronDown className="h-3 w-3 mr-1" />
                                                      Ocultar análise
                                                    </>
                                                  ) : (
                                                    <>
                                                      <ChevronRight className="h-3 w-3 mr-1" />
                                                      Ver análise completa
                                                    </>
                                                  )}
                                                </Button>
                                              </CollapsibleTrigger>
                                              <CollapsibleContent className="mt-2">
                                                <div className="bg-background border rounded-lg p-3 max-h-[200px] overflow-y-auto">
                                                  <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-foreground">
                                                    {nijaData.notaTecnica || 'Nota técnica não disponível.'}
                                                  </pre>
                                                </div>
                                              </CollapsibleContent>
                                            </Collapsible>
                                          </div>
                                        );
                                      })()
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Export and Reabrir buttons for NIJA events - only if user can view */}
                                    {isNija && canViewNija && (
                                      <>
                                        {canExportNija && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                                  onClick={() => handleQuickExport(event)}
                                                >
                                                  <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="text-xs">Copiar relatório NIJA</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className={`h-7 text-[10px] px-2 gap-1 ${
                                            event.event_type === 'nija_prescription_run' 
                                              ? 'text-blue-700 border-blue-300 hover:bg-blue-50' 
                                              : 'text-purple-700 border-purple-300 hover:bg-purple-50'
                                          }`}
                                          onClick={() => openNijaModal(event)}
                                        >
                                          <Eye className="h-3 w-3" />
                                          Reabrir Análise
                                        </Button>
                                      </>
                                    )}
                                    {/* No permission badge */}
                                    {isNija && !canViewNija && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge variant="outline" className="text-[9px] text-muted-foreground">
                                              <Shield className="h-2.5 w-2.5 mr-1" />
                                              Restrito
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Você não tem permissão para visualizar esta análise</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}

                                    {showPayload && !isNija && (
                                      <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(event.id)}>
                                        <CollapsibleTrigger className="p-1 hover:bg-muted rounded">
                                          {isExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </CollapsibleTrigger>
                                      </Collapsible>
                                    )}
                                  </div>
                                </div>

                                {showPayload && isExpanded && !isNija && (
                                  <Collapsible open={isExpanded}>
                                    <CollapsibleContent className="mt-2">
                                      <pre className="text-[10px] bg-background border rounded p-2 overflow-x-auto font-mono text-muted-foreground">
                                        {formatPayload(event.payload)}
                                      </pre>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {/* NIJA Detail Modal (Read-only) */}
      <Dialog open={nijaModalOpen} onOpenChange={setNijaModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Nota Técnica - {nijaPayload?.tipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição'}
            </DialogTitle>
            <DialogDescription>
              Análise realizada em {selectedNijaDateTime?.date} às {selectedNijaDateTime?.time}
            </DialogDescription>
          </DialogHeader>

          {/* Legal Disclaimer - Fixed (READ-ONLY modal, no re-execution) */}
          <Alert variant="default" className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 text-sm">Aviso de Responsabilidade (Somente Leitura)</AlertTitle>
            <AlertDescription className="text-amber-700 text-xs">
              {LEGAL_DISCLAIMER}
            </AlertDescription>
          </Alert>

          {nijaPayload && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 py-2">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Natureza da Pretensão</p>
                    <p className="font-medium">{nijaPayload.naturezaPretensao || 'Não informada'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Marco Inicial</p>
                    <p className="font-medium">
                      {nijaPayload.marcoInicial.data} - {nijaPayload.marcoInicial.descricao || 'Não informado'}
                    </p>
                </div>

                {/* Human verification info */}
                {nijaPayload.verificacaoHumana && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Verificação Humana Confirmada</span>
                    </div>
                    {nijaPayload.verificadoEm && (
                      <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Verificado em {new Date(nijaPayload.verificadoEm).toLocaleDateString('pt-BR')} às {new Date(nijaPayload.verificadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Tipo de Análise</p>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] ${
                        nijaPayload.tipoAnalise === 'decadencia' 
                          ? 'bg-purple-50 text-purple-700 border-purple-300' 
                          : 'bg-blue-50 text-blue-700 border-blue-300'
                      }`}
                    >
                      {nijaPayload.tipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Documentos Analisados</p>
                    <p className="font-medium">{nijaPayload.documentosAnalisados}</p>
                  </div>
                </div>

                {nijaPayload.observacoes && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium mb-1">Observações</p>
                    <p className="text-sm bg-muted/30 p-2 rounded border">{nijaPayload.observacoes}</p>
                  </div>
                )}

                {/* Technical Note */}
                <div>
                  <p className="text-muted-foreground text-xs font-medium mb-2">Nota Técnica Completa</p>
                  <div className="bg-muted/30 border rounded-lg p-4 max-h-[350px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                      {nijaPayload.notaTecnica || 'Nota técnica não disponível.'}
                    </pre>
                  </div>
                </div>

                {/* Petition Draft Generator */}
                <NijaPetitionDraftGenerator
                  tipoAnalise={nijaPayload.tipoAnalise as 'prescricao' | 'decadencia'}
                  naturezaPretensao={nijaPayload.naturezaPretensao}
                  marcoInicial={nijaPayload.marcoInicial}
                  cenarioSelecionado={nijaPayload.cenarioSelecionado}
                  notaTecnica={nijaPayload.notaTecnica}
                  caseTitle={caseTitle}
                  clientName={clientName}
                  officeName={officeName}
                  officeOab={officeOab}
                />
              </div>
            </ScrollArea>
          )}

          <div className="flex justify-between pt-4 border-t">
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                onClick={handleCopyText} 
                className="gap-2"
              >
                {textCopied ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar Texto
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportTxt} 
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Baixar .txt
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportDocx} 
                className="gap-2"
                disabled={isExportingDocx}
              >
                {isExportingDocx ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                {isExportingDocx ? 'Gerando...' : 'DOCX'}
              </Button>
              <Button 
                variant="default" 
                onClick={handleExportPdf} 
                className="gap-2"
                disabled={isExportingPdf}
              >
                {isExportingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {isExportingPdf ? 'Gerando...' : 'PDF'}
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleSaveAsDocument} 
                className="gap-2"
                disabled={isSavingDocument}
              >
                {isSavingDocument ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSavingDocument ? 'Salvando...' : 'Salvar como Documento'}
              </Button>
            </div>
            <Button variant="outline" onClick={() => setNijaModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
