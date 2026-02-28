import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Scale, AlertTriangle, FileText, Calendar, Save, Copy, Check, Info, Clock, Briefcase, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Json } from '@/integrations/supabase/types';
import { NijaDocumentContentExtractor } from './NijaDocumentContentExtractor';
import { NijaStrategyCompare, StrategyCenario } from './NijaStrategyCompare';
import { NijaChecklistGenerator } from './NijaChecklistGenerator';
import { AREA_PRESETS, mapCaseAreaToPreset, getPresetByValue, type AreaPreset } from './NijaAreaPresets';

type Case = Tables<'cases'>;
type Client = Tables<'clients'>;

interface CaseEvent {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  payload: Json;
  created_at: string;
}

interface Document {
  id: string;
  filename: string;
  kind: string;
  created_at: string;
  storage_path?: string;
  mime_type?: string;
  extracted_text?: string | null;
}

interface NijaUsageStats {
  current: number;
  limit: number;
  percentage: number;
}

interface NijaPrescricaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caso: Case | null;
  cliente: Client | null;
  caseEvents: CaseEvent[];
  documents: Document[];
  canEdit: boolean;
  isArchived: boolean;
  onEventCreated: () => void;
  officeId?: string;
}

type TipoAnalise = 'prescricao' | 'decadencia';

// Fallback options (used when no area preset is selected)
const FALLBACK_NATUREZA_PRESCRICAO = [
  { value: 'indenizacao_danos_morais', label: 'Indenização por Danos Morais (3 anos)' },
  { value: 'indenizacao_danos_materiais', label: 'Indenização por Danos Materiais (3 anos)' },
  { value: 'cobranca_divida', label: 'Cobrança de Dívida Líquida (5 anos)' },
  { value: 'contrato_escrito', label: 'Pretensão Contratual (10 anos)' },
  { value: 'responsabilidade_civil', label: 'Responsabilidade Civil (3 anos)' },
];

const FALLBACK_NATUREZA_DECADENCIA = [
  { value: 'anulacao_negocio', label: 'Anulação de Negócio Jurídico (4 anos)' },
  { value: 'redibicao_vicio', label: 'Ação Redibitória (30/180 dias)' },
];

const COOLDOWN_SECONDS = 60;

