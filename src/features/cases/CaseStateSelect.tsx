/**
 * CaseStateSelect - Unified FSM state selector.
 * Replaces CaseStatusSelect and CaseStageSelect.
 * Uses RPC for transitions, never direct updates.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getCaseCurrentState,
  getNextStates,
  transitionCaseState,
  getAllStates,
  type CaseState,
  type CaseCurrentState,
  type NextStateOption,
} from "@/services/caseState";

interface CaseStateSelectProps {
  caseId: string;
  currentStateId?: string | null;
  onTransition?: () => void;
  disabled?: boolean;
  showCurrentLabel?: boolean;
}

export function CaseStateSelect({
  caseId,
  currentStateId: propStateId,
  onTransition,
  disabled,
  showCurrentLabel = true,
}: CaseStateSelectProps) {
  const [currentState, setCurrentState] = useState<CaseCurrentState | null>(null);
  const [nextStates, setNextStates] = useState<NextStateOption[]>([]);
  const [allFsmStates, setAllFsmStates] = useState<CaseState[]>([]);
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const loadData = useCallback(async () => {
    if (!caseId) return;
    
    setLoading(true);
    try {
      const [stateData, next, states] = await Promise.all([
        getCaseCurrentState(caseId),
        getNextStates(caseId),
        getAllStates(),
      ]);
      
      setCurrentState(stateData);
      setNextStates(next);
      setAllFsmStates(states);
    } catch (err) {
      console.error("[CaseStateSelect] Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTransition = async (toStateId: string) => {
    if (!caseId || transitioning) return;
    
    setTransitioning(true);
    try {
      const result = await transitionCaseState(caseId, toStateId);
      
      if (result.success) {
        toast.success("Estado atualizado com sucesso");
        await loadData();
        onTransition?.();
      }
    } finally {
      setTransitioning(false);
    }
  };

  // Determine the effective current state ID
  const effectiveStateId = propStateId ?? currentState?.current_state_id;
  
  // Find the actual FSM state to check is_terminal
  const currentFsmState = allFsmStates.find(s => s.id === effectiveStateId);
  const isTerminal = !!currentFsmState?.is_terminal;
  
  // Find current state in next states for display
  const currentOption = nextStates.find((s) => s.to_state_id === effectiveStateId);
  const displayValue = effectiveStateId || "";
  const displayLabelFallback = currentOption?.to_state_name || 
    (effectiveStateId ? `Estado: ${effectiveStateId.slice(0, 8)}...` : "Sem estado");
  const displayLabel = isTerminal 
    ? `${currentFsmState?.name ?? 'Encerrado'} (Terminal)`
    : (currentFsmState?.name ?? displayLabelFallback);

  // Available options (exclude current)
  const availableOptions = nextStates.filter((s) => s.to_state_id !== effectiveStateId);

  return (
    <Select
      value={displayValue}
      onValueChange={(value) => handleTransition(value)}
      disabled={disabled || loading || transitioning || isTerminal}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={loading ? "Carregando..." : "Selecione o estado"}>
          {showCurrentLabel && displayLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Show current state as first option (disabled) */}
        {effectiveStateId && (
          <SelectItem value={effectiveStateId} disabled>
            {displayLabel} (atual)
          </SelectItem>
        )}
        
        {/* Available transitions */}
        {availableOptions.length > 0 ? (
          availableOptions.map((option) => (
            <SelectItem key={option.to_state_id} value={option.to_state_id}>
              {option.to_state_name}
            </SelectItem>
          ))
        ) : (
          <SelectItem value="_none" disabled>
            Nenhuma transição disponível
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
