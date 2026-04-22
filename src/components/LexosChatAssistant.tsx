import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Scale,
  Send,
  Loader2,
  User,
  X,
  FileText,
  ListChecks,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  SendHorizonal,
  Stethoscope,
  LayoutDashboard,
  RefreshCw,
  Mic,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import TextareaAutosize from "react-textarea-autosize";
import { assertLexosChatPayload, type LexosChatMode } from "@/contracts/lexosChatAssistant";
import { useAthenaSuggestions } from "@/hooks/useAthenaSuggestions";
import { AthenaSuggestionCard } from "@/components/AthenaSuggestionCard";
import { AuditSeal } from "@/components/shared/AuditSeal";
import { AIAuditMetadata } from "@/types/ai-audit";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { useMedicalPatient } from "@/contexts/MedicalPatientContext";
import { buildCompactStudyContext } from "@/types/clientStudyContext";
import { useVoiceAgent } from "@/contexts/VoiceAgentContext";

interface SourceUsed {
  type: string;
  chunk_ids: string[];
  similarity_avg: number;
  titles: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: AssistantAction[];
  _audit?: AIAuditMetadata;
  sources_used?: SourceUsed[];
  metadata?: Record<string, unknown>;
  tool_calls?: any[];
  requires_permission?: boolean;
}

interface AssistantAction {
  type: string;
  payload: Record<string, unknown>;
  label: string;
}

type ChatScope = "global" | "case" | "client" | "page" | "patient";

interface LexosChatAssistantProps {
  caseId?: string | null;
  clientId?: string | null;
  patientId?: string | null;
  appointmentId?: string | null;
}

// ─────────────────────────────────────────────────────
// Quick Actions por módulo
// ─────────────────────────────────────────────────────
const LEGAL_QUICK_ACTIONS: { mode: LexosChatMode; label: string; icon: React.ReactNode; prompt: string }[] = [
  { mode: "summarize", label: "Resumir", icon: <FileText className="h-3 w-3" />, prompt: "Faça um resumo do contexto atual." },
  { mode: "next_step", label: "Próximo passo", icon: <ArrowRight className="h-3 w-3" />, prompt: "Qual o próximo passo recomendado?" },
  { mode: "generate_draft", label: "Minuta", icon: <Sparkles className="h-3 w-3" />, prompt: "Sugira uma estrutura de petição adequada." },
  { mode: "checklist", label: "Checklist", icon: <ListChecks className="h-3 w-3" />, prompt: "Gere um checklist de tarefas para este contexto." },
];

const MEDICAL_QUICK_ACTIONS: { mode: LexosChatMode; label: string; icon: React.ReactNode; prompt: string }[] = [
  { mode: "summarize", label: "Resumir", icon: <FileText className="h-3 w-3" />, prompt: "Faça um resumo do histórico deste paciente." },
  { mode: "next_step", label: "Próximos passos", icon: <ArrowRight className="h-3 w-3" />, prompt: "Quais os próximos passos clínicos recomendados?" },
  { mode: "checklist", label: "Protocolo", icon: <ListChecks className="h-3 w-3" />, prompt: "Gere um protocolo de atendimento para este paciente." },
  { mode: "dashboard", label: "Agenda do dia", icon: <LayoutDashboard className="h-3 w-3" />, prompt: "Resuma minha agenda e pendências médicas de hoje." },
];

const GLOBAL_QUICK_ACTIONS: { mode: LexosChatMode; label: string; icon: React.ReactNode; prompt: string }[] = [
  { mode: "dashboard", label: "Resumo do dia", icon: <LayoutDashboard className="h-3 w-3" />, prompt: "Resuma minha agenda, pendências e ações recomendadas para hoje." },
  { mode: "checklist", label: "Checklist", icon: <ListChecks className="h-3 w-3" />, prompt: "Quais são minhas principais tarefas e pendências agora?" },
];

