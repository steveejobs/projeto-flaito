import { useState, useMemo, useEffect } from 'react';
import { DndContext, DragOverlay, DragStartEvent, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors, UniqueIdentifier, useDroppable, useDraggable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Briefcase, User, Scale, GripVertical, Search, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Database } from '@/integrations/supabase/types';
import { 
  getAllStates, 
  getCaseCurrentState, 
  transitionCaseState, 
  type CaseState, 
  type CaseCurrentState 
} from '@/services/caseState';

type Case = Tables<'cases'>;
type Client = Tables<'clients'>;
type CaseTask = {
  id: string;
  case_id: string;
  title: string;
  status: string;
  is_required: boolean;
};

interface CaseKanbanProps {
  cases: Case[];
  clients: Client[];
  onCasesChange: (cases: Case[]) => void;
  onCaseClick: (caseItem: Case) => void;
  userRole: 'owner' | 'editor' | 'viewer' | null;
  loading?: boolean;
}

// Generic interface for Kanban columns
interface KanbanColumn {
  id: string;
  label: string;
  description: string;
  className: string;
}

const STATUS_OPTIONS = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
  { value: 'AGUARDANDO', label: 'Aguardando' },
  { value: 'SUSPENSO', label: 'Suspenso' },
  { value: 'ARQUIVADO', label: 'Arquivado' },
  { value: 'ENCERRADO', label: 'Encerrado' },
];

