import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckSquare, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CaseTask {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  status: string;
  stage: string;
  is_required: boolean;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
}

interface CaseChecklistProps {
  caseId: string;
  stage: string;
  canEdit: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  pre_processual: 'Pré-Processual',
  judicializado: 'Judicializado',
  arquivado: 'Arquivado',
};

export function CaseChecklist({ caseId, stage, canEdit }: CaseChecklistProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [caseId]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('case_tasks')
        .select('*')
        .eq('case_id', caseId)
        .order('stage', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o checklist.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (task: CaseTask) => {
    if (!canEdit) {
      toast({
        title: 'Sem permissão',
        description: 'Você não tem permissão para alterar o checklist.',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingTaskId(task.id);
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt } : t
      )
    );

    try {
      const { error } = await supabase
        .from('case_tasks')
        .update({ status: newStatus, completed_at: completedAt })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: newStatus === 'done' ? 'Tarefa concluída' : 'Tarefa reaberta',
        description: task.title,
      });
    } catch (err) {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: task.status, completed_at: task.completed_at } : t
        )
      );
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a tarefa.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const groupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.stage]) acc[task.stage] = [];
    acc[task.stage].push(task);
    return acc;
  }, {} as Record<string, CaseTask[]>);

  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const totalCount = tasks.length;
  const requiredPending = tasks.filter((t) => t.is_required && t.status !== 'done').length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Checklist Processual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma tarefa cadastrada para este caso.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Checklist Processual
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {completedCount}/{totalCount} concluídas
            </Badge>
            {requiredPending > 0 && (
              <Badge variant="destructive" className="text-xs">
                {requiredPending} obrigatória(s) pendente(s)
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">
          Tarefas obrigatórias para progressão de fase do processo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedTasks).map(([taskStage, stageTasks]) => (
          <div key={taskStage} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant={taskStage === stage ? 'default' : 'outline'}
                className="text-[10px]"
              >
                {STAGE_LABELS[taskStage] || taskStage}
              </Badge>
              {taskStage === stage && (
                <span className="text-[10px] text-muted-foreground">(fase atual)</span>
              )}
            </div>
            <div className="space-y-1 ml-1">
              {stageTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-2 rounded-md transition-colors ${
                    task.status === 'done'
                      ? 'bg-green-50 border border-green-200'
                      : task.is_required
                      ? 'bg-amber-50/50 border border-amber-200/50'
                      : 'bg-muted/30'
                  }`}
                >
                  <Checkbox
                    id={task.id}
                    checked={task.status === 'done'}
                    onCheckedChange={() => toggleTask(task)}
                    disabled={updatingTaskId === task.id || !canEdit}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={task.id}
                      className={`text-sm cursor-pointer ${
                        task.status === 'done' ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {task.title}
                      {task.is_required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </label>
                    {task.description && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground inline-block ml-1 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[250px]">
                            <p className="text-xs">{task.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {task.completed_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Concluída em {new Date(task.completed_at).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  {updatingTaskId === task.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
