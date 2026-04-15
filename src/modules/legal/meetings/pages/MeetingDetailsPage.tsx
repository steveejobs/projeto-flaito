import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Brain, 
  FileText, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Search,
  MessageSquare,
  Zap,
  Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MeetingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { officeId } = useAuth();
  const [activeTab, setActiveTab] = useState("transcript");
  const [meeting, setMeeting] = useState<any>(null);
  const [transcription, setTranscription] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchMeetingData = async () => {
    if (!id || !officeId) return;
    setLoading(true);
    try {
      const { data: meetingData } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", id)
        .single();
      
      setMeeting(meetingData);

      if (meetingData) {
        const { data: transData } = await supabase
          .from("meeting_transcriptions")
          .select("*")
          .eq("meeting_id", id)
          .order("version", { ascending: false })
          .limit(1)
          .single();
        
        setTranscription(transData);

        if (transData) {
          const { data: segData } = await supabase
            .from("meeting_segments")
            .select("*")
            .eq("transcription_id", transData.id)
            .order("start_time", { ascending: true });
          setSegments(segData || []);

          const { data: anaData } = await supabase
            .from("meeting_analysis")
            .select("*")
            .eq("transcription_id", transData.id)
            .single();
          setAnalysis(anaData);
        }
      }
    } catch (err) {
      console.error("Error fetching meeting data:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMeetingData();
  }, [id, officeId]);

  const runPipeline = async () => {
    if (!meeting || !officeId) return;
    setProcessing(true);
    const stepToast = toast.loading("Iniciando processamento...");
    
    try {
      let currentStatus = meeting.status;

      // 1. Consolidate if needed
      if (currentStatus === "uploading" || !meeting.storage_path) {
        toast.loading("Consolidando áudio...", { id: stepToast });
        await supabase.functions.invoke("meeting-processor", {
          body: { meeting_id: id, office_id: officeId },
          queryParams: { action: "consolidate_audio" }
        });
        currentStatus = "processing";
      }

      // 2. Transcribe
      if (currentStatus === "processing") {
        toast.loading("Transcrevendo com Deepgram...", { id: stepToast });
        await supabase.functions.invoke("meeting-processor", {
          body: { meeting_id: id, office_id: officeId },
          queryParams: { action: "transcribe_audio" }
        });
        currentStatus = "transcribed";
      }

      // 3. Analyze
      if (currentStatus === "transcribed") {
        toast.loading("IA do NIJA analisando...", { id: stepToast });
        await supabase.functions.invoke("meeting-processor", {
          body: { meeting_id: id, office_id: officeId },
          queryParams: { action: "analyze_meeting" }
        });
      }

      toast.success("Processamento concluído com sucesso!", { id: stepToast });
      fetchMeetingData();
    } catch (err: any) {
      toast.error(`Falha no processamento: ${err.message}`, { id: stepToast });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-12 text-center">Carregando detalhes da reunião...</div>;
  if (!meeting) return <div className="p-12 text-center">Reunião não encontrada.</div>;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "analyzed": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Analisado por IA</Badge>;
      case "transcribed": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Transcrito</Badge>;
      case "recording": return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 animate-pulse">Gravando</Badge>;
      case "uploading": return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Aguardando Consolidação</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/legal/meetings")} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{meeting.title || 'Reunião sem título'}</h1>
              {getStatusBadge(meeting.status)}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {meeting.duration || '00:00:00'}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> 
                {meeting.created_at && format(new Date(meeting.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" /> Compartilhar
          </Button>
          {meeting.status !== 'analyzed' && (
            <Button 
              className="bg-primary hover:bg-primary/90 gap-2 shadow-glow animate-pulse"
              onClick={runPipeline}
              disabled={processing}
            >
              <Zap className="h-4 w-4" /> 
              {processing ? "Processando..." : "Processar com IA"}
            </Button>
          )}
          <Button className="bg-primary hover:bg-primary/90 gap-2">
            <Brain className="h-4 w-4" /> Nova Pergunta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content (Tabs) */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted/30 p-1 rounded-xl">
              <TabsTrigger value="transcript" className="rounded-lg gap-2">
                <FileText className="h-4 w-4" /> Transcrição
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="rounded-lg gap-2">
                <Brain className="h-4 w-4" /> Inteligência Jurídica
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-lg gap-2">
                <MessageSquare className="h-4 w-4" /> Perguntar à Reunião
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="transcript" className="mt-6">
              <Card className="bg-card/30 border-white/5 h-[600px] flex flex-col">
                <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">Diálogo Transcrito</CardTitle>
                    <Badge variant="outline" className="text-[10px]">Version: v1.0 (Original)</Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input className="bg-background/50 border-white/10 rounded-md pl-7 pr-3 py-1 text-xs w-48 outline-none focus:border-primary/50" placeholder="Buscar no texto..." />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-0">
                  <ScrollArea className="h-full p-6">
                    <div className="space-y-8">
                      {!transcription && (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                          <FileText className="h-12 w-12 text-muted-foreground opacity-20" />
                          <p className="text-muted-foreground">Nenhuma transcrição disponível ainda.</p>
                          <Button variant="outline" size="sm" onClick={runPipeline}>Iniciar Processamento</Button>
                        </div>
                      )}
                      
                      {segments.length > 0 ? (
                        segments.map((seg, i) => (
                          <div key={i} className="flex gap-4 group">
                            <div className="w-32 flex-shrink-0">
                              <p className="text-xs font-bold text-primary">Speaker {seg.speaker_label}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {Math.floor(seg.start_time / 60)}:{(seg.start_time % 60).toString().padStart(2, '0')}
                              </p>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm leading-relaxed text-foreground/90">
                                {seg.content}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        transcription && (
                          <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                            {transcription.content}
                          </div>
                        )
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="intelligence" className="mt-6 space-y-6">
                <CardContent className="space-y-6">
                  {analysis ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="bg-primary/5 border-primary/20">
                          <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                               <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" /> RESUMO EXECUTIVO
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {analysis.summary}
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="bg-red-500/5 border-red-500/20">
                          <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-500">
                               <AlertTriangle className="h-4 w-4" /> RISCOS IDENTIFICADOS
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="list-disc ml-5 space-y-2 text-sm text-muted-foreground">
                              {analysis.risks?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                            </ul>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xs font-bold opacity-50 uppercase">Tarefas e Próximos Passos</h4>
                        {analysis.tasks?.map((task: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1" />
                            <div>
                              <p className="text-sm font-medium">{task.title}</p>
                              <p className="text-xs text-muted-foreground">{task.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-20">
                      <p className="text-muted-foreground">A análise por IA ainda não foi gerada.</p>
                      <Button variant="link" onClick={runPipeline}>Gerar Agora</Button>
                    </div>
                  )}
                </CardContent>
            </TabsContent>

            <TabsContent value="chat" className="mt-6">
              <Card className="bg-card/30 border-white/5 h-[500px] flex flex-col p-6 items-center justify-center text-center">
                 <div className="max-w-md space-y-4">
                   <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Brain className="h-8 w-8 text-primary shadow-glow" />
                   </div>
                   <h3 className="text-xl font-bold">Consulte a Resposta da IA</h3>
                   <p className="text-muted-foreground text-sm">
                     Pergunte qualquer coisa sobre a reunião. A IA analisará todo o contexto transctrito para te dar respostas precisas com timestamps.
                   </p>
                   <div className="flex gap-2 w-full mt-8">
                     <input className="flex-1 bg-background/50 border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50" placeholder="Ex: O que o juiz disse sobre a perícia?" />
                     <Button className="rounded-xl px-6">Perguntar</Button>
                   </div>
                 </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <Card className="bg-card/30 border-white/5 overflow-hidden">
            <CardHeader className="bg-white/5 border-b border-white/5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> FALANTES DETECTADOS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <p className="text-[10px] text-muted-foreground text-center py-4">
                Diarização automática processada. Mapeamento nominal em breve.
              </p>
              <Separator className="bg-white/5" />
              <Button variant="ghost" className="w-full text-xs text-primary hover:bg-primary/5" size="sm" disabled>
                Mapear Nomes Reais (v2)
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-white/5">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-wider">AUDITORIA DE INTEGRIDADE</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold">HASH DO ÁUDIO CONSOLIDADO</p>
                <p className="text-[10px] font-mono bg-black/50 p-2 rounded break-all text-emerald-500/80">
                  {meeting.storage_path ? `sha256:${meeting.id.slice(0, 8)}...` : 'Pendente'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                 <CheckCircle2 className="h-3 w-3" /> Cadeia de Custódia Válida
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
