import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Brain, 
  FileText, 
  Users, 
  Clock, 
  Zap,
  MessageSquare,
  ShieldCheck,
  Activity,
  History,
  Fingerprint,
  AlertOctagon,
  Eye,
  History as AuditIcon,
  ShieldAlert
} from "lucide-react";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { ProvenancePanel } from "@/components/audit/ProvenancePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Domain Specific Views
import { LegalIntelligenceView } from "@/modules/legal/sessions/components/LegalIntelligenceView";
import { MedicalIntelligenceView } from "@/modules/medicina/sessions/components/MedicalIntelligenceView";

export default function SessionDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { officeId } = useAuth();
  const [activeTab, setActiveTab] = useState("transcript");
  const [session, setSession] = useState<any>(null);
  const [transcription, setTranscription] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [contextSources, setContextSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [sessionAlerts, setSessionAlerts] = useState<any[]>([]);
  const [showProvenance, setShowProvenance] = useState(false);
  const [selectedProvenance, setSelectedProvenance] = useState<any>(null);
  
  const isStale = session?.current_snapshot_id && analysis?.snapshot_id && session.current_snapshot_id !== analysis.snapshot_id;

  const fetchData = async () => {
    if (!id || !officeId) return;
    setLoading(true);
    try {
      // 1. Get Session
      const { data: sessionData } = await supabase.from("sessions").select("*").eq("id", id).single();
      setSession(sessionData);

      if (sessionData) {
        // 2. Get Transcription
        const { data: transData } = await supabase.from("session_transcriptions")
          .select("*").eq("session_id", id).order("version_number", { ascending: false }).limit(1).single();
        setTranscription(transData);

        // 3. Get Analysis (Domain Specific)
        const analysisTable = sessionData.session_type === 'legal_meeting' ? 'legal_session_outputs' : 'medical_session_outputs';
        const { data: anaData } = await supabase.from(analysisTable)
          .select("*")
          .eq("session_id", id)
          .order("generation_timestamp", { ascending: false })
          .limit(1)
          .single();
        setAnalysis(anaData);
        
        // 3.1 Get Snapshot for this analysis (Stage 4)
        if (anaData?.snapshot_id) {
          const { data: snapData } = await supabase.from("session_processing_snapshots")
            .select("*")
            .eq("id", anaData.snapshot_id)
            .single();
          setSnapshot(snapData);
        }


        if (transData) {
          // 4. Get Segments
          const { data: segData } = await supabase.from("session_segments")
            .select("*").eq("transcription_id", transData.id).order("start_time", { ascending: true });
          setSegments(segData || []);
        }

        // 5. Get Context Sources
        const { data: sources } = await supabase.from("session_context_sources").select("*").eq("session_id", id);
        setContextSources(sources || []);

        // 6. Stage 8: Get Timeline and Alerts
        const { data: timelineData } = await supabase.from("vw_session_timeline").select("*").eq("session_id", id).order("event_time", { ascending: false });
        setTimelineEvents(timelineData || []);

        const { data: alertsData } = await supabase.from("vw_session_alerts").select("*").eq("session_id", id);
        setSessionAlerts(alertsData || []);
      }
    } catch (err) {
      console.error("Error fetching session data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to Session Jobs
    if (!id) return;
    const channel = supabase
      .channel(`session-jobs-${id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'session_jobs',
        filter: `session_id=eq.${id}`
      }, (payload) => {
        console.log('[Realtime] Job Change:', payload);
        setActiveJob(payload.new);
        if (payload.new.status === 'succeeded' || payload.new.status === 'failed') {
          fetchData(); // Refresh page data on completion
        }
      })
      .subscribe();

    // Initial check for active jobs
    supabase.from('session_jobs')
      .select('*')
      .eq('session_id', id)
      .in('status', ['queued', 'claimed', 'running', 'failed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setActiveJob(data[0]);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, officeId]);

  const runIntelligencePipeline = async () => {
    if (!session || !officeId) return;
    setProcessing(true);
    const stepToast = toast.loading("Enfileirando Processamento Distribuído...");
    
    try {
      // Stage 3 Start: Se já transcreveu, gera snapshot. Caso contrário, começa da transcrição.
      const action = (session.status === 'ready_for_transcription' || !transcription) 
        ? "transcribe_session" 
        : "create_snapshot";

      const body = action === "transcribe_session" 
        ? { session_id: id, office_id: officeId }
        : { session_id: id, transcription_id: transcription.id };

      await supabase.functions.invoke("session-processor", {
        body,
        queryParams: { action }
      });

      toast.success("Job enfileirado com sucesso!", { id: stepToast });
    } catch (err: any) {
      toast.error(`Falha ao iniciar: ${err.message}`, { id: stepToast });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string, color: string }> = {
      'created': { label: 'Iniciado', color: 'bg-muted text-muted-foreground' },
      'recording': { label: 'Gravando', color: 'bg-red-500/10 text-red-500 animate-pulse' },
      'uploading': { label: 'Subindo Áudio', color: 'bg-yellow-500/10 text-yellow-500' },
      'ready_for_integrity_check': { label: 'Aguardando Integridade', color: 'bg-blue-500/10 text-blue-500' },
      'ready_for_transcription': { label: 'Pronto p/ Transcrição', color: 'bg-blue-500/10 text-blue-500' },
      'processing': { label: 'Processando AI', color: 'bg-primary/20 text-primary' },
      'transcribed': { label: 'Transcrito', color: 'bg-emerald-500/10 text-emerald-500' },
      'context_ready': { label: 'Contexto Pronto', color: 'bg-emerald-500/20 text-emerald-600' },
      'snapshot_created': { label: 'Snapshot Criado', color: 'bg-emerald-500/20 text-emerald-600 font-bold' },
      'analyzing': { label: 'Analisando', color: 'bg-purple-500/10 text-purple-500' },
      'outputs_generated': { label: 'Inteligência Gerada', color: 'bg-emerald-500 text-white' },
      'approved': { label: 'Aprovado & Assinado', color: 'bg-emerald-600 text-white' },
      'failed': { label: 'Falhou', color: 'bg-red-600 text-white' },
    };

    const config = statusMap[status] || { label: status, color: 'bg-muted' };
    return <Badge className={`${config.color} border-none`}>{config.label}</Badge>;
  };

  if (loading) return <div className="p-12 text-center">Sincronizando Sessão Intelligence...</div>;
  if (!session) return <div className="p-12 text-center text-red-500">Falha ao localizar a sessão.</div>;

  return (
    <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{session.title}</h1>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest opacity-60">
                {session.session_type === 'legal_meeting' ? 'Jurídico' : 'Médico'}
              </Badge>
              {getStatusBadge(session.status)}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1 font-mono"><Clock className="h-3 w-3" /> {session.duration_seconds}s</span>
              <span className="flex items-center gap-1">
                {format(new Date(session.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {session.status !== 'approved' && (
            <Button 
              className="bg-primary hover:bg-primary/90 gap-2 shadow-glow"
              onClick={runIntelligencePipeline}
              disabled={processing || (activeJob && ['queued', 'claimed', 'running'].includes(activeJob.status))}
            >
              <Zap className={`h-4 w-4 fill-current ${(processing || activeJob?.status === 'running') ? 'animate-spin' : ''}`} /> 
              {activeJob && ['queued', 'claimed', 'running'].includes(activeJob.status) 
                ? `Processando ${activeJob.job_type}...` 
                : (analysis ? "Reprocessar (Novo Snapshot)" : "Gerar Inteligência")
              }
            </Button>
          )}
          <Button variant="outline" size="icon" className="rounded-full">
             <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted/30 p-1 rounded-xl mb-6">
              <TabsTrigger value="transcript" className="rounded-lg gap-2">
                <FileText className="h-4 w-4" /> Transcrição
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="rounded-lg gap-2">
                <Brain className="h-4 w-4" /> Camada de Inteligência
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-lg gap-2">
                <MessageSquare className="h-4 w-4" /> Consultar IA
              </TabsTrigger>
              <TabsTrigger value="audit" className="rounded-lg gap-2 relative">
                <AuditIcon className="h-4 w-4" /> Auditoria
                {sessionAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="transcript" className="mt-0">
               <Card className="bg-card/30 border-white/5 h-[650px] flex flex-col">
                 <ScrollArea className="flex-1 p-6">
                    <div className="space-y-8">
                      {!transcription && (
                        <div className="flex flex-col items-center justify-center py-40 text-center">
                          <Activity className="h-12 w-12 text-muted-foreground opacity-20 animate-pulse mb-4" />
                          <p className="text-muted-foreground">Aguardando transcrição da sessão.</p>
                        </div>
                      )}
                      
                      {segments.map((seg, i) => (
                        <div key={i} className="flex gap-6 group">
                          <div className="w-24 flex-shrink-0 pt-1">
                            <p className="text-[10px] font-bold text-primary opacity-60 uppercase mb-1">Speaker {seg.speaker_label}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {Math.floor(seg.start_time / 60)}:{(Math.floor(seg.start_time % 60)).toString().padStart(2, '0')}
                            </p>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm leading-relaxed text-foreground/80">
                              {seg.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                 </ScrollArea>
               </Card>
            </TabsContent>

            <TabsContent value="intelligence" className="mt-0">
               {session.session_type === 'legal_meeting' ? (
                 <LegalIntelligenceView analysis={analysis} sources={contextSources} snapshot={snapshot} isStale={isStale} />
               ) : (
                 <MedicalIntelligenceView analysis={analysis} sources={contextSources} isStale={isStale} />
               )}
            </TabsContent>

            <TabsContent value="chat" className="mt-0">
              {/* ... existing card ... */}
              <Card className="bg-card/30 border-white/5 h-[500px] flex items-center justify-center text-center p-12">
                 <div className="max-w-sm space-y-4">
                   <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                     <Brain className="h-8 w-8 text-primary shadow-glow" />
                   </div>
                   <h3 className="text-xl font-bold">Consulta Assistida</h3>
                   <p className="text-muted-foreground text-sm">
                     Pergunte sobre fatos, datas ou condutas mencionadas. A IA responderá com base na transcrição e no contexto vinculado.
                   </p>
                   <div className="flex gap-2 pt-4">
                     <input className="flex-1 bg-background border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/50" placeholder="Perguntar..." />
                     <Button className="rounded-xl">Enviar</Button>
                   </div>
                 </div>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-0">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="md:col-span-2 bg-card/30 border-white/5">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" /> Linha do Tempo Unificada
                      </CardTitle>
                    </CardHeader>
                    <ScrollArea className="h-[600px] p-6 pt-0">
                      <AuditTimeline events={timelineEvents} />
                    </ScrollArea>
                  </Card>

                  <div className="space-y-6">
                    <Card className="bg-red-500/5 border-red-500/20">
                      <CardHeader>
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                          <ShieldAlert className="h-3 w-3" /> Riscos e Contradições
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {sessionAlerts.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">Nenhum risco detectado até o momento.</p>
                        ) : (
                          sessionAlerts.map((alert, i) => (
                            <div key={i} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
                              <p className="text-[11px] font-bold text-red-600">{alert.message}</p>
                              <p className="text-[9px] text-red-500/70">{format(new Date(alert.detected_at), 'dd/MM/yyyy HH:mm')}</p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-card/30 border-white/5 border-dashed">
                      <CardHeader>
                        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Explicação de Decisão
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Utilize a aba de Inteligência e clique nos indicadores de linhagem (Shield) para ver a evidência documental por trás de cada conclusão da IA.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
               </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
           <Card className="bg-card/30 border-white/5">
            <CardHeader className="bg-white/5 border-b border-white/5 py-3">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Participantes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
               <p className="text-[10px] text-muted-foreground text-center py-4 italic">
                 Diarização concluída. Mapeamento nominal em processamento.
               </p>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-white/5">
            <CardHeader className="py-3">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                <Fingerprint className="h-3.5 w-3.5 text-primary" /> Auditoria de Integridade
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {activeJob && ['queued', 'claimed', 'running', 'failed', 'dead_lettered'].includes(activeJob.status) && (
                <div className={`p-3 rounded-lg border flex flex-col gap-2 animate-in fade-in zoom-in duration-300 ${
                  activeJob.status === 'failed' ? 'bg-red-500/10 border-red-500/20' : 
                  activeJob.status === 'running' ? 'bg-primary/10 border-primary/20' : 'bg-muted/30 border-white/5'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-tighter flex items-center gap-1.5">
                      {activeJob.status === 'running' && <Activity className="h-3 w-3 animate-spin text-primary" />}
                      {activeJob.status === 'queued' && <Clock className="h-3 w-3 text-muted-foreground" />}
                      {activeJob.status === 'failed' && <AlertOctagon className="h-3 w-3 text-red-500" />}
                      {activeJob.job_type}
                    </span>
                    <Badge variant="outline" className={`text-[8px] h-4 px-1 ${
                      activeJob.status === 'running' ? 'border-primary text-primary animate-pulse' : ''
                    }`}>
                      {activeJob.status}
                    </Badge>
                  </div>
                  
                  {activeJob.status === 'running' && (
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary animate-progress-indeterminate" style={{ width: '40%' }} />
                    </div>
                  )}

                  {activeJob.last_error && (
                    <p className="text-[8px] text-red-400 font-mono leading-tight truncate">
                      Err: {activeJob.last_error}
                    </p>
                  )}
                  
                  {activeJob.status === 'dead_lettered' && (
                    <Button variant="destructive" size="sm" className="h-6 text-[9px] uppercase font-bold">
                      Tentar Manualmente
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">Snapshot Imutável</p>
                  <code className="text-[9px] block bg-black/40 p-2 rounded break-all text-blue-400 font-mono">
                    {analysis?.snapshot_id ? `snap:${analysis.snapshot_id.slice(0, 18)}...` : 'Pendente de Snapshot'}
                  </code>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">Hash do Áudio (SSOT)</p>
                  <code className="text-[9px] block bg-black/40 p-2 rounded break-all text-emerald-500 font-mono">
                    {session.aggregate_session_hash || `verify:${session.id.slice(0, 12)}...`}
                  </code>
                </div>
              </div>

              {analysis?.snapshot_id && (
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold uppercase">
                  <ShieldCheck className="h-3 w-3" /> Linhagem Verificada
                </div>
              )}

              {session.status === 'snapshot_created' && !analysis && (
                <div className="flex items-center gap-2 text-[10px] text-yellow-400 font-bold uppercase">
                  <Activity className="h-3 w-3 animate-spin" /> Snapshot Congelado
                </div>
              )}
            </CardContent>
          </Card>

          {isStale && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg space-y-2 animate-pulse">
              <div className="flex items-center gap-2 text-red-500 text-xs font-bold uppercase">
                <AlertOctagon className="h-4 w-4" />
                <span>Estado Obsoleto Detectado</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                O contexto desta sessão evoluiu. O snapshot utilizado nesta análise (v.{analysis.snapshot_id?.slice(0,6)}) não é mais o head atual. 
                <span className="block mt-1 text-red-400 font-bold">Reprocesse para garantir integridade jurídica/médica.</span>
              </p>
            </div>
          )}

          {analysis && !isStale && session.status !== 'approved' && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-yellow-500">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase">Linhagem Verificada</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Esta análise está vinculada ao snapshot head imutável. Qualquer nova fonte de contexto exigirá um novo snapshot.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Provenance Panel (Floating Drawer) */}
      {showProvenance && (
        <div className="fixed inset-y-0 right-0 w-[400px] z-50 shadow-2xl border-l bg-card/95 backdrop-blur-xl animate-in slide-in-from-right duration-300">
           <ProvenancePanel 
              info={selectedProvenance} 
              onClose={() => setShowProvenance(false)} 
           />
        </div>
      )}
    </div>
  );
}
