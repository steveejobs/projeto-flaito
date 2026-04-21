import React, { useState } from 'react';
import { useVoiceAgent, AssistantState, VoiceMode } from '@/contexts/VoiceAgentContext';
import { 
  Mic, MicOff, Settings, Volume2, Moon, Loader2, X, RotateCcw, 
  Shield, Activity, Eye, Zap, AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

export const VoiceAgentWidget = () => {
    const { 
        isActive, state, wakeWord, transcript, interimTranscript,
        toggleActive, setWakeWord, manuallyTriggerListening, 
        cancelCapture, resetSession, silenceSeconds, setSilenceSeconds,
        mode, setMode, isBrowserSupported, effectiveMode, pendingAction, processCommand
    } = useVoiceAgent();
    
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [newWakeWord, setNewWakeWord] = useState(wakeWord);
    const [tempSilence, setTempSilence] = useState(silenceSeconds);
    const [manualText, setManualText] = useState('');

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualText.trim()) return;
        processCommand(manualText.trim());
        setManualText('');
    };

    const handleSaveSettings = () => {
        setWakeWord(newWakeWord);
        setSilenceSeconds(tempSilence);
        setIsSettingsOpen(false);
    };

    const getModeIcon = (m: VoiceMode) => {
        switch (m) {
            case 'consultation': return <Eye className="h-3 w-3" />;
            case 'assisted': return <Activity className="h-3 w-3" />;
            case 'critical': return <Shield className="h-3 w-3" />;
            default: return <Zap className="h-3 w-3" />;
        }
    };

    const getModeColor = (m: VoiceMode) => {
        switch (m) {
            case 'consultation': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'assisted': return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        }
    };

    const getStatusIcon = () => {
        switch (state) {
            case AssistantState.IDLE: return <MicOff className="h-5 w-5 text-muted-foreground" />;
            case AssistantState.LISTENING_WAKE_WORD: return <Moon className="h-5 w-5 text-blue-400 animate-pulse" />;
            case AssistantState.CAPTURING_COMMAND: return <Mic className="h-5 w-5 text-red-500 animate-pulse" />;
            case AssistantState.PROCESSING: return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />;
            case AssistantState.SPEAKING: return <Volume2 className="h-5 w-5 text-green-500 animate-pulse" />;
            case AssistantState.ERROR: return <MicOff className="h-5 w-5 text-red-600" />;
            default: return <MicOff className="h-5 w-5 text-muted-foreground" />;
        }
    };

    const getStatusText = () => {
        switch (state) {
            case AssistantState.IDLE: return 'Agente Inativo';
            case AssistantState.LISTENING_WAKE_WORD: return `Ouvindo "${wakeWord}"...`;
            case AssistantState.CAPTURING_COMMAND: return 'Ouvindo comando...';
            case AssistantState.PROCESSING: return 'PENSANDO...';
            case AssistantState.SPEAKING: return 'FALANDO...';
            case AssistantState.ERROR: return 'ERRO';
            default: return 'Inativo';
        }
    };

    return (
        <>
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 group">

                {/* Bubble de Transcrição Avançada */}
                {isActive && (transcript || interimTranscript) && (
                    <div className="bg-background/80 backdrop-blur-xl border border-border/50 text-foreground text-sm p-4 rounded-3xl shadow-2xl max-w-[320px] mb-2 mr-2 animate-in fade-in slide-in-from-bottom-4 relative group/bubble ring-1 ring-white/10">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-background border border-border shadow-md opacity-0 group-hover/bubble:opacity-100 transition-opacity hover:bg-muted"
                            onClick={cancelCapture}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                        
                        <div className="flex items-center gap-2 mb-2">
                             <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getModeColor(mode)}`}>
                                {getModeIcon(mode)}
                                {mode}
                             </div>
                             {state === AssistantState.CAPTURING_COMMAND && (
                                <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium animate-pulse">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div> ESCUTANDO
                                </span>
                             )}
                        </div>
                        
                        <div className="font-medium text-base leading-relaxed break-words">
                            {transcript}
                            {interimTranscript && (
                                <span className="text-muted-foreground opacity-60 italic whitespace-pre-wrap">
                                    {" "}{interimTranscript}
                                </span>
                            )}
                        </div>

                        {/* Banner de Confirmação Pendente (Stage 7) */}
                        {pendingAction && (
                            <div className="mt-4 p-3 rounded-2xl bg-primary/10 border border-primary/20 space-y-3 animate-in zoom-in-95 duration-300">
                                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-tighter">
                                    <AlertCircle className="h-4 w-4" />
                                    Confirmação Pendente
                                </div>
                                <p className="text-[11px] font-medium leading-tight opacity-90">
                                    Deseja realmente {pendingAction.intent}?
                                </p>
                                <div className="flex gap-2">
                                    <Button 
                                        size="sm" 
                                        className="flex-1 h-8 rounded-xl bg-primary text-[10px] font-black"
                                        onClick={() => processCommand(null, "Sim")}
                                    >
                                        CONFIRMAR (Voz/Clique)
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="flex-1 h-8 rounded-xl text-[10px] font-black"
                                        onClick={() => cancelCapture()}
                                    >
                                        CANCELAR
                                    </Button>
                                </div>
                                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                     <div className="h-full bg-primary/40 animate-out fade-out slide-out-to-left duration-[30000ms]"></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Dashboard Principal do Agente */}
                <div className="bg-background/90 backdrop-blur-2xl border border-border/50 shadow-2xl rounded-full pl-2 pr-4 py-2 flex items-center gap-3 transition-all duration-500 hover:shadow-primary/30 hover:scale-[1.02] ring-1 ring-white/5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`rounded-full h-11 w-11 transition-all duration-500 ${isActive ? 'bg-primary/10 shadow-inner' : 'hover:bg-muted opacity-50'}`}
                        onClick={() => toggleActive()}
                    >
                        {getStatusIcon()}
                    </Button>

                    <div className="flex flex-col min-w-[140px] cursor-default">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold tracking-tight text-foreground/90 uppercase truncate">
                                {wakeWord}
                            </span>
                            <div className={`p-1 rounded-full ${getModeColor(effectiveMode || mode)}`}>
                                {getModeIcon(effectiveMode || mode)}
                            </div>
                            {effectiveMode && effectiveMode !== mode && (
                                <div className="p-1 bg-amber-500 rounded-full animate-pulse shadow-lg shadow-amber-500/50" title="Modo restringido pelo servidor">
                                    <Shield className="h-2 w-2 text-white" />
                                </div>
                            )}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest opacity-80 ${
                            state === AssistantState.CAPTURING_COMMAND ? 'text-red-500' : 
                            state === AssistantState.PROCESSING ? 'text-yellow-500' :
                            'text-muted-foreground'
                        }`}>
                            {getStatusText()}
                        </span>
                    </div>

                    <div className="h-8 w-[1px] bg-border/50 mx-1"></div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>

                {/* Controles Rápidos e PTT */}
                {isActive && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-6 duration-500">
                        {!isBrowserSupported && (
                           <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-2 rounded-full text-[10px] font-bold">
                              <AlertCircle className="h-3 w-3" />
                              WAKE WORD INDISPONÍVEL
                           </div>
                        )}

                        <form onSubmit={handleManualSubmit} className="hidden sm:flex items-center bg-background/60 backdrop-blur-xl border border-border/40 rounded-full pl-4 pr-1 py-1 shadow-xl focus-within:ring-2 ring-primary/20 transition-all">
                            <input 
                                type="text"
                                value={manualText}
                                onChange={(e) => setManualText(e.target.value)}
                                placeholder="Comando de texto..."
                                className="bg-transparent border-none outline-none text-xs w-[140px] placeholder:text-muted-foreground/60 font-medium"
                            />
                            <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-primary/10 group/send">
                                <RotateCcw className="h-4 w-4 rotate-180 text-primary transition-transform group-hover:scale-110" />
                            </Button>
                        </form>
                        
                        <Button
                            variant="default"
                            size="lg"
                            onMouseDown={() => manuallyTriggerListening()}
                            className={`rounded-full shadow-2xl transition-all duration-300 px-6 font-bold h-12 gap-2 active:scale-95 ${
                                state === AssistantState.CAPTURING_COMMAND ? 'bg-red-500 hover:bg-red-600 scale-110 ring-4 ring-red-500/20' : 'bg-primary hover:bg-primary/90'
                            }`}
                        >
                            <Mic className={`h-5 w-5 ${state === AssistantState.CAPTURING_COMMAND ? 'animate-pulse' : ''}`} />
                            {state === AssistantState.CAPTURING_COMMAND ? 'OUVINDO...' : 'Falar (PTT)'}
                        </Button>
                    </div>
                )}
            </div>

            {/* Modal de Configurações Evoluído */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-[460px] bg-background/95 backdrop-blur-3xl border-border/50 rounded-[32px] overflow-hidden">
                    <DialogHeader className="pb-4">
                        <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-2xl">
                                <Settings className="h-6 w-6 text-primary" />
                            </div>
                            VOICE SETTINGS
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium">
                            Configure o comportamento e segurança do seu assistente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-8 py-2">
                        {/* Seção Wake Word */}
                        <div className="space-y-4">
                            <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">AGENTE</Label>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="wakeword" className="font-semibold px-1">Nome de Ativação (Wake Word)</Label>
                                    <Input
                                        id="wakeword"
                                        value={newWakeWord}
                                        onChange={(e) => setNewWakeWord(e.target.value)}
                                        className="rounded-2xl h-12 bg-muted/50 border-border/40 focus:ring-2 ring-primary/20 transition-all font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seção de Modos de Operação */}
                        <div className="space-y-4">
                            <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">MODO DE OPERAÇÃO</Label>
                            <RadioGroup value={mode} onValueChange={(val) => setMode(val as VoiceMode)} className="grid grid-cols-2 gap-3">
                                <div className={`flex flex-col gap-2 p-4 rounded-[24px] border transition-all cursor-pointer hover:border-primary/50 ${mode === 'consultation' ? 'bg-blue-500/5 border-blue-500/40 ring-2 ring-blue-500/10' : 'bg-muted/30 border-transparent'}`} onClick={() => setMode('consultation')}>
                                    <div className="flex items-center gap-2 font-bold text-xs"><Eye className="h-4 w-4 text-blue-500" /> CONSULTA</div>
                                    <p className="text-[10px] text-muted-foreground leading-tight">Apenas leitura. Seguro para locais públicos.</p>
                                </div>
                                <div className={`flex flex-col gap-2 p-4 rounded-[24px] border transition-all cursor-pointer hover:border-primary/50 ${mode === 'assisted' ? 'bg-green-500/5 border-green-500/40 ring-2 ring-green-500/10' : 'bg-muted/30 border-transparent'}`} onClick={() => setMode('assisted')}>
                                    <div className="flex items-center gap-2 font-bold text-xs"><Activity className="h-4 w-4 text-green-500" /> ASSISTIDO</div>
                                    <p className="text-[10px] text-muted-foreground leading-tight">Cria rascunhos e agendas. Requer confirmação.</p>
                                </div>
                                <div className={`flex flex-col gap-2 p-4 rounded-[24px] border transition-all cursor-pointer hover:border-primary/50 ${mode === 'critical' ? 'bg-red-500/5 border-red-500/40 ring-2 ring-red-500/10' : 'bg-muted/30 border-transparent'}`} onClick={() => setMode('critical')}>
                                    <div className="flex items-center gap-2 font-bold text-xs"><Shield className="h-4 w-4 text-red-500" /> CRÍTICO</div>
                                    <p className="text-[10px] text-muted-foreground leading-tight">Ações de alto impacto. Requer fortes travas.</p>
                                </div>
                                <div className={`flex flex-col gap-2 p-4 rounded-[24px] border transition-all cursor-pointer hover:border-primary/50 ${mode === 'automatic' ? 'bg-amber-500/5 border-amber-500/40 ring-2 ring-amber-500/10' : 'bg-muted/30 border-transparent'}`} onClick={() => setMode('automatic')}>
                                    <div className="flex items-center gap-2 font-bold text-xs"><Zap className="h-4 w-4 text-amber-500" /> AUTOMÁTICO</div>
                                    <p className="text-[10px] text-muted-foreground leading-tight">Escala a segurança dinamicamente por ação.</p>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Slider de Silêncio */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">LATÊNCIA DE RESPOSTA</Label>
                                <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">{tempSilence.toFixed(1)}s</span>
                            </div>
                            <Slider 
                                value={[tempSilence]} 
                                min={1.5} 
                                max={5.0} 
                                step={0.5} 
                                onValueChange={(val) => setTempSilence(val[0])}
                                className="py-2"
                            />
                        </div>

                        {/* Reset Sessão */}
                        <div className="pt-2">
                            <Button 
                                variant="outline" 
                                className="w-full h-12 rounded-2xl justify-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 transition-all font-bold border-red-100"
                                onClick={() => { resetSession(); setIsSettingsOpen(false); }}
                            >
                                <RotateCcw className="h-4 w-4" />
                                RESETAR HISTÓRICO DE VOZ
                            </Button>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setIsSettingsOpen(false)}>FECHAR</Button>
                        <Button className="flex-1 h-12 rounded-2xl font-bold shadow-xl shadow-primary/20" onClick={handleSaveSettings}>SALVAR</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};