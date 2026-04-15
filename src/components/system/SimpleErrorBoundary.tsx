
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  name?: string;
  bypassPath?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SimpleErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name || 'Global'}] error:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-500/5 border border-red-500/20 rounded-xl text-center space-y-4 my-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-red-500">Erro de Interface</h2>
            <p className="text-sm text-slate-400">
              Ocorreu um problema ao renderizar esta seção ({this.props.name}).
            </p>
          </div>
          {this.state.error && (
            <pre className="text-[10px] bg-black/40 p-3 rounded overflow-auto max-h-32 text-left text-red-400/80">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-red-500/20 hover:bg-red-500/10"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Recarregar
            </Button>

            {this.props.bypassPath && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-slate-300"
                onClick={() => window.location.href = this.props.bypassPath!}
              >
                Acesso de Emergência (Pular)
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
