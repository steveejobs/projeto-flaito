import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  ListChecks,
  Plus,
  Trash2,
  Save,
  Check,
  AlertTriangle,
  GripVertical,
  Edit2,
  Clock,
  Target,
  Shield,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  stage: string;
  is_required: boolean;
  sort_order: number;
  enabled: boolean;
}

interface NijaChecklistGeneratorProps {
  caseId: string;
  tipoAnalise: 'prescricao' | 'decadencia';
  cenarioSelecionado?: 'conservador' | 'provavel' | 'agressivo' | null;
  naturezaPretensao: string;
  canEdit: boolean;
  isArchived: boolean;
  onTasksCreated: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  pre_processual: 'Pré-Processual',
  conhecimento: 'Conhecimento',
  recursal: 'Recursal',
  execucao: 'Execução',
};

const CENARIO_CONFIG = {
  conservador: {
    label: 'Conservador',
    icon: Shield,
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  provavel: {
    label: 'Provável',
    icon: Target,
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  agressivo: {
    label: 'Agressivo',
    icon: Zap,
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
  },
};

// Dynamic task templates based on analysis type and scenario
function generateTaskTemplates(
  tipoAnalise: 'prescricao' | 'decadencia',
  cenario: 'conservador' | 'provavel' | 'agressivo' | null
): TaskTemplate[] {
  const basePrefix = tipoAnalise === 'prescricao' ? 'Prescrição' : 'Decadência';
  
  const baseTasks: TaskTemplate[] = [
    {
      id: 'task_marco',
      title: `Verificar marco inicial da ${basePrefix.toLowerCase()}`,
      description: `Identificar e documentar a data exata do marco inicial. Verificar se há controvérsia sobre o termo a quo.`,
      stage: 'pre_processual',
      is_required: true,
      sort_order: 1,
      enabled: true,
    },
    {
      id: 'task_interrupcao',
      title: tipoAnalise === 'prescricao' 
        ? 'Conferir causas de interrupção/suspensão' 
        : 'Verificar causas impeditivas do prazo',
      description: tipoAnalise === 'prescricao'
        ? 'Analisar citação válida, protesto, confissão de dívida, despacho ordenador da citação e demais causas do art. 202 CC.'
        : 'Verificar se houve reclamação comprovada perante fornecedor (CDC) ou outras causas impeditivas específicas.',
      stage: 'pre_processual',
      is_required: true,
      sort_order: 2,
      enabled: true,
    },
    {
      id: 'task_jurisprudencia',
      title: 'Validar jurisprudência em fonte oficial',
      description: 'Pesquisar precedentes nos tribunais superiores (STJ/STF) e TJ local. Usar apenas fontes oficiais.',
      stage: 'pre_processual',
      is_required: true,
      sort_order: 3,
      enabled: true,
    },
  ];

  // Scenario-specific strategy tasks
  const strategyTasks: TaskTemplate[] = [];
  
  if (cenario === 'conservador') {
    strategyTasks.push({
      id: 'task_estrategia_conservador',
      title: 'Definir estratégia: Arguição como preliminar',
      description: 'Preparar arguição da prescrição/decadência como questão preliminar, com fundamentos consolidados na jurisprudência.',
      stage: 'pre_processual',
      is_required: true,
      sort_order: 4,
      enabled: true,
    });
  } else if (cenario === 'provavel') {
    strategyTasks.push({
      id: 'task_estrategia_provavel',
      title: 'Definir estratégia: Arguição com teses alternativas',
      description: 'Preparar arguição principal como preliminar e subsidiariamente como mérito. Apresentar teses alternativas de contagem do prazo.',
      stage: 'pre_processual',
      is_required: true,
      sort_order: 4,
      enabled: true,
    });
  } else if (cenario === 'agressivo') {
    strategyTasks.push({
      id: 'task_estrategia_agressivo',
      title: 'Definir estratégia: Teses inovadoras de contagem',
      description: 'Desenvolver argumentação para marcos iniciais alternativos (teoria da actio nata, ciência inequívoca). Preparar fundamentação robusta.',
      stage: 'pre_processual',
      is_required: true,
      sort_order: 4,
      enabled: true,
    });
  } else {
    // No scenario selected - generic task
    strategyTasks.push({
      id: 'task_estrategia_generica',
      title: `Definir estratégia de arguição da ${basePrefix.toLowerCase()}`,
      description: `Decidir entre: arguição como preliminar (art. 337 CPC), contestação de mérito, ou exceção. Avaliar momento processual adequado.`,
      stage: 'pre_processual',
      is_required: true,
      sort_order: 4,
      enabled: true,
    });
  }

  const pecaTasks: TaskTemplate[] = [
    {
      id: 'task_peca',
      title: 'Preparar peça processual',
      description: tipoAnalise === 'prescricao'
        ? 'Redigir petição/contestação com arguição de prescrição. Incluir demonstrativo de contagem do prazo e fundamentação legal.'
        : 'Redigir peça com arguição de decadência. Demonstrar exaurimento do prazo conforme natureza do direito potestativo.',
      stage: 'pre_processual',
      is_required: true,
      sort_order: 5,
      enabled: true,
    },
  ];

  // Add conditional tasks based on scenario intensity
  const additionalTasks: TaskTemplate[] = [];
  
  if (cenario === 'provavel' || cenario === 'agressivo') {
    additionalTasks.push({
      id: 'task_teses_alternativas',
      title: 'Documentar teses alternativas de contagem',
      description: 'Elaborar quadro comparativo com diferentes marcos iniciais possíveis e respectiva jurisprudência de apoio.',
      stage: 'pre_processual',
      is_required: false,
      sort_order: 6,
      enabled: true,
    });
  }

  if (cenario === 'agressivo') {
    additionalTasks.push({
      id: 'task_doutrina',
      title: 'Pesquisar doutrina de apoio',
      description: 'Buscar obras doutrinárias que fundamentem a tese inovadora. Citar autores de prestígio.',
      stage: 'pre_processual',
      is_required: false,
      sort_order: 7,
      enabled: true,
    });
  }

  return [...baseTasks, ...strategyTasks, ...pecaTasks, ...additionalTasks];
}

export function NijaChecklistGenerator({
  caseId,
  tipoAnalise,
  cenarioSelecionado,
  naturezaPretensao,
  canEdit,
  isArchived,
  onTasksCreated,
}: NijaChecklistGeneratorProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Generate initial tasks based on type and scenario
  const [tasks, setTasks] = useState<TaskTemplate[]>(() => 
    generateTaskTemplates(tipoAnalise, cenarioSelecionado || null)
  );

  const enabledTasks = useMemo(() => tasks.filter(t => t.enabled), [tasks]);
  const requiredCount = useMemo(() => enabledTasks.filter(t => t.is_required).length, [enabledTasks]);

  const handleToggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, enabled: !t.enabled } : t
    ));
  };

  const handleUpdateTask = (taskId: string, field: keyof TaskTemplate, value: string | boolean) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, [field]: value } : t
    ));
  };

  const handleAddTask = () => {
    const newId = `custom_${Date.now()}`;
    setTasks(prev => [
      ...prev,
      {
        id: newId,
        title: 'Nova tarefa',
        description: '',
        stage: 'pre_processual',
        is_required: false,
        sort_order: prev.length + 1,
        enabled: true,
      },
    ]);
    setEditingId(newId);
  };

  const handleRemoveTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (editingId === taskId) setEditingId(null);
  };

  const handleSaveTasks = async () => {
    if (enabledTasks.length === 0) {
      toast({
        title: 'Nenhuma tarefa selecionada',
        description: 'Selecione ao menos uma tarefa para criar.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Prepare tasks for insertion
      const tasksToInsert = enabledTasks.map((t, index) => ({
        case_id: caseId,
        title: t.title,
        description: t.description || null,
        stage: t.stage,
        is_required: t.is_required,
        sort_order: index + 1,
        status: 'todo',
      }));

      const { error } = await supabase
        .from('case_tasks')
        .insert(tasksToInsert);

      if (error) throw error;

      toast({
        title: 'Checklist criada',
        description: `${enabledTasks.length} tarefa(s) adicionada(s) ao caso.`,
      });

      onTasksCreated();
      setIsOpen(false);
    } catch (err: any) {
      console.error('[NIJA Checklist] Save error:', err);
      toast({
        title: 'Erro ao criar tarefas',
        description: err.message || 'Não foi possível salvar.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !canEdit || isArchived;
  const CenarioIcon = cenarioSelecionado ? CENARIO_CONFIG[cenarioSelecionado].icon : ListChecks;

  if (!isOpen) {
    return (
      <Card className="border-dashed border-primary/30 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ListChecks className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-medium">Gerar Checklist a partir da Análise</h4>
                <p className="text-xs text-muted-foreground">
                  Crie tarefas automáticas baseadas no tipo de análise
                  {cenarioSelecionado && (
                    <Badge variant="outline" className={`ml-2 text-[10px] ${CENARIO_CONFIG[cenarioSelecionado].badgeClass}`}>
                      {CENARIO_CONFIG[cenarioSelecionado].label}
                    </Badge>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
              disabled={readOnly}
            >
              <ListChecks className="h-4 w-4 mr-2" />
              Gerar Checklist
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
            <CenarioIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Checklist NIJA</CardTitle>
          </div>
          {cenarioSelecionado && (
            <Badge variant="outline" className={CENARIO_CONFIG[cenarioSelecionado].badgeClass}>
              Cenário: {CENARIO_CONFIG[cenarioSelecionado].label}
            </Badge>
          )}
        </div>
        <CardDescription>
          Tarefas sugeridas para {tipoAnalise === 'prescricao' ? 'Prescrição' : 'Decadência'} - {naturezaPretensao}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-muted/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Revise e edite as tarefas conforme necessário antes de criar. As tarefas serão adicionadas à checklist do caso.
          </AlertDescription>
        </Alert>

        <ScrollArea className="h-[320px] pr-2">
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`border rounded-lg p-3 transition-all ${
                  task.enabled 
                    ? 'bg-background border-border' 
                    : 'bg-muted/30 border-dashed border-muted-foreground/30 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={task.enabled}
                    onCheckedChange={() => handleToggleTask(task.id)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 min-w-0">
                    {editingId === task.id ? (
                      <div className="space-y-2">
                        <Input
                          value={task.title}
                          onChange={(e) => handleUpdateTask(task.id, 'title', e.target.value)}
                          placeholder="Título da tarefa"
                          className="text-sm"
                        />
                        <Textarea
                          value={task.description}
                          onChange={(e) => handleUpdateTask(task.id, 'description', e.target.value)}
                          placeholder="Descrição (opcional)"
                          className="text-xs min-h-[60px]"
                        />
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={task.is_required}
                              onCheckedChange={(checked) => 
                                handleUpdateTask(task.id, 'is_required', checked === true)
                              }
                            />
                            Obrigatória
                          </label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            OK
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{task.title}</span>
                          {task.is_required && (
                            <Badge variant="secondary" className="text-[10px] px-1">
                              Obrigatória
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px]">
                            {STAGE_LABELS[task.stage] || task.stage}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>

                  {editingId !== task.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingId(task.id)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      {task.id.startsWith('custom_') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveTask(task.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddTask}
            disabled={readOnly}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Tarefa
          </Button>

          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {enabledTasks.length} tarefa(s) · {requiredCount} obrigatória(s)
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveTasks}
                disabled={saving || enabledTasks.length === 0 || readOnly}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Criar Tarefas ({enabledTasks.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
