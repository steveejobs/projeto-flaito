import React from 'react';
import { Shield, User, Cpu, FileText, CheckCircle2, AlertTriangle, Hash, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type ProvenanceSource = 'ocr_extraction' | 'manual_entry' | 'manual_correction' | 'system_import' | 'ai_inference';

interface ProvenanceInfo {
  field: string;
  source: ProvenanceSource;
  value: any;
  confidence?: number;
  confirmedBy?: { name: string; date: string };
  history?: { value: any; date: string; actor: string; reason?: string }[];
}

interface ProvenancePanelProps {
  info: ProvenanceInfo | null;
  onClose?: () => void;
}

const getSourceIcon = (source: ProvenanceSource) => {
  switch (source) {
    case 'ocr_extraction': return <FileText className="h-4 w-4" />;
    case 'manual_entry': 
    case 'manual_correction': return <User className="h-4 w-4" />;
    case 'ai_inference': return <Cpu className="h-4 w-4" />;
    default: return <Hash className="h-4 w-4" />;
  }
};

const getSourceLabel = (source: ProvenanceSource) => {
  switch (source) {
    case 'ocr_extraction': return 'Extração OCR';
    case 'manual_entry': return 'Entrada Manual';
    case 'manual_correction': return 'Correção Humana';
    case 'ai_inference': return 'Inferência de IA';
    default: return source;
  }
};

export const ProvenancePanel = ({ info, onClose }: ProvenancePanelProps) => {
  if (!info) return null;

  return (
    <div className="flex flex-col h-full bg-card border-l animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-bold text-sm uppercase tracking-tight">Linhagem de Dados</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-6 space-y-8 overflow-y-auto">
        {/* Valor Atual */}
        <section>
          <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter mb-2 block">
            Valor Atual (Versão Ativa)
          </Label>
          <div className="p-3 rounded-xl bg-muted/40 border border-primary/20 font-medium text-sm">
            {String(info.value)}
          </div>
        </section>

        {/* Fonte de Origem */}
        <section className="space-y-4">
          <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter block">
            Metadados de Origem
          </Label>
          
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              {getSourceIcon(info.source)}
            </div>
            <div>
              <p className="font-bold text-sm leading-none">{getSourceLabel(info.source)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Fonte primária autoritativa</p>
            </div>
          </div>

          {info.confidence !== undefined && (
            <div className="p-3 rounded-2xl bg-muted/20 border-l-4 border-l-primary space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Confiança do Sistema</span>
                <span className={cn(
                  "text-xs font-black",
                  info.confidence > 0.8 ? "text-green-500" : "text-amber-500"
                )}>
                  {Math.round(info.confidence * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-1000",
                    info.confidence > 0.8 ? "bg-green-500" : "bg-amber-500"
                  )} 
                  style={{ width: `${info.confidence * 100}%` }} 
                />
              </div>
            </div>
          )}
        </section>

        {/* Selo de Confirmação */}
        {info.confirmedBy && (
          <section className="p-3 rounded-2xl bg-green-500/5 border border-green-500/10 flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-green-700">Auditado e Confirmado</p>
              <p className="text-[10px] text-green-600/80 leading-tight mt-1">
                Validado por <strong>{info.confirmedBy.name}</strong> em {format(new Date(info.confirmedBy.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </p>
            </div>
          </section>
        )}

        {/* Histórico de Alterações */}
        {info.history && info.history.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-3 w-3 text-muted-foreground" />
              <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">
                Log de Alterações ({info.history.length})
              </Label>
            </div>
            
            <div className="space-y-3 pl-2 border-l-2 border-dashed border-muted">
              {info.history.map((h, i) => (
                <div key={i} className="text-[11px] relative pl-4">
                  <div className="absolute left-[-5px] top-1.5 w-2 h-2 rounded-full bg-muted border border-card" />
                  <p className="font-bold text-foreground/80 leading-none">"{h.value}"</p>
                  <p className="text-muted-foreground mt-1">
                    Por {h.actor} em {format(new Date(h.date), 'dd/MM HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

import { X } from 'lucide-react';
import { Label } from '../ui/label';