export function NijaPrescricaoModal({
  open,
  onOpenChange,
  caso,
  cliente,
  caseEvents,
  documents,
  canEdit,
  isArchived,
  onEventCreated,
  officeId,
}: NijaPrescricaoModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modo Texto Jurídico (peticionável)
  const [modoTextoJuridico, setModoTextoJuridico] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // NIJA usage tracking state
  const [usageStats, setUsageStats] = useState<NijaUsageStats | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Audit guard: anti-loop lock - only explicit button click can trigger analysis
  const inFlightRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  // Cooldown state for overload errors
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [areaDireito, setAreaDireito] = useState<string>('outro');
  const [tipoAnalise, setTipoAnalise] = useState<TipoAnalise>('prescricao');
  const [naturezaPretensao, setNaturezaPretensao] = useState('');
  const [naturezaCustom, setNaturezaCustom] = useState('');
  const [marcoInicialEventId, setMarcoInicialEventId] = useState('');
  const [marcoInicialCustomDate, setMarcoInicialCustomDate] = useState('');
  const [marcoInicialCustomDesc, setMarcoInicialCustomDesc] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');

  // Get current area preset
  const currentPreset = useMemo(() => getPresetByValue(areaDireito), [areaDireito]);

  // Get natureza options based on area and tipo
  const getNaturezaOptions = useCallback(() => {
    if (!currentPreset) {
      return tipoAnalise === 'decadencia' ? FALLBACK_NATUREZA_DECADENCIA : FALLBACK_NATUREZA_PRESCRICAO;
    }
    const options = tipoAnalise === 'decadencia' 
      ? currentPreset.naturezaDecadencia 
      : currentPreset.naturezaPrescricao;
    // Always add "outro" option
    const outroValue = tipoAnalise === 'decadencia' ? 'outro_decadencia' : 'outro_prescricao';
    return [...options, { value: outroValue, label: 'Outro (especificar nas observações)' }];
  }, [currentPreset, tipoAnalise]);

  // Get marco inicial suggestions based on area
  const marcosIniciaisSuggestions = useMemo(() => {
    return currentPreset?.marcosIniciais || [];
  }, [currentPreset]);

  // Get area-specific alerts
  const areaAlertas = useMemo(() => {
    return currentPreset?.alertas || [];
  }, [currentPreset]);
  
  // Document content extraction state
  const [extractedDocContent, setExtractedDocContent] = useState('');

  // Result state
  const [notaTecnica, setNotaTecnica] = useState('');
  const [resultTipoAnalise, setResultTipoAnalise] = useState<TipoAnalise>('prescricao');
  const [cenarioSelecionado, setCenarioSelecionado] = useState<'conservador' | 'provavel' | 'agressivo' | null>(null);

  // Human verification state (mandatory before saving)
  const [verificacaoHumana, setVerificacaoHumana] = useState(false);

  // Cleanup cooldown interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  // Fetch NIJA usage stats when modal opens
  const fetchUsageStats = useCallback(async () => {
    if (!officeId) return;
    setLoadingUsage(true);
    try {
      const { data, error } = await supabase.rpc('get_nija_usage', { p_office_id: officeId });
      if (error) throw error;
      if (data) {
        setUsageStats(data as unknown as NijaUsageStats);
      }
    } catch (err) {
      console.error('[NIJA] Error fetching usage stats:', err);
    } finally {
      setLoadingUsage(false);
    }
  }, [officeId]);

  // Reset only form fields (not notaTecnica/step) when modal opens
  useEffect(() => {
    if (open) {
      // Pre-fill area from case
      const mappedArea = mapCaseAreaToPreset(caso?.area);
      setAreaDireito(mappedArea);
      // Reset form fields only, keep result if exists
      setTipoAnalise('prescricao');
      setNaturezaPretensao('');
      setNaturezaCustom('');
      setMarcoInicialEventId('');
      setMarcoInicialCustomDate('');
      setMarcoInicialCustomDesc('');
      setSelectedDocIds([]);
      setObservacoes('');
      setExtractedDocContent('');
      // Reset result and step ONLY on fresh open
      setStep('form');
      setNotaTecnica('');
      setResultTipoAnalise('prescricao');
      // Fetch usage stats
      fetchUsageStats();
    }
  }, [open, fetchUsageStats, caso?.area]);

  // Handle area change: reset natureza and marco
  const handleAreaChange = useCallback((newArea: string) => {
    setAreaDireito(newArea);
    setNaturezaPretensao('');
    setNaturezaCustom('');
    setMarcoInicialEventId('');
    setMarcoInicialCustomDate('');
    setMarcoInicialCustomDesc('');
  }, []);

  // Handle tipo change: reset natureza fields only (no analysis trigger)
  const handleTipoChange = useCallback((newTipo: TipoAnalise) => {
    setTipoAnalise(newTipo);
    setNaturezaPretensao('');
    setNaturezaCustom('');
  }, []);

  // Start cooldown timer
  const startCooldown = useCallback(() => {
    setCooldownRemaining(COOLDOWN_SECONDS);
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);


  const handleDocToggle = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const getMarcoInicial = () => {
    if (marcoInicialEventId === 'custom') {
      return {
        data: marcoInicialCustomDate,
        descricao: marcoInicialCustomDesc || 'Marco inicial personalizado',
      };
    }
    const event = caseEvents.find((e) => e.id === marcoInicialEventId);
    if (event) {
      return {
        data: new Date(event.created_at).toLocaleDateString('pt-BR'),
        descricao: event.title,
      };
    }
    return { data: '', descricao: '' };
  };

  const isFormValid = () => {
    const isOutro = naturezaPretensao === 'outro_prescricao' || naturezaPretensao === 'outro_decadencia';
    const natureza = isOutro ? naturezaCustom.trim() : naturezaPretensao;
    const marco = getMarcoInicial();
    return natureza && marco.data && marco.descricao;
  };

  const handleAnalyze = async () => {
    // AUDIT GUARD: block if already in-flight (prevents loops, double-clicks, indirect calls)
    if (inFlightRef.current) {
      console.log('[NIJA] blocked: inFlightRef already true');
      return;
    }
    if (isRunning) {
      console.log('[NIJA] blocked: isRunning state true');
      return;
    }
    if (cooldownRemaining > 0) {
      console.log('[NIJA] blocked: cooldown active');
      return;
    }
    if (!caso || !cliente) {
      console.log('[NIJA] blocked: missing caso or cliente');
      return;
    }

    // Log audit trail for explicit click
    console.log('[NIJA] analyze click', { caseId: caso.id, tipoAnalise });

    // Lock execution immediately
    inFlightRef.current = true;
    setIsRunning(true);
    setLoading(true);

    try {
      // QUOTA CHECK: run_nija_with_quota before executing
      const moduleKey = tipoAnalise === 'decadencia' ? 'decadencia' : 'prescricao';
      const { data: quotaResult, error: quotaError } = await supabase.rpc('run_nija_with_quota', {
        p_case_id: caso.id,
        p_module: moduleKey,
      });

      if (quotaError) {
        console.error('[NIJA] Quota check error:', quotaError);
        toast({
          title: 'Erro ao verificar quota',
          description: quotaError.message || 'Não foi possível verificar o limite de uso.',
          variant: 'destructive',
        });
        return;
      }

      const quota = quotaResult as { ok: boolean; reason?: string; status?: { soft_limit_reached?: boolean } };

      if (!quota.ok) {
        if (quota.reason === 'quota_exceeded') {
          toast({
            title: 'Limite mensal do NIJA atingido',
            description: 'Seu escritório atingiu o limite de análises NIJA deste mês.',
            variant: 'destructive',
          });
          return;
        }
        // Other reasons (no_active_office, not_authenticated, etc.)
        toast({
          title: 'Erro',
          description: quota.reason || 'Não foi possível executar a análise.',
          variant: 'destructive',
        });
        return;
      }

      // Show soft limit warning if approaching quota
      if (quota.status?.soft_limit_reached) {
        toast({
          title: 'Atenção',
          description: 'Você está perto do limite mensal de análises NIJA.',
          variant: 'default',
        });
      }

      const options = getNaturezaOptions();
      const isOutro = naturezaPretensao === 'outro_prescricao' || naturezaPretensao === 'outro_decadencia';
      const natureza = isOutro 
        ? naturezaCustom 
        : options.find(o => o.value === naturezaPretensao)?.label || naturezaPretensao;

      const marco = getMarcoInicial();
      const selectedDocs = documents.filter((d) => selectedDocIds.includes(d.id));

      const { data, error } = await supabase.functions.invoke('nija-prescricao', {
        body: {
          tipoAnalise,
          naturezaPretensao: natureza,
          marcoInicial: marco,
          documentos: selectedDocs.map((d) => ({
            id: d.id,
            filename: d.filename,
            kind: d.kind,
          })),
          observacoes,
          // Include extracted document content if provided (opt-in)
          documentoConteudoExtraido: extractedDocContent || null,
          caso: {
            title: caso.title,
            cnj_number: caso.cnj_number,
            area: caso.area,
            subtype: caso.subtype,
            side: caso.side,
            status: caso.status,
            opponent_name: caso.opponent_name,
          },
          cliente: {
            full_name: cliente.full_name,
            person_type: cliente.person_type,
            cpf: cliente.cpf,
            cnpj: cliente.cnpj,
          },
        },
      });

      if (error) {
        // Check for overload/rate-limit errors
        const errorMsg = error.message?.toLowerCase() || '';
        const errorContext = (error as any).context?.message?.toLowerCase() || '';
        const status = (error as any).status || (error as any).context?.status;
        
        // Specific handling for 503 (overloaded)
        if (status === 503 || errorMsg.includes('overloaded') || errorContext.includes('overloaded')) {
          startCooldown();
          toast({
            title: 'Servidor ocupado',
            description: 'Servidor ocupado (deploy overloaded). Aguarde e tente novamente.',
            variant: 'destructive',
          });
          return;
        }
        
        const isOverloaded = 
          errorMsg.includes('rate limit') ||
          status === 429 || 
          status === 500 || 
          status === 504;

        if (isOverloaded) {
          startCooldown();
          toast({
            title: 'Servidor sobrecarregado',
            description: `O serviço está temporariamente indisponível. Aguarde ${COOLDOWN_SECONDS} segundos antes de tentar novamente.`,
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      setNotaTecnica(data.notaTecnica);
      setResultTipoAnalise(tipoAnalise);
      setStep('result');
    } catch (err: any) {
      console.error('Erro na análise:', err);
      
      // Check for overload in catch as well
      const errorMsg = err.message?.toLowerCase() || '';
      // Specific handling for 503 (overloaded)
      if (err.status === 503 || errorMsg.includes('overloaded')) {
        startCooldown();
        toast({
          title: 'Servidor ocupado',
          description: 'Servidor ocupado (deploy overloaded). Aguarde e tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      
      const isOverloaded = 
        errorMsg.includes('rate limit') ||
        err.status === 429 || 
        err.status === 500 || 
        err.status === 504;

      if (isOverloaded) {
        startCooldown();
        toast({
          title: 'Servidor sobrecarregado',
          description: `Aguarde ${COOLDOWN_SECONDS} segundos antes de tentar novamente.`,
          variant: 'destructive',
        });
        return;
      }

      const tipoLabel = tipoAnalise === 'decadencia' ? 'decadência' : 'prescrição';
      toast({
        title: 'Erro na análise',
        description: err.message || `Não foi possível executar a análise de ${tipoLabel}.`,
        variant: 'destructive',
      });
      // Keep modal open on any error
    } finally {
      setLoading(false);
      setIsRunning(false);
      inFlightRef.current = false;
    }
  };

  // Manual reset: only when user clicks 'Voltar'
  const handleBackToForm = useCallback(() => {
    setStep('form');
    setNotaTecnica('');
    setModoTextoJuridico(false);
  }, []);

  // Extract sections from nota técnica for Modo Texto Jurídico
  const extractSections = useCallback((text: string) => {
    const sections = {
      fundamentacao: '',
      pontosControvertidos: '',
      conclusao: '',
    };

    // Try to extract "Fundamentação Legal" section
    const fundamentacaoMatch = text.match(/(?:FUNDAMENTAÇÃO LEGAL|Fundamentação Legal|FUNDAMENTO LEGAL|Fundamento Legal)[:\s]*\n?([\s\S]*?)(?=(?:PONTOS? CONTROVERTIDOS?|Pontos? Controvertidos?|CONCLUS[ÃA]O|Conclus[ãa]o|$))/i);
    if (fundamentacaoMatch) {
      sections.fundamentacao = fundamentacaoMatch[1].trim();
    }

    // Try to extract "Pontos Controvertidos" section
    const pontosMatch = text.match(/(?:PONTOS? CONTROVERTIDOS?|Pontos? Controvertidos?)[:\s]*\n?([\s\S]*?)(?=(?:CONCLUS[ÃA]O|Conclus[ãa]o|$))/i);
    if (pontosMatch) {
      sections.pontosControvertidos = pontosMatch[1].trim();
    }

    // Try to extract "Conclusão" section
    const conclusaoMatch = text.match(/(?:CONCLUS[ÃA]O|Conclus[ãa]o)[:\s]*\n?([\s\S]*?)$/i);
    if (conclusaoMatch) {
      sections.conclusao = conclusaoMatch[1].trim();
    }

    return sections;
  }, []);

  const textoJuridicoSections = extractSections(notaTecnica);
  const hasJuridicSections = textoJuridicoSections.fundamentacao || textoJuridicoSections.pontosControvertidos || textoJuridicoSections.conclusao;

  // Generate clean text for petição (continuous prose, no headers)
  const generateTextoJuridico = useCallback(() => {
    const parts: string[] = [];
    
    if (textoJuridicoSections.fundamentacao) {
      parts.push(textoJuridicoSections.fundamentacao);
    }
    if (textoJuridicoSections.pontosControvertidos) {
      parts.push(textoJuridicoSections.pontosControvertidos);
    }
    if (textoJuridicoSections.conclusao) {
      parts.push(textoJuridicoSections.conclusao);
    }

    return parts.join('\n\n');
  }, [textoJuridicoSections]);

  const handleCopySection = async (section: 'fundamentacao' | 'pontos' | 'conclusao') => {
    let textToCopy = '';
    const sectionMap = {
      fundamentacao: textoJuridicoSections.fundamentacao,
      pontos: textoJuridicoSections.pontosControvertidos,
      conclusao: textoJuridicoSections.conclusao,
    };
    textToCopy = sectionMap[section];
    
    if (!textToCopy) {
      toast({ title: 'Seção vazia', description: 'Esta seção não está disponível.', variant: 'destructive' });
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
      const labels = { fundamentacao: 'Fundamentação', pontos: 'Pontos Controvertidos', conclusao: 'Conclusão' };
      toast({ title: 'Copiado!', description: `${labels[section]} copiada para a área de transferência.` });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  const PETICAO_DISCLAIMER = 'Texto elaborado com apoio de ferramenta de organização jurídica, sob revisão e responsabilidade técnica do advogado.';

  const handleSaveToTimeline = async () => {
    if (!caso) return;

    setSaving(true);
    try {
      const options = getNaturezaOptions();
      const isOutro = naturezaPretensao === 'outro_prescricao' || naturezaPretensao === 'outro_decadencia';
      const natureza = isOutro 
        ? naturezaCustom 
        : options.find(o => o.value === naturezaPretensao)?.label || naturezaPretensao;
      
      const marco = getMarcoInicial();
      const eventType = resultTipoAnalise === 'decadencia' ? 'nija_decadence_run' : 'nija_prescription_run';
      const tipoLabel = resultTipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição';

      // Get current user ID for verification tracking
      const { data: { user } } = await supabase.auth.getUser();
      const verificadoPor = user?.id || null;
      const verificadoEm = new Date().toISOString();

      const { error } = await supabase.rpc('log_case_event', {
        p_case_id: caso.id,
        p_event_type: eventType,
        p_title: `Análise NIJA ${tipoLabel}: ${natureza}`,
        p_payload: {
          tipo_analise: resultTipoAnalise,
          natureza_pretensao: natureza,
          marco_inicial: marco,
          documentos_analisados: selectedDocIds.length,
          observacoes: observacoes || null,
          nota_tecnica: notaTecnica,
          uso_peticao: modoTextoJuridico,
          // Audit fields
          executado_por: verificadoPor,
          executado_em: verificadoEm,
          cenario_selecionado: cenarioSelecionado || null,
          verificacao_humana: true,
          verificado_por: verificadoPor,
          verificado_em: verificadoEm,
          // Review fields (initially set based on verificacaoHumana checkbox)
          revisado: verificacaoHumana,
          revisado_por: verificacaoHumana ? verificadoPor : null,
          revisado_em: verificacaoHumana ? verificadoEm : null,
          observacoes_revisor: null,
        },
      });

      if (error) throw error;

      // Increment NIJA usage counter after successful save
      if (officeId) {
        try {
          const { data: newUsage } = await supabase.rpc('increment_nija_counter', { p_office_id: officeId });
          if (newUsage) {
            setUsageStats(newUsage as unknown as NijaUsageStats);
          }
        } catch (usageErr) {
          console.error('[NIJA] Error incrementing usage counter:', usageErr);
          // Don't fail the save if usage tracking fails
        }
      }

      toast({
        title: 'Análise salva',
        description: 'A nota técnica foi registrada no histórico do caso.',
      });

      onEventCreated();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível salvar no histórico.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(notaTecnica);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copiado!', description: 'Nota técnica copiada para a área de transferência.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  const readOnly = !canEdit || isArchived;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            NIJA · Análise de {tipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição'}
          </DialogTitle>
          <DialogDescription>
            Análise automatizada de prazos {tipoAnalise === 'decadencia' ? 'decadenciais' : 'prescricionais'} com base nos dados do caso
          </DialogDescription>
        </DialogHeader>

        {/* Usage Counter Badge */}
        {usageStats && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  usageStats.percentage >= 100 
                    ? 'bg-red-50 text-red-700 border-red-300' 
                    : usageStats.percentage >= 80 
                      ? 'bg-amber-50 text-amber-700 border-amber-300' 
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                <Clock className="h-3 w-3 mr-1" />
                {usageStats.current}/{usageStats.limit} análises neste mês
              </Badge>
              {usageStats.percentage >= 100 && (
                <Badge variant="outline" className="text-[10px] bg-red-100 text-red-800 border-red-400 animate-pulse">
                  Limite atingido – uso monitorado
                </Badge>
              )}
              {usageStats.percentage >= 80 && usageStats.percentage < 100 && (
                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-400">
                  {Math.round(100 - usageStats.percentage)}% restante
                </Badge>
              )}
            </div>
          </div>
        )}
        {loadingUsage && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando uso...
          </div>
        )}

        {/* Usage Warning Alert - 80%+ */}
        {usageStats && usageStats.percentage >= 80 && usageStats.percentage < 100 && (
          <Alert variant="default" className="border-amber-400 bg-amber-50">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 text-sm">Atenção: Limite Próximo</AlertTitle>
            <AlertDescription className="text-amber-700 text-xs">
              Você utilizou {usageStats.current} de {usageStats.limit} análises mensais ({Math.round(usageStats.percentage)}%). 
              Considere priorizar análises essenciais.
            </AlertDescription>
          </Alert>
        )}

        {/* Usage Warning Alert - 100%+ */}
        {usageStats && usageStats.percentage >= 100 && (
          <Alert variant="default" className="border-red-400 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800 text-sm">Limite Mensal Atingido</AlertTitle>
            <AlertDescription className="text-red-700 text-xs">
              O limite de {usageStats.limit} análises mensais foi atingido. A execução permanece permitida, 
              mas o uso está sendo monitorado. O contador será resetado no próximo mês.
            </AlertDescription>
          </Alert>
        )}

        {/* Legal Disclaimer */}
        <Alert variant="default" className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 text-sm">Aviso de Responsabilidade</AlertTitle>
          <AlertDescription className="text-amber-700 text-xs">
            Esta análise é meramente orientativa e não substitui a análise técnica do advogado 
            responsável. Os prazos podem variar conforme jurisprudência e particularidades do caso.
          </AlertDescription>
        </Alert>

        <ScrollArea className="flex-1 pr-4">
          {step === 'form' ? (
            <div className="space-y-4 py-2">
              {/* Área do Direito */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  Área do Direito
                  {caso?.area && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      Pré-preenchido do caso
                    </Badge>
                  )}
                </Label>
                <Select value={areaDireito} onValueChange={handleAreaChange} disabled={readOnly || isRunning}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background max-h-[300px]">
                    {AREA_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  A área do direito ajusta automaticamente as opções de natureza, marcos iniciais e alertas típicos.
                </p>
              </div>

              {/* Tipo de Análise */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  Tipo de Análise <span className="text-destructive">*</span>
                </Label>
                <Select value={tipoAnalise} onValueChange={handleTipoChange} disabled={readOnly || isRunning}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="prescricao">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-300">Prescrição</Badge>
                        <span className="text-xs text-muted-foreground">Perda da pretensão (direito de ação)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="decadencia">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-300">Decadência</Badge>
                        <span className="text-xs text-muted-foreground">Perda do próprio direito potestativo</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {tipoAnalise === 'decadencia' 
                    ? 'Decadência: extingue o próprio direito potestativo. Não se suspende nem interrompe (regra geral).'
                    : 'Prescrição: atinge a pretensão (ação judicial). Pode ser suspensa, interrompida ou renunciada.'}
                </p>
              </div>

              {/* Natureza da Pretensão/Direito */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  {tipoAnalise === 'decadencia' ? 'Natureza do Direito' : 'Natureza da Pretensão'} <span className="text-destructive">*</span>
                </Label>
                <Select value={naturezaPretensao} onValueChange={setNaturezaPretensao} disabled={readOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Selecione a natureza ${tipoAnalise === 'decadencia' ? 'do direito' : 'da pretensão'}`} />
                  </SelectTrigger>
                  <SelectContent className="bg-background max-h-[300px]">
                    {getNaturezaOptions().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(naturezaPretensao === 'outro_prescricao' || naturezaPretensao === 'outro_decadencia') && (
                  <Input
                    placeholder={`Descreva a natureza ${tipoAnalise === 'decadencia' ? 'do direito' : 'da pretensão'}`}
                    value={naturezaCustom}
                    onChange={(e) => setNaturezaCustom(e.target.value)}
                    disabled={readOnly}
                  />
                )}
              </div>

              {/* Marco Inicial */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Marco Inicial (Dies a Quo) <span className="text-destructive">*</span>
                </Label>
                <Select value={marcoInicialEventId} onValueChange={setMarcoInicialEventId} disabled={readOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um evento ou informe data" />
                  </SelectTrigger>
                  <SelectContent className="bg-background max-h-[250px]">
                    <SelectItem value="custom">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        Informar data manualmente
                      </span>
                    </SelectItem>
                    {caseEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {new Date(event.created_at).toLocaleDateString('pt-BR')}
                          </Badge>
                          <span className="truncate max-w-[300px]">{event.title}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Marco inicial suggestions */}
                {marcosIniciaisSuggestions.length > 0 && marcoInicialEventId === 'custom' && (
                  <div className="space-y-1 mt-2">
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      Marcos típicos para {currentPreset?.label}:
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {marcosIniciaisSuggestions.map((marco, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => setMarcoInicialCustomDesc(marco.label)}
                          disabled={readOnly}
                          title={marco.descricao}
                        >
                          {marco.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {marcoInicialEventId === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Data</Label>
                      <Input
                        type="date"
                        value={marcoInicialCustomDate}
                        onChange={(e) => setMarcoInicialCustomDate(e.target.value)}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Descrição do fato</Label>
                      <Input
                        placeholder="Ex: Data do sinistro"
                        value={marcoInicialCustomDesc}
                        onChange={(e) => setMarcoInicialCustomDesc(e.target.value)}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Area-specific alerts */}
              {areaAlertas.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-xs font-medium text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Alertas Típicos · {currentPreset?.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <ul className="space-y-1">
                      {areaAlertas.map((alerta, idx) => (
                        <li key={idx} className="text-[11px] text-amber-700 leading-relaxed">
                          {alerta}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Documentos */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Documentos do Caso
                  <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                </Label>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Nenhum documento disponível neste caso.
                  </p>
                ) : (
                  <div className="border rounded-lg p-2 max-h-[150px] overflow-y-auto space-y-1">
                    {documents.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedDocIds.includes(doc.id)}
                          onCheckedChange={() => handleDocToggle(doc.id)}
                          disabled={readOnly}
                        />
                        <span className="text-sm flex-1 truncate">{doc.filename}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {doc.kind}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
                
                {/* Document Content Extractor - only show if documents are selected */}
                {selectedDocIds.length > 0 && (
                  <NijaDocumentContentExtractor
                    documents={documents}
                    selectedDocIds={selectedDocIds}
                    onContentChange={setExtractedDocContent}
                    disabled={readOnly || isRunning}
                  />
                )}
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Observações Adicionais</Label>
                <Textarea
                  placeholder="Informações relevantes para a análise (causas de suspensão, interrupção, acordos anteriores, etc.)"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="min-h-[80px]"
                  disabled={readOnly}
                />
              </div>

              {readOnly && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {isArchived
                      ? 'Este caso está arquivado. Análises não podem ser executadas.'
                      : 'Você possui apenas permissão de visualização neste caso.'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            /* Result View */
            <div className="space-y-4 py-2">
              {/* Toggle Modo Texto Jurídico */}
              {hasJuridicSections && (
                <div className="flex items-center justify-end">
                  <Button
                    variant={modoTextoJuridico ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setModoTextoJuridico(!modoTextoJuridico)}
                    className="text-xs"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {modoTextoJuridico ? 'Modo Completo' : 'Modo Texto Jurídico'}
                  </Button>
                </div>
              )}

              {modoTextoJuridico ? (
                /* Modo Texto Jurídico - Clean peticionável view */
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Texto Jurídico Peticionável
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Fundamentação Legal */}
                    {textoJuridicoSections.fundamentacao && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fundamentação Legal</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleCopySection('fundamentacao')}
                          >
                            {copiedSection === 'fundamentacao' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span className="ml-1">Copiar</span>
                          </Button>
                        </div>
                        <div className="bg-muted/30 border rounded-lg p-3">
                          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                            {textoJuridicoSections.fundamentacao}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Pontos Controvertidos */}
                    {textoJuridicoSections.pontosControvertidos && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pontos Controvertidos</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleCopySection('pontos')}
                          >
                            {copiedSection === 'pontos' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span className="ml-1">Copiar</span>
                          </Button>
                        </div>
                        <div className="bg-muted/30 border rounded-lg p-3">
                          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                            {textoJuridicoSections.pontosControvertidos}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Conclusão */}
                    {textoJuridicoSections.conclusao && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conclusão</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleCopySection('conclusao')}
                          >
                            {copiedSection === 'conclusao' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span className="ml-1">Copiar</span>
                          </Button>
                        </div>
                        <div className="bg-muted/30 border rounded-lg p-3">
                          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                            {textoJuridicoSections.conclusao}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Discrete Footer Disclaimer */}
                    <div className="pt-3 border-t border-dashed">
                      <p className="text-[10px] text-muted-foreground italic text-center">
                        {PETICAO_DISCLAIMER}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                /* Modo Completo - Original view */
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Scale className="h-4 w-4 text-primary" />
                      Nota Técnica - Análise de {resultTipoAnalise === 'decadencia' ? 'Decadência' : 'Prescrição'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/30 border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                        {notaTecnica}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Strategy Compare Section */}
              {notaTecnica && caso && (
                <NijaStrategyCompare
                  caseId={caso.id}
                  tipoAnalise={resultTipoAnalise}
                  naturezaPretensao={
                    (naturezaPretensao === 'outro_prescricao' || naturezaPretensao === 'outro_decadencia')
                      ? naturezaCustom
                      : getNaturezaOptions().find(o => o.value === naturezaPretensao)?.label || naturezaPretensao
                  }
                  marcoInicial={getMarcoInicial()}
                  documentosAnalisados={selectedDocIds.length}
                  notaTecnicaBase={notaTecnica}
                  canEdit={canEdit}
                  isArchived={isArchived}
                  onSaved={() => {
                    onEventCreated();
                  }}
                  onCenarioSelected={(cenario) => setCenarioSelecionado(cenario)}
                />
              )}

              {/* Checklist Generator Section - After analysis is saved */}
              {notaTecnica && caso && (
                <NijaChecklistGenerator
                  caseId={caso.id}
                  tipoAnalise={resultTipoAnalise}
                  cenarioSelecionado={cenarioSelecionado}
                  naturezaPretensao={
                    (naturezaPretensao === 'outro_prescricao' || naturezaPretensao === 'outro_decadencia')
                      ? naturezaCustom
                      : getNaturezaOptions().find(o => o.value === naturezaPretensao)?.label || naturezaPretensao
                  }
                  canEdit={canEdit}
                  isArchived={isArchived}
                  onTasksCreated={() => {
                    onEventCreated();
                  }}
                />
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning}>
                Cancelar
              </Button>
              <div className="flex items-center gap-3">
                {/* Cooldown indicator */}
                {cooldownRemaining > 0 && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Clock className="h-4 w-4 animate-pulse" />
                    <span className="text-sm font-medium">Aguarde {cooldownRemaining}s</span>
                  </div>
                )}
                <Button
                  onClick={handleAnalyze}
                  disabled={!isFormValid() || loading || readOnly || isRunning || cooldownRemaining > 0}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : cooldownRemaining > 0 ? (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Aguardando...
                    </>
                  ) : (
                    <>
                      <Scale className="h-4 w-4 mr-2" />
                      Executar Análise
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBackToForm}>
                Voltar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copiar
                </Button>
                {canEdit && !isArchived && (
                  <div className="flex flex-col items-end gap-3">
                    {/* Human verification checkbox */}
                    <label className="flex items-start gap-2 max-w-md cursor-pointer group">
                      <Checkbox
                        checked={verificacaoHumana}
                        onCheckedChange={(checked) => setVerificacaoHumana(checked === true)}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                        Declaro que revisei criticamente esta análise e assumo responsabilidade técnica pelo seu conteúdo e aplicação.
                      </span>
                    </label>
                    <Button 
                      onClick={handleSaveToTimeline} 
                      disabled={saving || !verificacaoHumana}
                      title={!verificacaoHumana ? 'Confirme a verificação humana para salvar' : undefined}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Salvar no Histórico
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