const CLIENT_CONTEXT_QUICK_ACTIONS: { mode: LexosChatMode; label: string; icon: React.ReactNode; prompt: string }[] = [
  { mode: "summarize", label: "Resumo do cliente", icon: <FileText className="h-3 w-3" />, prompt: "Faça um resumo completo da situação deste cliente, considerando o contexto de estudo." },
  { mode: "next_step", label: "Próximo passo", icon: <ArrowRight className="h-3 w-3" />, prompt: "Com base no contexto de estudo, qual o próximo passo recomendado para este cliente?" },
  { mode: "checklist", label: "Checklist", icon: <ListChecks className="h-3 w-3" />, prompt: "Gere um checklist de tarefas pendentes para este cliente." },
  { mode: "chat", label: "Riscos", icon: <AlertTriangle className="h-3 w-3" />, prompt: "Analise os riscos e pontos de atenção para este cliente." },
];

// ─────────────────────────────────────────────────────
// Welcome messages por módulo
// ─────────────────────────────────────────────────────
const WELCOME_MEDICAL = `Sou a **Athena**, sua assistente clínica inteligente.

Posso te ajudar com:
- Resumo do histórico do paciente
- Próximos passos clínicos
- Protocolos de atendimento
- Análise de iridologia e laudos
- Agenda e pendências do dia

Como posso ajudar?`;

const WELCOME_LEGAL = `Sou a **Athena**, assistente jurídica inteligente do Flaito.

Posso auxiliar com:
- Análise de prazos e prescrição
- Fundamentação jurídica e precedentes
- Geração de minutas e checklists
- Acompanhamento processual

Selecione um contexto acima ou faça sua pergunta.`;