// Draggable Case Card component
function DraggableCard({ 
  caseItem, 
  client, 
  canDrag,
  onClick 
}: { 
  caseItem: Case; 
  client?: Client;
  canDrag: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: caseItem.id,
    disabled: !canDrag,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-card border rounded-lg p-3 mb-2 cursor-pointer transition-all
        ${isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary z-50' : 'hover:shadow-md hover:border-primary/30'}
        ${!canDrag ? 'opacity-70' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {canDrag && (
          <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{caseItem.title || 'Sem título'}</p>
          {client && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <User className="h-3 w-3" />
              {client.full_name}
            </p>
          )}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {caseItem.area && (
              <Badge variant="outline" className="text-[10px] h-5">
                {caseItem.area}
              </Badge>
            )}
            <Badge 
              variant="secondary" 
              className={`text-[10px] h-5 ${
                caseItem.status === 'EM_ANDAMENTO' 
                  ? 'bg-green-100 text-green-700'
                  : caseItem.status === 'SUSPENSO'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {caseItem.status === 'EM_ANDAMENTO' ? 'Andamento' : 
               caseItem.status === 'AGUARDANDO' ? 'Aguardando' :
               caseItem.status === 'SUSPENSO' ? 'Suspenso' :
               caseItem.status === 'ARQUIVADO' ? 'Arquivado' :
               caseItem.status === 'ENCERRADO' ? 'Encerrado' : caseItem.status}
            </Badge>
            <Badge 
              variant="outline" 
              className={`text-[10px] h-5 ${
                caseItem.side === 'ATAQUE' 
                  ? 'border-blue-300 text-blue-600' 
                  : 'border-orange-300 text-orange-600'
              }`}
            >
              {caseItem.side === 'ATAQUE' ? 'Autor' : 'Réu'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

// Droppable Column component with generic KanbanColumn type
function DroppableColumn({ 
  column, 
  cases: columnCases, 
  clients, 
  canDragCase,
  onCaseClick,
  getClientById 
}: { 
  column: KanbanColumn;
  cases: Case[];
  clients: Client[];
  canDragCase: (c: Case) => boolean;
  onCaseClick: (c: Case) => void;
  getClientById: (id: string) => Client | undefined;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`bg-muted/20 rounded-lg ${column.className} ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
    >
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">{column.label}</h3>
            <p className="text-xs text-muted-foreground">{column.description}</p>
          </div>
          <Badge variant="secondary" className="h-6">
            {columnCases.length}
          </Badge>
        </div>
      </div>
      <ScrollArea className="h-[500px] p-2">
        <div className="min-h-[400px] p-1">
          {columnCases.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              Arraste processos aqui
            </div>
          ) : (
            columnCases.map(caseItem => (
              <DraggableCard
                key={caseItem.id}
                caseItem={caseItem}
                client={getClientById(caseItem.client_id)}
                canDrag={canDragCase(caseItem)}
                onClick={() => onCaseClick(caseItem)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function CaseKanban({ 
  cases, 
  clients, 
  onCasesChange, 
  onCaseClick, 
  userRole,
  loading 
}: CaseKanbanProps) {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState('TODAS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [pendenciasOnly, setPendenciasOnly] = useState(false);
  const [caseTasks, setCaseTasks] = useState<Record<string, CaseTask[]>>({});
  const [loadingTasks, setLoadingTasks] = useState(false);

  // FSM state data
  const [fsmStates, setFsmStates] = useState<CaseState[]>([]);
  const [caseStatesMap, setCaseStatesMap] = useState<Record<string, CaseCurrentState>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load FSM states once
  useEffect(() => {
    const loadFSM = async () => {
      const states = await getAllStates();
      setFsmStates(states.sort((a, b) => a.sort_order - b.sort_order));
    };
    loadFSM();
  }, []);

  // Load current state for each case
  useEffect(() => {
    const loadCaseStates = async () => {
      if (!cases?.length) return;
      const map: Record<string, CaseCurrentState> = {};
      for (const c of cases) {
        const cs = await getCaseCurrentState(c.id);
        if (cs) map[c.id] = cs;
      }
      setCaseStatesMap(map);
    };
    loadCaseStates();
  }, [cases]);

  // Get unique areas from cases
  const availableAreas = useMemo(() => {
    const areas = [...new Set(cases.map(c => c.area).filter(Boolean))].sort();
    return ['TODAS', ...areas] as string[];
  }, [cases]);

  // Fetch tasks for pendências filter
  const fetchCaseTasks = async (caseIds: string[]) => {
    if (caseIds.length === 0) return;
    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from('case_tasks')
        .select('id, case_id, title, status, is_required')
        .in('case_id', caseIds);
      
      if (error) throw error;

      const tasksByCase: Record<string, CaseTask[]> = {};
      data?.forEach(task => {
        if (!tasksByCase[task.case_id]) tasksByCase[task.case_id] = [];
        tasksByCase[task.case_id].push(task);
      });
      setCaseTasks(tasksByCase);
    } catch (err) {
      console.error('Erro ao carregar tasks:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Load tasks when pendenciasOnly is enabled
  useEffect(() => {
    if (pendenciasOnly && Object.keys(caseTasks).length === 0 && cases.length > 0) {
      fetchCaseTasks(cases.map(c => c.id));
    }
  }, [pendenciasOnly, cases]);

  // Check if case has pending required tasks
  const hasPendingTasks = (caseId: string) => {
    const tasks = caseTasks[caseId] || [];
    return tasks.some(t => t.is_required && t.status !== 'done' && t.status !== 'skipped');
  };

  // Filter cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesSearch = !searchTerm || 
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clients.find(cl => cl.id === c.client_id)?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesArea = areaFilter === 'TODAS' || c.area === areaFilter;
      const matchesStatus = statusFilter === 'TODOS' || c.status === statusFilter;
      const matchesPendencias = !pendenciasOnly || hasPendingTasks(c.id);
      return matchesSearch && matchesArea && matchesStatus && matchesPendencias;
    });
  }, [cases, searchTerm, areaFilter, statusFilter, pendenciasOnly, caseTasks, clients]);

  // Group cases by FSM state code (instead of legacy stage)
  const casesByState = useMemo(() => {
    const grouped: Record<string, Case[]> = {};
    fsmStates.forEach(s => grouped[s.code] = []);

    filteredCases.forEach(c => {
      const current = caseStatesMap[c.id];
      const state = fsmStates.find(s => s.id === current?.current_state_id);
      const code = state?.code ?? 'INTAKE'; // fallback to first state
      if (grouped[code]) {
        grouped[code].push(c);
      } else if (fsmStates.length > 0) {
        // If code doesn't match any state, put in first available state
        grouped[fsmStates[0].code] = grouped[fsmStates[0].code] || [];
        grouped[fsmStates[0].code].push(c);
      }
    });
    return grouped;
  }, [filteredCases, caseStatesMap, fsmStates]);

  const getClientById = (clientId: string) => clients.find(c => c.id === clientId);

  // Check if case can be dragged (FSM-aware)
  const canDragCase = (caseItem: Case) => {
    // Viewer cannot drag
    if (userRole === 'viewer') return false;
    
    // Check if current state is terminal
    const current = caseStatesMap[caseItem.id];
    const state = fsmStates.find(s => s.id === current?.current_state_id);
    if (state?.is_terminal) return false;
    
    return true;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const caseItem = cases.find(c => c.id === event.active.id);
    if (caseItem && !canDragCase(caseItem)) {
      return;
    }
    setActiveId(event.active.id);
  };

  // Handle drag end with FSM UUID transition
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const caseId = active.id as string;
    const targetStateCode = over.id as string;

    // Resolve target state by code
    const targetState = fsmStates.find(s => s.code === targetStateCode);
    if (!targetState) {
      toast({
        title: 'Erro',
        description: 'Coluna não mapeada para estado FSM.',
        variant: 'destructive',
      });
      return;
    }

    const current = caseStatesMap[caseId];
    
    // If already in the same state, do nothing
    if (current?.current_state_id === targetState.id) return;

    // Block if current state is terminal
    const currentState = fsmStates.find(s => s.id === current?.current_state_id);
    if (currentState?.is_terminal) {
      toast({
        title: 'Ação não permitida',
        description: 'Processo encerrado não pode ser movido.',
        variant: 'destructive',
      });
      return;
    }

    // Use FSM transition RPC with correct UUID
    const result = await transitionCaseState(
      caseId, 
      targetState.id,  // UUID, not string code
      'Movido via Kanban'
    );

    if (!result.success) {
      // Error already shown via toast in transitionCaseState
      return;
    }

    toast({
      title: 'Estado atualizado',
      description: `Processo movido para: ${targetState.name}`,
    });

    // Refresh the case state map
    const updated = await getCaseCurrentState(caseId);
    if (updated) {
      setCaseStatesMap(prev => ({ ...prev, [caseId]: updated }));
    }
  };

  const activeCase = activeId ? cases.find(c => c.id === activeId) : null;

  const clearFilters = () => {
    setSearchTerm('');
    setAreaFilter('TODAS');
    setStatusFilter('TODOS');
    setPendenciasOnly(false);
  };

  const hasActiveFilters = searchTerm || areaFilter !== 'TODAS' || statusFilter !== 'TODOS' || pendenciasOnly;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Build dynamic columns from FSM states
  const kanbanColumns: KanbanColumn[] = fsmStates.map(state => ({
    id: state.code,
    label: state.name,
    description: `Ordem: ${state.sort_order}`,
    className: state.is_terminal 
      ? 'border-t-4 border-t-gray-400' 
      : 'border-t-4 border-t-blue-500'
  }));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9"
          />
          {searchTerm && (
            <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="h-9 px-2">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Área:</Label>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {availableAreas.map(area => (
                <SelectItem key={area} value={area}>
                  {area === 'TODAS' ? 'Todas' : area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="pendencias"
            checked={pendenciasOnly}
            onCheckedChange={setPendenciasOnly}
          />
          <Label htmlFor="pendencias" className="text-sm cursor-pointer flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            Somente pendências
          </Label>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            Limpar filtros
          </Button>
        )}
        
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredCases.length} de {cases.length} processos
        </span>
      </div>

      {/* Kanban Columns - Dynamic from FSM */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={`grid gap-4 overflow-x-auto ${
          kanbanColumns.length <= 3 
            ? 'grid-cols-1 md:grid-cols-3' 
            : kanbanColumns.length <= 5
            ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5'
            : 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7'
        }`}>
          {kanbanColumns.map(column => (
            <DroppableColumn
              key={column.id}
              column={column}
              cases={casesByState[column.id] || []}
              clients={clients}
              canDragCase={canDragCase}
              onCaseClick={onCaseClick}
              getClientById={getClientById}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCase ? (
            <div className="bg-card border rounded-lg p-3 shadow-lg ring-2 ring-primary">
              <p className="font-medium text-sm">{activeCase.title || 'Sem título'}</p>
              <p className="text-xs text-muted-foreground">{getClientById(activeCase.client_id)?.full_name}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
