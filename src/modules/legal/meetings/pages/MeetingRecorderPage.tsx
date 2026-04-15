import React, { useState, useEffect } from "react";
import { Mic, StopCircle, Pause, Play, Save, X, Shield, History, CheckCircle2, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";

export default function MeetingRecorderPage() {
  const navigate = useNavigate();
  const [meetingTitle, setMeetingTitle] = useState("Nova Reunião Jurídica");
  const [seconds, setSeconds] = useState(0);
  
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    isSyncing,
    pendingChunks 
  } = useMeetingRecorder({
    onUploadSuccess: (chunkId) => console.log("Chunk uploaded:", chunkId),
    onUploadError: (error) => toast({ title: "Erro de Sincronização", description: error.message, variant: "destructive" })
  });

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    if (window.confirm("Deseja realmente encerrar a gravação?")) {
      await stopRecording();
      toast({
        title: "Gravação Finalizada",
        description: "O áudio está sendo processado. Você será notificado quando a transcrição estiver pronta.",
      });
      navigate("/legal/meetings");
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col gap-6 animate-in zoom-in-95 duration-500">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/legal/meetings")}>
            <X className="h-5 w-5" />
          </Button>
          <div>
            <input 
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              className="bg-transparent border-none text-2xl font-bold focus:ring-0 w-full outline-none text-foreground"
              placeholder="Título da Reunião"
            />
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1">
                <Shield className="h-3 w-3" />
                Auditado por Hash
              </Badge>
              {isSyncing && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 animate-pulse">
                  Sincronizando Chunks...
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <Button 
              onClick={startRecording}
              size="lg" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 h-12 rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
            >
              <Mic className="h-5 w-5" />
              Iniciar Gravação
            </Button>
          ) : (
            <Button 
              onClick={handleStop}
              variant="destructive"
              size="lg"
              className="gap-2 px-8 h-12 rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-95"
            >
              <StopCircle className="h-5 w-5" />
              Encerrar e Processar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Visualizer and Main Controls */}
        <Card className="lg:col-span-2 bg-black/40 border-white/5 flex flex-col items-center justify-center p-12 relative overflow-hidden">
          {/* Animated Background Gradients */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-20">
            <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/30 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-red-500/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-12">
            {/* Timer Display */}
            <div className="text-center">
              <span className={`text-8xl font-mono font-black tracking-tighter ${isRecording ? 'text-white' : 'text-white/20'}`}>
                {formatTime(seconds)}
              </span>
              <p className="text-muted-foreground mt-4 font-medium tracking-widest uppercase">
                {isRecording ? 'Captura de Áudio em Tempo Real' : 'Aguardando Início'}
              </p>
            </div>

            {/* Waveform Visualization (Simulated for aesthetics) */}
            <div className="h-32 flex items-center gap-1.5 px-12">
              {Array.from({ length: 48 }).map((_, i) => (
                <div 
                  key={i}
                  className={`w-1 rounded-full bg-primary transition-all duration-300 ${isRecording ? 'animate-wave' : 'h-2 bg-white/10'}`}
                  style={{ 
                    height: isRecording ? `${Math.random() * 100 + 10}%` : '8px',
                    animationDelay: `${i * 0.05}s`
                  }}
                />
              ))}
            </div>
            
            {isRecording && (
              <div className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl border border-white/10 animate-in slide-in-from-bottom-4 duration-500">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-sm font-semibold">Microfone: Focusrite Scarlett Solo</span>
              </div>
            )}
          </div>
        </Card>

        {/* Sidebar - Context and Sync Logs */}
        <div className="flex flex-col gap-6 min-h-0">
          <Card className="bg-card/30 border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Vínculo Jurídico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Cliente</label>
                <div className="p-3 bg-background/50 rounded-lg border border-white/5 hover:border-primary/50 transition-colors cursor-pointer">
                  <span className="text-sm font-medium">Selecionar Cliente...</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Processo / Caso</label>
                <div className="p-3 bg-background/50 rounded-lg border border-white/5 hover:border-primary/50 transition-colors cursor-pointer">
                  <span className="text-sm font-medium">Auto-detectar ou Escolher...</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 min-h-0 flex flex-col bg-card/30 border-white/5">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">Trilha de Sincronia</CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">{pendingChunks} Pendentes</Badge>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-3">
                  {/* Sync items will be dynamic, showing simulated logs for now */}
                  <div className="flex items-start gap-3 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-emerald-400">Ambiente Pronto</p>
                      <p className="text-[10px] text-muted-foreground">IndexedDB inicializado com sucesso</p>
                    </div>
                  </div>
                  
                  {isRecording && (
                    <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10 animate-in slide-in-from-top-2">
                      <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold">Gravando Bloco #1</p>
                        <p className="text-[10px] text-muted-foreground">Persistindo localmente...</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <style>{`
        @keyframes wave {
          0%, 100% { height: 10%; }
          50% { height: 80%; }
        }
        .animate-wave {
          animation: wave 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
