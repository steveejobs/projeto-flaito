import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Loader2, 
  Scale, 
  Shield, 
  Target, 
  Zap,
  ChevronDown,
  ChevronUp,
  Save,
  Copy,
  Check,
  AlertTriangle,
  Lightbulb,
  FileWarning,
  ListChecks
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface StrategyCenario {
  tipo: 'conservador' | 'provavel' | 'agressivo';
  tese_central: string;
  fundamentos_legais: string[];
  pontos_controvertidos: string[];
  riscos_contramedidas: Array<{ risco: string; contramedida: string }>;
  proximos_passos: string[];
}

interface NijaStrategyCompareProps {
  caseId: string;
  tipoAnalise: 'prescricao' | 'decadencia';
  naturezaPretensao: string;
  marcoInicial: { data: string; descricao: string };
  documentosAnalisados: number;
  notaTecnicaBase: string;
  canEdit: boolean;
  isArchived: boolean;
  onSaved: () => void;
  onCenarioSelected?: (cenario: 'conservador' | 'provavel' | 'agressivo' | null) => void;
}

const CENARIO_CONFIG = {
  conservador: {
    label: 'Conservador',
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Menor risco, argumentos consolidados',
  },
  provavel: {
    label: 'Provável',
    icon: Target,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Equilíbrio entre risco e resultado',
  },
  agressivo: {
    label: 'Agressivo',
    icon: Zap,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    description: 'Maior risco, teses inovadoras',
  },
};

