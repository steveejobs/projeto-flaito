// src/components/AthenaSuggestionCard.tsx
// Card visual para sugestões proativas com confirmação de ação
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle,
  ChevronRight,
  FileText,
  Loader2,
  Scale,
  Stethoscope,
  X,
} from "lucide-react";
import type { AthenaSuggestion } from "@/hooks/useAthenaSuggestions";

interface AthenaSuggestionCardProps {
  suggestion: AthenaSuggestion;
  onDismiss: (id: string) => void;
  onExecute: (suggestion: AthenaSuggestion) => Promise<{
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
    navigate_to?: string;
  }>;
  isExecuting?: boolean;
}

const CATEGORY_CONFIG: Record<string, {
  icon: React.ReactNode;
  color: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
}> = {
  agenda: { icon: <Calendar className="h-3.5 w-3.5" />, color: "text-blue-600", badgeVariant: "secondary" },
  legal: { icon: <Scale className="h-3.5 w-3.5" />, color: "text-indigo-600", badgeVariant: "secondary" },
  medical: { icon: <Stethoscope className="h-3.5 w-3.5" />, color: "text-green-600", badgeVariant: "secondary" },
  document: { icon: <FileText className="h-3.5 w-3.5" />, color: "text-amber-600", badgeVariant: "secondary" },
  alert: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-red-600", badgeVariant: "destructive" },
  followup: { icon: <Bell className="h-3.5 w-3.5" />, color: "text-purple-600", badgeVariant: "secondary" },
};

const PRIORITY_STYLES: Record<string, { border: string; bg: string; dot: string }> = {
  high: { border: "border-l-red-500", bg: "bg-red-50 dark:bg-red-950/30", dot: "bg-red-500" },
  medium: { border: "border-l-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30", dot: "bg-amber-400" },
  low: { border: "border-l-blue-400", bg: "bg-blue-50/50 dark:bg-blue-950/20", dot: "bg-blue-400" },
};

export function AthenaSuggestionCard({
  suggestion,
  onDismiss,
  onExecute,
  isExecuting = false,
}: AthenaSuggestionCardProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryConfig = CATEGORY_CONFIG[suggestion.category] || CATEGORY_CONFIG.alert;
  const priorityStyle = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES.low;

  const handleExecute = async () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    setError(null);
    const result = await onExecute(suggestion);

    if (result.success) {
      setExecuted(true);
      // If result has a navigation, let parent handle it
    } else {
      setError(result.error || "Erro ao executar ação.");
      setConfirmed(false);
    }
  };

  if (executed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400">
        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium">Ação executada com sucesso.</span>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-lg border-l-4 border border-border/50 p-3 text-xs transition-all ${priorityStyle.border} ${priorityStyle.bg}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className={`flex-shrink-0 ${categoryConfig.color}`}>
            {categoryConfig.icon}
          </span>
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityStyle.dot}`} />
          <span className="font-semibold text-foreground leading-tight truncate">
            {suggestion.title}
          </span>
        </div>
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          title="Dispensar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Description */}
      <p className="text-muted-foreground leading-relaxed mb-2.5">
        {suggestion.description}
      </p>

      {/* Error message */}
      {error && (
        <p className="text-red-600 dark:text-red-400 text-[10px] mb-2">
          ⚠️ {error}
        </p>
      )}

      {/* Actions */}
      {suggestion.action_type && (
        <div className="flex items-center gap-1.5">
          {confirmed ? (
            <>
              <Button
                size="sm"
                variant="default"
                className="h-6 text-[10px] px-2 gap-1 bg-green-600 hover:bg-green-700"
                onClick={handleExecute}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3" />
                )}
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2"
                onClick={() => setConfirmed(false)}
                disabled={isExecuting}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 gap-1 bg-background/80"
              onClick={handleExecute}
              disabled={isExecuting}
            >
              <ChevronRight className="h-3 w-3" />
              Executar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
