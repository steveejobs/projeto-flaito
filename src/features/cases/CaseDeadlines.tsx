import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Calendar, Trash2, Loader2, Check, AlertTriangle, Sparkles, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { NijaFullAnalysisResult } from '@/services/nijaFullAnalysis';

interface Deadline {
  id: string;
  case_id: string | null;
  title: string;
  due_date: string | null;
  status: string;
  created_at: string;
}

interface SuggestedDeadline {
  title: string;
  kind: string;
  days: number;
  notes: string;
  source: 'prescricao' | 'estrategia' | 'peca';
  priority: 'alta' | 'media' | 'baixa';
}

interface CaseDeadlinesProps {
  caseId: string;
  canEdit: boolean;
}

const KIND_OPTIONS = [
  { value: 'processual', label: 'Prazo Processual' },
  { value: 'material', label: 'Prazo Material' },
  { value: 'judicial', label: 'Prazo Judicial' },
  { value: 'interno', label: 'Prazo Interno' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Em aberto' },
  { value: 'done', label: 'Cumprido' },
  { value: 'overdue', label: 'Vencido' },
];

// Mapeamento de peças sugeridas para prazos típicos
const PIECE_DEADLINE_MAP: Record<string, { days: number; kind: string }> = {
  'CONTESTACAO': { days: 15, kind: 'processual' },
  'EMBARGOS': { days: 15, kind: 'processual' },
  'EMBARGOS_EXECUCAO': { days: 15, kind: 'processual' },
  'IMPUGNACAO': { days: 15, kind: 'processual' },
  'RECURSO': { days: 15, kind: 'processual' },
  'APELACAO': { days: 15, kind: 'processual' },
  'AGRAVO': { days: 15, kind: 'processual' },
  'AGRAVO_DE_INSTRUMENTO': { days: 15, kind: 'processual' },
  'REPLICA': { days: 15, kind: 'processual' },
  'EMENDA_INICIAL': { days: 15, kind: 'processual' },
  'PETICAO': { days: 5, kind: 'interno' },
  'MANIFESTACAO': { days: 5, kind: 'processual' },
  'ALEGACOES_FINAIS': { days: 15, kind: 'processual' },
};

/**
 * Extrai sugestões de prazos da análise NIJA
 */
function extractSuggestedDeadlines(analysis: NijaFullAnalysisResult | null): SuggestedDeadline[] {
  if (!analysis) return [];
  
  const suggestions: SuggestedDeadline[] = [];
  
  // 1. Prazo de prescrição (se houver risco)
  if (analysis.prescricao?.haPrescricao && analysis.prescricao.tipo !== 'NENHUMA') {
    const risco = analysis.prescricao.risco;
    const priority = risco === 'ALTO' ? 'alta' : risco === 'MEDIO' ? 'media' : 'baixa';
    
    suggestions.push({
      title: `⚠️ Atenção: Risco de Prescrição (${analysis.prescricao.tipo})`,
      kind: 'material',
      days: risco === 'ALTO' ? 30 : risco === 'MEDIO' ? 60 : 90,
      notes: analysis.prescricao.fundamentacao || 'Verificar prazo prescricional conforme análise NIJA.',
      source: 'prescricao',
      priority,
    });
  }
  
  // 2. Peças sugeridas pelas estratégias
  if (analysis.estrategias?.principais) {
    for (const estrategia of analysis.estrategias.principais) {
      if (estrategia.possiveisPecas) {
        for (const peca of estrategia.possiveisPecas) {
          const pecaUpper = peca.toUpperCase().replace(/\s+/g, '_');
          const deadlineConfig = PIECE_DEADLINE_MAP[pecaUpper] || 
            Object.entries(PIECE_DEADLINE_MAP).find(([key]) => pecaUpper.includes(key))?.[1];
          
          if (deadlineConfig) {
            // Evitar duplicatas
            const alreadyExists = suggestions.some(s => 
              s.title.toLowerCase().includes(peca.toLowerCase().replace(/_/g, ' '))
            );
            
            if (!alreadyExists) {
              const pecaLabel = peca.replace(/_/g, ' ').toLowerCase()
                .replace(/\b\w/g, l => l.toUpperCase());
              
              suggestions.push({
                title: pecaLabel,
                kind: deadlineConfig.kind,
                days: deadlineConfig.days,
                notes: estrategia.descricao || `Conforme estratégia: ${estrategia.label}`,
                source: 'estrategia',
                priority: 'media',
              });
            }
          }
        }
      }
    }
  }
  
  // 3. Peça sugerida diretamente
  if (analysis.sugestaoPeca?.tipo) {
    const pecaUpper = analysis.sugestaoPeca.tipo.toUpperCase().replace(/\s+/g, '_');
    const deadlineConfig = PIECE_DEADLINE_MAP[pecaUpper] || 
      Object.entries(PIECE_DEADLINE_MAP).find(([key]) => pecaUpper.includes(key))?.[1] ||
      { days: 15, kind: 'processual' };
    
    const alreadyExists = suggestions.some(s => 
      s.title.toLowerCase().includes(analysis.sugestaoPeca!.tipo.toLowerCase().replace(/_/g, ' '))
    );
    
    if (!alreadyExists) {
      suggestions.push({
        title: analysis.sugestaoPeca.tituloSugestao || analysis.sugestaoPeca.tipo.replace(/_/g, ' '),
        kind: deadlineConfig.kind,
        days: deadlineConfig.days,
        notes: analysis.sugestaoPeca.focoPrincipal || 'Peça sugerida pela análise NIJA.',
        source: 'peca',
        priority: 'alta',
      });
    }
  }
  
  // Ordenar por prioridade
  const priorityOrder = { alta: 0, media: 1, baixa: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return suggestions;
}

export function CaseDeadlines({ caseId, canEdit }: CaseDeadlinesProps) {
  const { toast } = useToast();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nijaAnalysis, setNijaAnalysis] = useState<NijaFullAnalysisResult | null>(null);
  const [creatingSuggested, setCreatingSuggested] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    kind: 'processual',
    start_date: new Date().toISOString().split('T')[0],
    days: 15,
    notes: '',
  });

  const fetchDeadlines = async () => {
    setLoading(true);
    try {
      // Buscar prazos e análise NIJA em paralelo
      const [deadlinesRes, caseRes] = await Promise.all([
        supabase
          .from('case_deadlines')
          .select('*')
          .eq('case_id', caseId)
          .order('due_date', { ascending: true }),
        supabase
          .from('cases')
          .select('nija_full_analysis')
          .eq('id', caseId)
          .single()
      ]);

      if (deadlinesRes.error) throw deadlinesRes.error;
      setDeadlines(deadlinesRes.data || []);
      
      // Parse análise NIJA se existir
      if (caseRes.data?.nija_full_analysis) {
        setNijaAnalysis(caseRes.data.nija_full_analysis as unknown as NijaFullAnalysisResult);
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeadlines();
  }, [caseId]);

  // Extrair sugestões da análise NIJA
  const suggestedDeadlines = useMemo(() => {
    return extractSuggestedDeadlines(nijaAnalysis);
  }, [nijaAnalysis]);

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'Erro', description: 'Título é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const dueDate = new Date(formData.start_date);
      dueDate.setDate(dueDate.getDate() + formData.days);

      const { error } = await supabase.from('case_deadlines').insert({
        case_id: caseId,
        title: `${formData.title.trim()} (${formData.kind})`,
        due_date: dueDate.toISOString(),
      });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Prazo criado' });
      setDialogOpen(false);
      setFormData({ title: '', kind: 'processual', start_date: new Date().toISOString().split('T')[0], days: 15, notes: '' });
      fetchDeadlines();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Criar prazo a partir de sugestão NIJA
  const handleCreateFromSuggestion = async (suggestion: SuggestedDeadline) => {
    setCreatingSuggested(suggestion.title);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + suggestion.days);

      const { error } = await supabase.from('case_deadlines').insert({
        case_id: caseId,
        title: `${suggestion.title} [NIJA]`,
        due_date: dueDate.toISOString(),
      });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Prazo criado a partir da sugestão NIJA' });
      fetchDeadlines();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingSuggested(null);
    }
  };

  const handleStatusChange = async (deadlineId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('case_deadlines')
        .update({ status: newStatus })
        .eq('id', deadlineId);

      if (error) throw error;
      fetchDeadlines();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (deadlineId: string) => {
    try {
      const { error } = await supabase
        .from('case_deadlines')
        .delete()
        .eq('id', deadlineId);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Prazo excluído' });
      fetchDeadlines();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      open: { className: 'bg-blue-100 text-blue-700', label: 'Em aberto' },
      done: { className: 'bg-green-100 text-green-700', label: 'Cumprido' },
      overdue: { className: 'bg-destructive/20 text-destructive', label: 'Vencido' },
    };
    const c = config[status] || config.open;
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Prazos
          </CardTitle>
          {suggestedDeadlines.length > 0 && (
            <CardDescription className="text-xs mt-1">
              {suggestedDeadlines.length} sugestão(ões) baseada(s) na análise NIJA
            </CardDescription>
          )}
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Novo Prazo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background">
              <DialogHeader>
                <DialogTitle>Novo Prazo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Contestação"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={formData.kind} onValueChange={(v) => setFormData({ ...formData, kind: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {KIND_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Dias</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.days}
                      onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar Prazo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Sugestões NIJA */}
            {suggestedDeadlines.length > 0 && canEdit && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Sugestões baseadas na análise NIJA
                </div>
                <div className="space-y-2">
                  {suggestedDeadlines.map((suggestion, idx) => {
                    // Verificar se já existe um prazo com esse título
                    const alreadyCreated = deadlines.some(d => 
                      d.title.toLowerCase().includes(suggestion.title.toLowerCase().slice(0, 20))
                    );
                    
                    if (alreadyCreated) return null;
                    
                    const priorityColors = {
                      alta: 'border-red-200 bg-red-50 dark:bg-red-950/30',
                      media: 'border-amber-200 bg-amber-50 dark:bg-amber-950/30',
                      baixa: 'border-blue-200 bg-blue-50 dark:bg-blue-950/30',
                    };
                    
                    const priorityBadge = {
                      alta: <Badge variant="destructive" className="text-[10px]">Urgente</Badge>,
                      media: <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">Atenção</Badge>,
                      baixa: <Badge variant="secondary" className="text-[10px]">Sugestão</Badge>,
                    };
                    
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${priorityColors[suggestion.priority]}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {suggestion.source === 'prescricao' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                            {suggestion.source === 'estrategia' && <Sparkles className="h-4 w-4 text-primary" />}
                            {suggestion.source === 'peca' && <Clock className="h-4 w-4 text-blue-600" />}
                            <span className="font-medium text-sm truncate">{suggestion.title}</span>
                            {priorityBadge[suggestion.priority]}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {suggestion.days} dias • {suggestion.notes}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 shrink-0"
                          onClick={() => handleCreateFromSuggestion(suggestion)}
                          disabled={creatingSuggested === suggestion.title}
                        >
                          {creatingSuggested === suggestion.title ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Criar
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Prazos cadastrados */}
            {deadlines.length === 0 && suggestedDeadlines.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Nenhum prazo cadastrado. Execute uma análise NIJA para receber sugestões de prazos.
              </p>
            ) : deadlines.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">
                Clique em "Criar" nas sugestões acima para adicionar prazos.
              </p>
            ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deadlines.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell>
                    {d.due_date ? new Date(d.due_date).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(d.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && d.status !== 'done' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusChange(d.id, 'done')}
                          title="Marcar cumprido"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(d.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