export function NijaStrategyCompare({
  caseId,
  tipoAnalise,
  naturezaPretensao,
  marcoInicial,
  documentosAnalisados,
  notaTecnicaBase,
  canEdit,
  isArchived,
  onSaved,
  onCenarioSelected,
}: NijaStrategyCompareProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cenarios, setCenarios] = useState<StrategyCenario[] | null>(null);
  const [expandedCenarios, setExpandedCenarios] = useState<Set<string>>(new Set(['conservador', 'provavel', 'agressivo']));
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [verificacaoHumana, setVerificacaoHumana] = useState(false);
  const [selectedCenario, setSelectedCenario] = useState<'conservador' | 'provavel' | 'agressivo' | null>(null);

  const handleSelectCenario = useCallback((cenario: 'conservador' | 'provavel' | 'agressivo') => {
    const newValue = selectedCenario === cenario ? null : cenario;
    setSelectedCenario(newValue);
    onCenarioSelected?.(newValue);
  }, [selectedCenario, onCenarioSelected]);

  const generateComparison = useCallback(async () => {
    setLoading(true);
    setCenarios(null);

    try {
      // QUOTA CHECK: run_nija_with_quota before executing
      const { data: quotaResult, error: quotaError } = await supabase.rpc('run_nija_with_quota', {
        p_case_id: caseId,
        p_module: 'strategy_compare',
      });

      if (quotaError) {
        console.error('[NIJA Strategy] Quota check error:', quotaError);
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

      const { data, error } = await supabase.functions.invoke('nija-strategy-compare', {
        body: {
          tipoAnalise,
          naturezaPretensao,
          marcoInicial,
          notaTecnicaBase,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.cenarios && Array.isArray(data.cenarios)) {
        setCenarios(data.cenarios);
        toast({
          title: 'Comparação gerada',
          description: '3 cenários estratégicos foram elaborados.',
        });
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (err: any) {
      console.error('[NIJA Strategy] Error:', err);
      toast({
        title: 'Erro na comparação',
        description: err.message || 'Não foi possível gerar os cenários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [caseId, tipoAnalise, naturezaPretensao, marcoInicial, notaTecnicaBase, toast]);

  const handleSaveToTimeline = useCallback(async () => {
    if (!cenarios || cenarios.length === 0) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const verificadoPor = user?.id || null;
      const verificadoEm = new Date().toISOString();

      // Convert cenarios to plain objects for JSON compatibility
      const cenariosPayload = cenarios.map(c => ({
        tipo: c.tipo,
        tese_central: c.tese_central,
        fundamentos_legais: c.fundamentos_legais,
        pontos_controvertidos: c.pontos_controvertidos,
        riscos_contramedidas: c.riscos_contramedidas.map(rc => ({
          risco: rc.risco,
          contramedida: rc.contramedida,
        })),
        proximos_passos: c.proximos_passos,
      }));

      const { error } = await supabase.rpc('log_case_event', {
        p_case_id: caseId,
        p_event_type: 'nija_strategy_compare',
        p_title: `Comparação de Teses NIJA: ${naturezaPretensao}`,
        p_payload: JSON.parse(JSON.stringify({
          cenarios: cenariosPayload,
          entradas: {
            tipoAnalise,
            marco: marcoInicial,
            natureza: naturezaPretensao,
            docs: documentosAnalisados,
          },
          verificacao_humana: true,
          verificado_por: verificadoPor,
          verificado_em: verificadoEm,
        })),
      });

      if (error) throw error;

      toast({
        title: 'Comparação salva',
        description: 'Os cenários estratégicos foram registrados no histórico.',
      });

      onSaved();
    } catch (err: any) {
      console.error('[NIJA Strategy] Save error:', err);
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível salvar.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [caseId, cenarios, tipoAnalise, naturezaPretensao, marcoInicial, documentosAnalisados, toast, onSaved]);

  const handleCopy = useCallback(async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemId);
      setTimeout(() => setCopiedItem(null), 2000);
      toast({ title: 'Copiado!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  }, [toast]);

  const toggleCenario = useCallback((tipo: string) => {
    setExpandedCenarios(prev => {
      const next = new Set(prev);
      if (next.has(tipo)) {
        next.delete(tipo);
      } else {
        next.add(tipo);
      }
      return next;
    });
  }, []);

  const readOnly = !canEdit || isArchived;

  // Not generated yet - show button
  if (!cenarios) {
    return (
      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <h3 className="font-semibold">Comparar Teses</h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Gere 3 cenários estratégicos (Conservador, Provável, Agressivo) 
              com teses, fundamentos, riscos e próximos passos para cada abordagem.
            </p>
            <Button
              onClick={generateComparison}
              disabled={loading || readOnly}
              className="mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando cenários...
                </>
              ) : (
                <>
                  <Scale className="h-4 w-4 mr-2" />
                  Gerar Comparação de Teses
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show generated scenarios
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Comparação de Teses
        </h3>
        <div className="flex items-center gap-2">
          {selectedCenario && (
            <Badge className={CENARIO_CONFIG[selectedCenario].badgeClass}>
              {CENARIO_CONFIG[selectedCenario].label} selecionado
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            3 cenários
          </Badge>
        </div>
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-3 pr-2">
          {cenarios.map((cenario) => {
            const config = CENARIO_CONFIG[cenario.tipo];
            const Icon = config.icon;
            const isExpanded = expandedCenarios.has(cenario.tipo);

            return (
              <Card 
                key={cenario.tipo} 
                className={`border ${config.bgColor} ${selectedCenario === cenario.tipo ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              >
                <Collapsible open={isExpanded} onOpenChange={() => toggleCenario(cenario.tipo)}>
                  <CardHeader className="py-3 px-4">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${config.color}`} />
                          <div>
                            <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Select Scenario Button */}
                          <Button
                            variant={selectedCenario === cenario.tipo ? "default" : "outline"}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCenario(cenario.tipo);
                            }}
                          >
                            {selectedCenario === cenario.tipo ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Selecionado
                              </>
                            ) : (
                              'Selecionar'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = `${config.label.toUpperCase()}\n\nTese Central:\n${cenario.tese_central}\n\nFundamentos Legais:\n${cenario.fundamentos_legais.join('\n')}\n\nPontos Controvertidos:\n${cenario.pontos_controvertidos.join('\n')}\n\nRiscos e Contramedidas:\n${cenario.riscos_contramedidas.map(r => `• ${r.risco} → ${r.contramedida}`).join('\n')}\n\nPróximos Passos:\n${cenario.proximos_passos.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
                              handleCopy(text, cenario.tipo);
                            }}
                          >
                            {copiedItem === cenario.tipo ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="py-3 px-4 space-y-4">
                      {/* Tese Central */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Tese Central
                          </span>
                        </div>
                        <p className="text-sm bg-background/80 rounded p-2 border">
                          {cenario.tese_central}
                        </p>
                      </div>

                      {/* Fundamentos Legais */}
                      {cenario.fundamentos_legais.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Fundamentos Legais
                            </span>
                          </div>
                          <ul className="text-sm space-y-1 bg-background/80 rounded p-2 border">
                            {cenario.fundamentos_legais.map((f, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-primary">•</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Pontos Controvertidos */}
                      {cenario.pontos_controvertidos.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <FileWarning className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Pontos Controvertidos
                            </span>
                          </div>
                          <ul className="text-sm space-y-1 bg-background/80 rounded p-2 border">
                            {cenario.pontos_controvertidos.map((p, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-amber-600">⚠</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Riscos e Contramedidas */}
                      {cenario.riscos_contramedidas.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Riscos e Contramedidas
                            </span>
                          </div>
                          <div className="space-y-2 bg-background/80 rounded p-2 border">
                            {cenario.riscos_contramedidas.map((rc, i) => (
                              <div key={i} className="text-sm">
                                <div className="flex items-start gap-1.5">
                                  <span className="text-red-500 font-medium">↳</span>
                                  <span className="text-red-700">{rc.risco}</span>
                                </div>
                                <div className="flex items-start gap-1.5 ml-4 mt-0.5">
                                  <span className="text-green-500 font-medium">↪</span>
                                  <span className="text-green-700">{rc.contramedida}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Próximos Passos */}
                      {cenario.proximos_passos.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Próximos Passos
                            </span>
                          </div>
                          <ol className="text-sm space-y-1 bg-background/80 rounded p-2 border list-decimal list-inside">
                            {cenario.proximos_passos.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Save Actions */}
      {canEdit && !isArchived && (
        <div className="flex flex-col items-end gap-3 pt-2 border-t">
          <label className="flex items-start gap-2 max-w-md cursor-pointer group">
            <Checkbox
              checked={verificacaoHumana}
              onCheckedChange={(checked) => setVerificacaoHumana(checked === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
              Declaro que revisei criticamente esta comparação de teses e assumo responsabilidade técnica.
            </span>
          </label>
          <Button
            onClick={handleSaveToTimeline}
            disabled={saving || !verificacaoHumana}
            size="sm"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Comparação no Histórico
              </>
            )}
          </Button>
        </div>
      )}

      {/* Regenerate Button */}
      <div className="flex justify-center pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={generateComparison}
          disabled={loading}
          className="text-xs"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Scale className="h-3 w-3 mr-1" />
          )}
          Regenerar Cenários
        </Button>
      </div>

      {/* Disclaimer */}
      <Alert variant="default" className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-amber-700">
          Os cenários são orientativos e não substituem a análise técnica do advogado. 
          Os fundamentos citados devem ser verificados em fontes oficiais.
        </AlertDescription>
      </Alert>
    </div>
  );
}
