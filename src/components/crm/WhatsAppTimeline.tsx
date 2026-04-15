import React from 'react';
import { 
  MessageSquare, 
  Sparkles, 
  User, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  MoreHorizontal
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  intent_detected?: string;
  created_at: string;
}

interface WhatsAppTimelineProps {
  messages: Message[];
  status: 'active' | 'human_escalated' | 'closed';
  leadName: string;
}

const INTENT_LABELS: Record<string, { label: string, color: string }> = {
  novo_lead: { label: 'Novo Lead', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  agendamento: { label: 'Agendamento', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  acompanhamento_processo: { label: 'Status Processal', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  duvida_geral: { label: 'Dúvida Geral', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  escalar_humano: { label: 'Escalonamento', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

export function WhatsAppTimeline({ messages, status, leadName }: WhatsAppTimelineProps) {
  return (
    <div className="flex flex-col h-full bg-background/20 backdrop-blur-md border border-primary/5 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
      {/* Header da Timeline */}
      <div className="p-4 border-b border-primary/5 bg-background/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center border shadow-inner ${status === 'human_escalated' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-primary/10 border-primary/20 text-primary'}`}>
             <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-black text-sm tracking-tight">{leadName}</h4>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                {status === 'active' ? 'Atendimento IA Ativo' : 'Aguardando Humano'}
              </span>
            </div>
          </div>
        </div>
        <Badge variant={status === 'active' ? 'secondary' : 'destructive'} className="uppercase text-[9px] font-black tracking-tighter px-2">
          {status === 'active' ? 'Bot Agente' : 'Escalado'}
        </Badge>
      </div>

      {/* Grid de Mensagens */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
              <Clock className="h-10 w-10 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhuma mensagem registrada</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div 
                key={msg.id} 
                className={`flex gap-4 ${msg.direction === 'outbound' ? 'flex-row-reverse' : ''} group`}
              >
                {/* Avatar / Icon */}
                <div className={`h-8 w-8 rounded-xl shrink-0 flex items-center justify-center border shadow-sm ${msg.direction === 'outbound' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-muted-foreground/10 text-muted-foreground'}`}>
                  {msg.direction === 'outbound' ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>

                {/* Bubble */}
                <div className={`flex flex-col gap-1.5 max-w-[80%] ${msg.direction === 'outbound' ? 'items-end' : 'items-start'}`}>
                  {/* Metadata de Intenção (para Inbound) */}
                  {msg.direction === 'inbound' && msg.intent_detected && (
                    <div className="flex items-center gap-1.5 ml-1">
                      <ShieldCheck className="h-3 w-3 text-primary/40" />
                      <Badge variant="outline" className={`text-[8px] font-black uppercase tracking-tighter p-0 px-1.5 border-none h-4 ${INTENT_LABELS[msg.intent_detected]?.color}`}>
                         IA: {INTENT_LABELS[msg.intent_detected]?.label}
                      </Badge>
                    </div>
                  )}

                  {/* Content */}
                  <div className={`p-4 rounded-3xl text-sm font-medium leading-relaxed shadow-xl border relative ${
                    msg.direction === 'outbound' 
                    ? 'bg-gradient-to-br from-primary/90 to-primary text-primary-foreground rounded-tr-none border-primary/20' 
                    : 'bg-card border-primary/5 rounded-tl-none text-foreground'
                  }`}>
                    {msg.content}
                    
                    {/* Time Float */}
                    <span className={`absolute -bottom-5 whitespace-nowrap text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter ${msg.direction === 'outbound' ? 'right-0' : 'left-0'}`}>
                      {format(new Date(msg.created_at), 'HH:mm • d MMM', { locale: ptBR })}
                    </span>
                  </div>

                  {/* IA Reasoning (Simulado para Outbound) */}
                  {msg.direction === 'outbound' && (
                     <div className="flex items-center gap-1.5 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest italic">Processado via Motor Determinístico</span>
                        <Sparkles className="h-2 w-2 text-primary/20" />
                     </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer Info */}
      <div className="p-4 bg-primary/5 border-t border-primary/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <AlertCircle className="h-3 w-3 text-muted-foreground" />
           <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Interface de Auditoria do WhatsApp</p>
        </div>
        <div className="flex gap-2">
           <button className="h-7 px-3 rounded-full bg-background/50 border border-primary/5 text-[9px] font-black uppercase hover:bg-background transition-colors tracking-widest">
             Exportar
           </button>
           <button className="h-7 px-3 rounded-full bg-primary text-primary-foreground text-[9px] font-black uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-transform tracking-widest">
             Assumir Conversa
           </button>
        </div>
      </div>
    </div>
  );
}