// ─────────────────────────────────────────────────────
// Typing animation
// ─────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Permission Prompt Card
// ─────────────────────────────────────────────────────
function PermissionPromptCard({ 
  toolName, 
  onApprove, 
  onDecline 
}: { 
  toolName: string; 
  onApprove: (mode: "once" | "session") => void; 
  onDecline: () => void;
}) {
  const label = toolName === "link_escavador_process" ? "Vincular Processo" : "Busca no Escavador";
  const isHighRisk = toolName === "link_escavador_process";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 shadow-sm animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-semibold text-amber-900">Athena solicita permissão</h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            Identifiquei a necessidade de usar a ferramenta <strong>{label}</strong> para prosseguir com sua solicitação.
            {isHighRisk && " Esta é uma ação de escrita que pode ter custos de API."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" className="h-8 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100" onClick={() => onApprove("once")}>
          Permitir esta vez
        </Button>
        {!isHighRisk && (
          <Button size="sm" variant="outline" className="h-8 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100" onClick={() => onApprove("session")}>
            Permitir nesta conversa
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-900" onClick={onDecline}>
          Não permitir
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────
export function LexosChatAssistant({ caseId, clientId, patientId, appointmentId }: LexosChatAssistantProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Active client context for dual-mode operation
  const { activeClientId, activeProfile, activeStudyContext, isClientMode } = useActiveClient();
  const { activePatient } = useMedicalPatient();
  const { toggleActive: toggleVoice } = useVoiceAgent();
  
  // Detect active module from current route
  const isMedical = location.pathname.includes("/medico") || location.pathname.includes("/paciente") || location.pathname.includes("/agenda-medica");

  // Effective client/patient: prop takes precedence, then active context
  const effectiveClientId = !isMedical ? (clientId || activeClientId) : null;
  const effectiveClientName = !isMedical ? (activeProfile?.full_name || null) : null;
  const effectivePatientId = isMedical ? (patientId || activePatient?.id) : null;
  const effectivePatientName = isMedical ? (activePatient?.nome || null) : null;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [scope, setScope] = useState<ChatScope>("global");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [allowedSessionTools, setAllowedSessionTools] = useState<string[]>([]);
  const [entityDocs, setEntityDocs] = useState<{id: string, title: string}[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const historyLoadedRef = useRef(false);

  const moduleIcon = isMedical ? <Stethoscope className="h-5 w-5 text-sky-600" /> : <Scale className="h-5 w-5 text-neutral-300" />;
  const moduleName = isMedical ? "Assistente Médica" : "Assistente Jurídica";
  
  const quickActions = effectiveClientId
    ? CLIENT_CONTEXT_QUICK_ACTIONS
    : isMedical
      ? MEDICAL_QUICK_ACTIONS
      : (caseId ? LEGAL_QUICK_ACTIONS : GLOBAL_QUICK_ACTIONS);

  const welcomeMessage = effectiveClientId && effectiveClientName
    ? `Sou a **Athena**, operando em **modo cliente** para **${effectiveClientName}**.

Tenho acesso ao contexto de estudo deste cliente e posso ajudar com:
- Análise da estratégia e riscos
- Revisão do posicionamento processual
- Recomendações contextualizadas
- Resumo e próximos passos

${activeStudyContext?.current_objective ? `**Objetivo atual:** ${activeStudyContext.current_objective}` : "Preencha o Contexto IA do cliente para respostas mais precisas."}`
    : effectivePatientId && effectivePatientName
    ? `Sou a **Athena**, operando em **modo paciente** para **${effectivePatientName}**.
    
Tenho acesso ao histórico deste paciente e posso ajudar com:
- Análise clínica e anamnese
- Próximos passos e prescrições sugeridas
- Resumo de atendimentos anteriores
- Análise de laudos

Como posso ajudar com o paciente atual?`
    : isMedical ? WELCOME_MEDICAL : WELCOME_LEGAL;
  const inputPlaceholder = isMedical
    ? "Consulte sobre o paciente, protocolo clínico..."
    : "Digite sua consulta jurídica... (Enter envia, Shift+Enter quebra linha)";

  // Proactive suggestions engine
  const {
    suggestions,
    isScanning,
    dismiss: dismissSuggestion,
    execute: executeSuggestion,
    isExecuting,
    hasHighPriority,
    count: suggestionCount,
  } = useAthenaSuggestions({ enabled: open, runScanOnMount: true });

  // Auto-detect scope
  useEffect(() => {
    if (effectivePatientId) setScope("patient");
    else if (caseId) setScope("case");
    else if (effectiveClientId) setScope("client");
    else setScope("global");
  }, [caseId, effectiveClientId, effectivePatientId]);

  // Fetch entity documents
  useEffect(() => {
    async function fetchDocs() {
      if (!open) return;
      if (!effectiveClientId && !effectivePatientId) {
        setEntityDocs([]);
        return;
      }
      
      setLoadingDocs(true);
      try {
        if (isMedical && effectivePatientId) {
          const { data } = await supabase.from('documents').select('id, filename').eq('client_id', effectivePatientId).limit(10);
          if (data) setEntityDocs(data.map(d => ({id: d.id, title: d.filename || 'Arquivo Médico'})));
        } else if (effectiveClientId) {
          const { data } = await supabase.from('legal_documents').select('id, title').eq('client_id', effectiveClientId).limit(10);
          if (data) setEntityDocs(data);
        }
      } catch (err) {
        console.error("Error fetching docs", err);
      } finally {
        setLoadingDocs(false);
      }
    }
    fetchDocs();
  }, [open, effectiveClientId, effectivePatientId, isMedical, supabase]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timer);
  }, [messages, loading, streamingText, scrollToBottom]);

  // Load thread on open
  useEffect(() => {
    if (open && !historyLoadedRef.current && !loadingHistory) {
      loadExistingThread();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExistingThread = async () => {
    try {
      setLoadingHistory(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: tid, error } = await (supabase as any).rpc("get_or_create_chat_thread", {
        p_scope: scope,
        p_case_id: scope === "case" ? caseId : null,
        p_client_id: scope === "client" ? effectiveClientId : null,
        p_patient_id: scope === "patient" ? effectivePatientId : null,
        p_route: location.pathname,
      });

      if (!error && tid) {
        setThreadId(tid);
        await loadThreadMessages(tid);
        historyLoadedRef.current = true;
      }
    } catch (err) {
      console.error("[ATHENA] Load thread error:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadThreadMessages = async (tid: string) => {
    try {
      const { data } = await (supabase.from("chat_messages") as any)
        .select("*")
        .eq("thread_id", tid)
        .order("created_at", { ascending: true })
        .limit(50);

      if (data && data.length > 0) {
        setMessages(data.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at),
          actions: (m.metadata as any)?.actions as AssistantAction[] | undefined,
          _audit: (m.metadata as any)?._audit as AIAuditMetadata | undefined,
        })));
      }
    } catch (err) {
      console.error("[ATHENA] Load messages error:", err);
    }
  };

  const fetchContext = async (): Promise<Record<string, unknown>> => {
    const context: Record<string, unknown> = {};
    try {
      if (caseId) {
        const { data: caseData } = await (supabase.from("cases") as any)
          .select(`id, title, cnj_number, area, subtype, side, status, stage, nija_phase, opponent_name, opponent_doc,
            client:clients!cases_client_id_fkey(id, full_name, person_type, cpf, cnpj, email, phone)`)
          .eq("id", caseId)
          .maybeSingle();

        if (caseData) {
          const client = caseData.client as Record<string, unknown> | null;
          context.case = {
            id: caseData.id, title: caseData.title, cnj_number: caseData.cnj_number,
            area: caseData.area, subtype: caseData.subtype, side: caseData.side,
            status: caseData.status, stage: caseData.stage, nija_phase: caseData.nija_phase,
            opponent_name: caseData.opponent_name, opponent_doc: caseData.opponent_doc,
            client_name: client?.full_name || null, client_type: client?.person_type || null,
            client_doc: (client?.cpf || client?.cnpj) || null,
          };
          if (client) context.client = { id: client.id, name: client.full_name, type: client.person_type, doc: client.cpf || client.cnpj, email: client.email, phone: client.phone };
        }
      }

      // Use effectiveClientId to support both prop and active client context
      const resolvedClientId = clientId || effectiveClientId;
      if (resolvedClientId && !context.client) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("id, full_name, person_type, cpf, cnpj, email, phone")
          .eq("id", resolvedClientId)
          .maybeSingle();
        if (clientData) context.client = { id: clientData.id, name: clientData.full_name, type: clientData.person_type, doc: clientData.cpf || clientData.cnpj, email: clientData.email, phone: clientData.phone };
      }

      // Medical context — pacientes/agenda_medica tables removed from schema
      if (patientId) {
        console.warn("LexosChatAssistant: pacientes table no longer exists");
      }

      if (appointmentId) {
        console.warn("LexosChatAssistant: agenda_medica table no longer exists");
      }
    } catch (err) {
      console.error("[ATHENA] Context fetch error:", err);
    }
    return context;
  };

  const simulateStreaming = useCallback((fullText: string, onComplete: () => void) => {
    let currentIndex = 0;
    const streamInterval = setInterval(() => {
      currentIndex += 4;
      if (currentIndex >= fullText.length) {
        setStreamingText(fullText);
        clearInterval(streamInterval);
        onComplete();
      } else {
        setStreamingText(fullText.slice(0, currentIndex));
      }
    }, 12);
    return () => clearInterval(streamInterval);
  }, []);

  const executeTool = useCallback(async (toolCall: any, messageIdx: number) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      // Map Athena tool names to escavador-api actions
      let action = "";
      if (toolName === "search_escavador_for_client") action = "search_by_context";
      else if (toolName === "get_escavador_suggestions") action = "list_monitoramentos";
      else if (toolName === "link_escavador_process") action = "link_process_to_client";
      else action = "search_by_context"; // Fallback

      // Invoke the tool via escavador-api
      const { data, error } = await supabase.functions.invoke("escavador-api", {
        body: { action, payload: toolArgs },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      // Add tool response to conversation
      // If it's a search, we might want to format the result nicely
      let toolResponse = "";
      if (action === "search_by_context" && data?.data) {
        toolResponse = `Encontrei resultados no Escavador via ${data.searchUsed || "busca"}. Dados brutos: ${JSON.stringify(data.data).substring(0, 500)}...`;
      } else {
        toolResponse = data?.message || data?.content || JSON.stringify(data);
      }
      
      // Mark tool as executed in the message
      setMessages(prev => {
        const next = [...prev];
        const msg = next[messageIdx];
        if (msg && msg.tool_calls) {
          msg.tool_calls = msg.tool_calls.map(tc => 
            tc.id === toolCall.id ? { ...tc, status: "executed", result: toolResponse } : tc
          );
          msg.requires_permission = false;
        }
        return next;
      });

      // Send the tool result back to Athena to continue reasoning
      await sendMessage(`[RESULTADO DA FERRAMENTA ${toolName}]: ${toolResponse}`, "chat");

    } catch (err) {
      console.error("[ATHENA] Tool execution error:", err);
      toast({ title: "Athena", description: "Erro ao executar ferramenta.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [supabase, threadId]);

  const sendMessage = useCallback(async (messageText: string, mode: LexosChatMode = "chat") => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setStreamingText("");
    setInput("");

    // Don't add tool results to the UI as user messages
    const isToolResult = trimmedMessage.startsWith("[RESULTADO DA FERRAMENTA");
    if (!isToolResult) {
      setMessages((prev) => [...prev, { role: "user", content: trimmedMessage, timestamp: new Date() }]);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Athena", description: "Sessão expirada. Faça login novamente.", variant: "destructive" });
        return;
      }

      const context = await fetchContext();

      // Build compact study context for injection (only non-empty fields)
      const compactStudy = activeStudyContext
        ? buildCompactStudyContext(activeStudyContext)
        : undefined;

      const body = {
        message: trimmedMessage,
        mode,
        module: isMedical ? "medical" : "legal",
        thread_id: threadId,
        scope: effectivePatientId ? "patient" : (effectiveClientId ? "client" : scope),
        case_id: caseId || null,
        client_id: effectiveClientId || null,
        patient_id: effectivePatientId || null,
        appointment_id: appointmentId || null,
        route: location.pathname,
        context,
        allowed_tools: allowedSessionTools,
        ...(compactStudy && Object.keys(compactStudy).length > 0
          ? { client_study_context: compactStudy }
          : {}),
      };
      assertLexosChatPayload(body);

      const { data, error } = await supabase.functions.invoke("lexos-chat-assistant", {
        body,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const errorMsg = error.message || JSON.stringify(error);
        let msg = `Erro de conexão: ${errorMsg}`;
        // Narrowing safe para extrair status do erro da Edge Function
        const status = (error as any)?.context?.status || (error as any)?.status;
        
        if (status === 402) msg = "Créditos de IA esgotados. Adicione créditos ao workspace.";
        else if (status === 429) msg = "Muitas requisições. Aguarde e tente novamente.";
        toast({ title: "Athena", description: msg, variant: "destructive" });
        if (!isToolResult) setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (data?.error) {
        toast({ title: "Athena", description: `${data.error}${data.details ? " | " + data.details : ""}`, variant: "destructive" });
        if (!isToolResult) setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (data?.thread_id && !threadId) setThreadId(data.thread_id);

      const responseText = data?.message || data?.content || "";
      const toolCalls = data?.tool_calls || [];
      const requiresPermission = data?.requires_permission || false;

      const onStreamingComplete = () => {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: responseText,
          timestamp: new Date(),
          actions: data?.actions,
          _audit: data?._audit,
          sources_used: data?.sources_used,
          metadata: data?.metadata,
          tool_calls: toolCalls,
          requires_permission: requiresPermission,
        }]);
        setStreamingText("");
        loadingRef.current = false;
        setLoading(false);

        // Auto-execute if permission is already granted for session
        if (toolCalls.length > 0 && !requiresPermission) {
          toolCalls.forEach((tc: any) => executeTool(tc, messages.length + 1));
        }
      };

      if (responseText) {
        simulateStreaming(responseText, onStreamingComplete);
      } else if (toolCalls.length > 0) {
        // No text, just tool calls (rare but possible)
        onStreamingComplete();
      } else {
        // Fallback for empty response
        simulateStreaming("Não foi possível processar sua solicitação no momento.", onStreamingComplete);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao processar solicitação";
      toast({ title: "Athena", description: errorMsg, variant: "destructive" });
      if (!isToolResult) setMessages((prev) => prev.slice(0, -1));
      loadingRef.current = false;
      setLoading(false);
    }
  }, [threadId, scope, caseId, clientId, effectiveClientId, activeStudyContext, patientId, effectivePatientId, appointmentId, location.pathname, simulateStreaming, allowedSessionTools, executeTool]);

  // Handle suggestion execution
  const handleSuggestionExecute = async (suggestion: Parameters<typeof executeSuggestion>[0]) => {
    const result = await executeSuggestion(suggestion);
    if (result.success) {
      toast({ title: "Athena", description: "Ação executada com sucesso." });
      if (result.navigate_to) {
        setOpen(false);
        navigate(result.navigate_to);
      }
    } else {
      toast({ title: "Athena", description: result.error || "Erro ao executar ação.", variant: "destructive" });
    }
    return result;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setThreadId(null);
    setStreamingText("");
    historyLoadedRef.current = false;
  };

  const getScopeLabel = () => {
    switch (scope) {
      case "case": return "Caso atual";
      case "client": return "Cliente atual";
      case "patient": return "Paciente atual";
      case "page": return "Página atual";
      default: return "Global";
    }
  };

  const hasContext = caseId || effectiveClientId || effectivePatientId;

  const markdownComponents: Record<string, React.FC<any>> = {
    h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-bold mt-2 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="ml-2">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary/50 pl-3 italic my-2 text-muted-foreground">{children}</blockquote>
    ),
    code: ({ inline, children }: { inline?: boolean; children: React.ReactNode }) =>
      inline ? (
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
      ) : (
        <pre className="bg-muted/80 p-3 rounded-lg overflow-x-auto my-2">
          <code className="text-xs font-mono">{children}</code>
        </pre>
      ),
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">{children}</a>
    ),
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Trigger button — badge when has high priority suggestions */}
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-50 transition-transform hover:scale-105 border-0 ${
            isMedical ? "bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/30" : "bg-neutral-900 text-neutral-100 hover:bg-neutral-800 shadow-neutral-900/50 dark:bg-neutral-100 dark:text-neutral-900"
          }`}
          title={`${moduleName} – IA do Flaito`}
        >
          {isMedical ? <Stethoscope className="h-6 w-6" /> : <Scale className="h-6 w-6" />}
          {/* Priority indicator badge */}
          {suggestionCount > 0 && (
            <span className={`absolute -top-1 -right-1 h-5 w-5 rounded-full text-[9px] font-bold flex items-center justify-center text-white shadow-md ${hasHighPriority ? "bg-red-500" : "bg-amber-400"}`}>
              {suggestionCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className={`w-full sm:max-w-lg flex flex-col p-0 ${isMedical ? 'bg-slate-50' : 'bg-neutral-950 text-neutral-200'}`}>
        {/* Header */}
        <SheetHeader className={`px-4 py-3 border-b space-y-3 ${isMedical ? 'bg-white' : 'bg-neutral-900 border-neutral-800'}`}>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shadow-sm ${isMedical ? 'bg-sky-50' : 'bg-neutral-800'}`}>
                {moduleIcon}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold">Athena</span>
                <span className="text-[11px] opacity-70 font-normal">{moduleName} • Flaito</span>
              </div>
            </SheetTitle>
            <div className="flex items-center gap-1">
              {isScanning && (
                <div className="flex items-center gap-1 text-[10px] opacity-60">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Analisando...</span>
                </div>
              )}
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 text-xs">
                  <X className="h-4 w-4 mr-1" />
                  Nova conversa
                </Button>
              )}
            </div>
          </div>

          {/* Client Mode Indicator */}
          {effectiveClientId && effectiveClientName && (
            <div className="flex items-center gap-2 rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-xs font-medium text-teal-700 dark:text-teal-300 truncate">
                Cliente em Foco: {effectiveClientName}
              </span>
              {activeStudyContext && (
                <Badge variant="outline" className="text-[9px] border-teal-300 text-teal-600 dark:border-teal-700 dark:text-teal-400">
                  Contexto ativo
                </Badge>
              )}
            </div>
          )}

          {/* Patient Mode Indicator */}
          {effectivePatientId && effectivePatientName && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
                Paciente em Foco: {effectivePatientName}
              </span>
            </div>
          )}

          {/* Documentos vinculados */}
          {(effectiveClientId || effectivePatientId) && (
            <div className="px-2 py-1">
              <div className="flex items-center gap-2 text-xs mb-1 opacity-80">
                <FileText className="h-3 w-3" />
                <span>Documentos RAG disponíveis ({entityDocs.length})</span>
              </div>
              <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto scrollbar-thin">
                {loadingDocs ? (
                  <span className="text-[10px] animate-pulse opacity-70">Sincronizando...</span>
                ) : entityDocs.length > 0 ? (
                  entityDocs.map(doc => (
                    <Badge key={doc.id} variant="outline" className={`text-[9px] px-1.5 py-0 truncate max-w-[150px] border-opacity-30 ${isMedical ? 'bg-white' : 'bg-neutral-900 border-neutral-700'}`}>
                      {doc.title}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[10px] opacity-60">Nenhum documento anexado ao perfil.</span>
                )}
              </div>
            </div>
          )}

          {/* Context Selector */}
          <div className="flex items-center gap-2">
            <Select value={effectivePatientId ? "patient" : (effectiveClientId ? "client" : scope)} onValueChange={(v) => setScope(v as ChatScope)}>
              <SelectTrigger className={`h-8 text-xs flex-1 border-opacity-50 ${isMedical ? 'bg-white/80 border-slate-200' : 'bg-neutral-900 border-neutral-700 text-neutral-300'}`}>
                <SelectValue placeholder="Contexto" />
              </SelectTrigger>
              <SelectContent className={!isMedical ? "dark bg-neutral-900 border-neutral-800 text-neutral-200" : ""}>
                <SelectItem value="global">Global</SelectItem>
                {caseId && <SelectItem value="case">Caso atual</SelectItem>}
                {(clientId || effectiveClientId) && <SelectItem value="client">Cliente atual</SelectItem>}
                {(patientId || effectivePatientId) && <SelectItem value="patient">Paciente atual</SelectItem>}
                <SelectItem value="page">Página atual</SelectItem>
              </SelectContent>
            </Select>
            {hasContext && (
              <Badge variant="secondary" className={`text-xs border-0 ${isMedical ? 'bg-sky-100 text-sky-800' : 'bg-neutral-800 text-neutral-300'}`}>{getScopeLabel()}</Badge>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action) => (
              <Button
                key={action.mode}
                variant="outline"
                size="sm"
                className={`h-7 text-xs gap-1.5 hover:opacity-90 border-opacity-50 ${isMedical ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300'}`}
                onClick={() => sendMessage(action.prompt, action.mode)}
                disabled={loading}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </SheetHeader>
        
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin ${isMedical ? 'bg-[#FAFAFA]' : 'bg-[#0A0A0A]'}`}>
          {/* Welcome Message */}
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4 animate-in fade-in duration-700">
              <div className={`h-20 w-20 rounded-full flex items-center justify-center shadow-xl ${isMedical ? 'bg-sky-100/50' : 'bg-neutral-900 shadow-neutral-900/50'}`}>
                {isMedical ? <Stethoscope className="h-10 w-10 text-sky-600" /> : <Scale className="h-10 w-10 text-neutral-400" />}
              </div>
              <h3 className={`text-xl font-bold tracking-tight ${isMedical ? 'text-slate-900' : 'text-neutral-100'}`}>Athena</h3>
              
              <div className={`text-sm max-w-[340px] text-left rounded-3xl p-6 shadow-sm border ${isMedical ? 'bg-white border-slate-100 text-slate-600' : 'bg-neutral-900/50 border-neutral-800 text-neutral-300'}`}>
                <ReactMarkdown components={markdownComponents} rehypePlugins={[rehypeHighlight]}>
                  {welcomeMessage}
                </ReactMarkdown>
              </div>

              {/* Proactive Suggestions on welcome screen */}
              {suggestions.length > 0 && (
                <div className="w-full max-w-[340px] space-y-3">
                  <p className={`text-[11px] font-bold uppercase tracking-wider px-1 opacity-50 ${isMedical ? 'text-slate-500' : 'text-neutral-500'}`}>
                    Ações Sugeridas
                  </p>
                  {suggestions.slice(0, 3).map((sug) => (
                    <AthenaSuggestionCard
                      key={sug.id}
                      suggestion={sug}
                      onDismiss={dismissSuggestion}
                      onExecute={handleSuggestionExecute}
                      isExecuting={isExecuting === sug.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.length > 0 && (
            <>
                {/* Suggestions at top of conversation (minimal, collapsible) */}
                {suggestions.length > 0 && messages.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground px-0.5">📋 Pendências:</p>
                    {suggestions.slice(0, 2).map((sug) => (
                      <AthenaSuggestionCard
                        key={sug.id}
                        suggestion={sug}
                        onDismiss={dismissSuggestion}
                        onExecute={handleSuggestionExecute}
                        isExecuting={isExecuting === sug.id}
                      />
                    ))}
                  </div>
                )}

                {/* Messages */}
                {messages.map((msg, idx) => (
                  <div
                    key={`msg-${idx}-${msg.timestamp.getTime()}`}
                    className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 shadow-sm">
                        {isMedical ? <Stethoscope className="h-4 w-4 text-primary" /> : <Scale className="h-4 w-4 text-primary" />}
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] sm:max-w-[750px] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        msg.role === "user"
                          ? "bg-[#DCF8C6] dark:bg-emerald-800/80 text-foreground rounded-br-md"
                          : "bg-[#F5F5F5] dark:bg-muted/70 text-foreground rounded-bl-md"
                      } relative group`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown components={markdownComponents} rehypePlugins={[rehypeHighlight]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}

                      {/* Permission Prompt for Tools */}
                      {msg.role === "assistant" && msg.requires_permission && msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="mt-4">
                          {msg.tool_calls.map((tc, tci) => (
                            <PermissionPromptCard
                              key={tci}
                              toolName={tc.function.name}
                              onApprove={(permMode) => {
                                if (permMode === "session") {
                                  setAllowedSessionTools(prev => [...prev, tc.function.name]);
                                }
                                executeTool(tc, idx);
                              }}
                              onDecline={() => {
                                setMessages(prev => {
                                  const next = [...prev];
                                  next[idx].requires_permission = false;
                                  return next;
                                });
                                sendMessage(`[PERMISSÃO NEGADA PARA ${tc.function.name}]`, "chat");
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Source Provenance */}
                      {msg.role === "assistant" && msg.sources_used && msg.sources_used.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/20 space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground">Fontes:</span>
                          {msg.sources_used.map((src, si) => (
                            <div key={si} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              {src.type === "system_context" && <span>🗄️</span>}
                              {src.type === "private_knowledge" && <span>📚</span>}
                              {src.type === "web" && <span>🌐</span>}
                              {src.type === "escavador" && <span>🔍</span>}
                              <span className="capitalize">
                                {src.type === "system_context" ? "Sistema" : 
                                 src.type === "private_knowledge" ? "Biblioteca" : 
                                 src.type === "web" ? "Web" : 
                                 src.type === "escavador" ? "Escavador" : src.type}
                              </span>
                              {src.titles.length > 0 && (
                                <span className="truncate max-w-[180px]">
                                  — {src.titles.slice(0, 2).join(", ")}
                                </span>
                              )}
                              <span className="text-[9px] opacity-60">
                                ({(src.similarity_avg * 100).toFixed(0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Audit Seal - Only for assistant messages */}
                      {msg.role === "assistant" && msg._audit && (
                        <AuditSeal
                          audit={msg._audit}
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        />
                      )}
                      <span className="text-[10px] opacity-50 mt-2 block text-right">
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>

                      {/* Action buttons from assistant */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-border/30 flex flex-wrap gap-1.5">
                          {msg.actions.map((action, i) => (
                            <Button
                              key={i}
                              variant="secondary"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => toast({ title: "Ação", description: `${action.label}: iniciando...` })}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 shadow-sm">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming message */}
                {loading && streamingText && (
                  <div className="flex gap-3 justify-start animate-fade-in">
                    <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 shadow-sm">
                      {isMedical ? <Stethoscope className="h-4 w-4 text-primary" /> : <Scale className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm bg-[#F5F5F5] dark:bg-muted/70 shadow-sm">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown components={markdownComponents} rehypePlugins={[rehypeHighlight]}>
                          {streamingText}
                        </ReactMarkdown>
                      </div>
                      <span className="inline-block w-1 h-4 bg-primary/60 animate-pulse ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Typing indicator */}
                {loading && !streamingText && (
                  <div className="flex gap-3 justify-start animate-fade-in">
                    <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shadow-sm">
                      {isMedical ? <Stethoscope className="h-4 w-4 text-primary" /> : <Scale className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="rounded-2xl rounded-bl-md bg-[#F5F5F5] dark:bg-muted/70 shadow-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-1" />
              </>
            )}
          </div>

        {/* Disclaimer */}
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20">
          <div className="flex items-start gap-2 text-[10px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Ferramenta de apoio.</strong> A decisão final é de responsabilidade exclusiva do profissional responsável.
            </span>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <TextareaAutosize
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                disabled={loading}
                minRows={1}
                maxRows={6}
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  toggleVoice(true);
                  // Opcional: fechar o sheet do chat se quiser focar na voz
                }}
                className="h-11 w-11 rounded-xl hover:bg-primary/10 text-primary transition-all"
                title="Ativar modo de voz"
              >
                <Mic className="h-5 w-5" />
              </Button>
              <Button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                size="icon"
                className="h-11 w-11 rounded-xl bg-primary hover:bg-primary/90 shadow-md transition-all hover:shadow-lg disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
