import React from 'react';
import { useVoiceAgent, AssistantState } from '@/contexts/VoiceAgentContext';
import { Mic, MicOff, Volume2, Loader2, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

export const VoiceAgentLauncher = () => {
    const { 
        isActive, state, toggleActive, isBrowserSupported,
        transcript, interimTranscript, pendingAction, processCommand, cancelCapture
    } = useVoiceAgent();
    
    const location = useLocation();
    const isMedical = location.pathname.includes('/medical');
    
    if (!isBrowserSupported) return null;

    const getStatusIcon = () => {
        switch (state) {
            case AssistantState.IDLE: return <Mic className="h-5 w-5" />;
            case AssistantState.LISTENING_WAKE_WORD: return <Mic className="h-5 w-5 animate-pulse" />;
            case AssistantState.CAPTURING_COMMAND: return <Mic className="h-5 w-5 animate-bounce" />;
            case AssistantState.PROCESSING: return <Loader2 className="h-5 w-5 animate-spin" />;
            case AssistantState.SPEAKING: return <Volume2 className="h-5 w-5 animate-pulse" />;
            default: return <Mic className="h-5 w-5" />;
        }
    };

    return (
        <div className="fixed bottom-6 right-20 z-50 flex flex-col items-end gap-3 group">
            
            {/* Bubble de Transcrição Avançada */}
            {isActive && (transcript || interimTranscript) && (
                <div className={cn(
                    "bg-background/80 backdrop-blur-xl border border-border/50 text-foreground text-sm p-4 rounded-3xl shadow-2xl max-w-[320px] mb-2 mr-2 animate-in fade-in slide-in-from-bottom-4 relative ring-1 ring-white/10",
                    isMedical ? "border-teal-100 shadow-teal-500/10" : "border-primary/20 shadow-primary/10"
                )}>
                    <div className="font-medium text-base leading-relaxed break-words">
                        {transcript}
                        {interimTranscript && (
                            <span className="text-muted-foreground opacity-60 italic whitespace-pre-wrap">
                                {" "}{interimTranscript}
                            </span>
                        )}
                    </div>

                    {/* Banner de Confirmação Pendente */}
                    {pendingAction && (
                        <div className="mt-4 p-3 rounded-2xl bg-primary/10 border border-primary/20 space-y-3 animate-in zoom-in-95 duration-300">
                            <p className="text-[11px] font-medium leading-tight opacity-90">
                                Deseja realmente {pendingAction.intent}?
                            </p>
                            <div className="flex gap-2">
                                <Button 
                                    size="sm" 
                                    className="flex-1 h-8 rounded-xl bg-primary text-[10px] font-black"
                                    onClick={() => processCommand(null, "Sim")}
                                >
                                    SIM
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex-1 h-8 rounded-xl text-[10px] font-black"
                                    onClick={() => cancelCapture()}
                                >
                                    NÃO
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Button
                onClick={() => toggleActive()}
                variant="outline"
                size="icon"
                className={cn(
                    "h-14 w-14 rounded-full shadow-2xl transition-all duration-500 border-2 group relative",
                    isMedical 
                        ? "bg-white hover:bg-teal-50 border-teal-100 text-teal-600 hover:border-teal-300" 
                        : "bg-slate-950/80 backdrop-blur-xl border-white/10 text-white hover:bg-slate-900 hover:border-primary/50",
                    isActive && (isMedical ? "ring-4 ring-teal-500/20 border-teal-500" : "ring-4 ring-primary/20 border-primary"),
                    state === AssistantState.CAPTURING_COMMAND && "bg-red-500 text-white border-red-400 ring-red-500/30"
                )}
            >
                <div className="relative">
                    {getStatusIcon()}
                    {!isActive && (
                        <div className={cn(
                            "absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
                            isMedical ? "bg-teal-500" : "bg-primary"
                        )} />
                    )}
                </div>
                
                {/* Tooltip-like label */}
                <div className={cn(
                    "absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none translate-x-2 group-hover:translate-x-0",
                    isMedical 
                        ? "bg-teal-600 text-white shadow-lg" 
                        : "bg-primary text-primary-foreground shadow-xl shadow-primary/20"
                )}>
                    {isActive ? 'Athena Ativa' : 'Falar com Athena'}
                </div>
            </Button>
            
            {isActive && (
                <div className={cn(
                    "absolute -top-12 right-0 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter animate-in zoom-in duration-300",
                    isMedical ? "bg-teal-100 text-teal-700" : "bg-primary/20 text-primary border border-primary/30 backdrop-blur-md"
                )}>
                    {state === AssistantState.LISTENING_WAKE_WORD ? 'Modo Voz Ativo' : state.replace('_', ' ')}
                </div>
            )}
        </div>
    );
};
