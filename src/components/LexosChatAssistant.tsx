import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Scale, Send, Loader2, User, X, FileText, ListChecks, ArrowRight, Sparkles, AlertTriangle, SendHorizonal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import TextareaAutosize from "react-textarea-autosize";
import { assertLexosChatPayload, type LexosChatMode } from "@/contracts/lexosChatAssistant";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: AssistantAction[];
  isStreaming?: boolean;
}

interface AssistantAction {
  type: string;
  payload: Record<string, unknown>;
  label: string;
}

type ChatScope = "global" | "case" | "client" | "page";

interface LexosChatAssistantProps {
  caseId?: string | null;
  clientId?: string | null;
}

const QUICK_ACTIONS: { mode: LexosChatMode; label: string; icon: React.ReactNode; prompt: string }[] = [
  { mode: "summarize", label: "Resumir", icon: <FileText className="h-3 w-3" />, prompt: "Faça um resumo do contexto atual." },
  { mode: "next_step", label: "Próximo passo", icon: <ArrowRight className="h-3 w-3" />, prompt: "Qual o próximo passo recomendado?" },
  { mode: "generate_draft", label: "Gerar minuta", icon: <Sparkles className="h-3 w-3" />, prompt: "Sugira uma estrutura de petição adequada." },
  { mode: "checklist", label: "Checklist", icon: <ListChecks className="h-3 w-3" />, prompt: "Gere um checklist de tarefas para este contexto." },
];

const WELCOME_MESSAGE = `Sou a **Inteligência Artificial oficial do LEXOS**, o cérebro institucional do sistema de gestão jurídica.

Estou preparado para auxiliar com:
- Análise de prazos e prescrição
- Fundamentação jurídica e precedentes
- Geração de minutas e checklists
- Acompanhamento processual

Selecione um contexto acima ou faça sua pergunta.`;

// Typing animation dots component
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

export function LexosChatAssistant({ caseId, clientId }: LexosChatAssistantProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [scope, setScope] = useState<ChatScope>("global");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Auto-detect scope based on context
  useEffect(() => {
    if (caseId) {
      setScope("case");
    } else if (clientId) {
      setScope("client");
    } else {
      setScope("global");
    }
  }, [caseId, clientId]);

  // Scroll to bottom on new messages or loading
  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timer);
  }, [messages, loading, streamingText, scrollToBottom]);

  // Load existing thread when chat opens
  useEffect(() => {
    if (open && !historyLoadedRef.current && !loadingHistory) {
      loadExistingThread();
    }
  }, [open]);

  const loadExistingThread = async () => {
    try {
      setLoadingHistory(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: tid, error } = await supabase.rpc("get_or_create_chat_thread", {
        p_scope: scope,
        p_case_id: scope === "case" ? caseId : null,
        p_client_id: scope === "client" ? clientId : null,
        p_route: location.pathname,
      });

      if (error) {
        console.error("[LEXOS-AI] Get thread error:", error);
        return;
      }

      if (tid) {
        setThreadId(tid);
        await loadThreadMessages(tid);
        historyLoadedRef.current = true;
      }
    } catch (err) {
      console.error("[LEXOS-AI] Load existing thread error:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadThreadMessages = async (tid: string) => {
    if (!tid) return;

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", tid)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) {
        console.error("[LEXOS-AI] Load messages error:", error);
        return;
      }

      if (data && data.length > 0) {
        const loaded: Message[] = data.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at),
          actions: m.metadata?.actions,
        }));
        setMessages(loaded);
      }
    } catch (err) {
      console.error("[LEXOS-AI] Load error:", err);
    }
  };

  const fetchContext = async (): Promise<Record<string, unknown>> => {
    const context: Record<string, unknown> = {};

    try {
      if (caseId) {
        const { data: caseData, error: caseError } = await supabase
          .from("cases")
          .select(`
            id, title, cnj_number, area, subtype, side, status, stage, nija_phase,
            opponent_name, opponent_doc,
            client:clients!cases_client_id_fkey (
              id, full_name, person_type, cpf, cnpj, email, phone
            )
          `)
          .eq("id", caseId)
          .maybeSingle();

        if (!caseError && caseData) {
          const client = caseData.client as Record<string, unknown> | null;
          context.case = {
            id: caseData.id,
            title: caseData.title,
            cnj_number: caseData.cnj_number,
            area: caseData.area,
            subtype: caseData.subtype,
            side: caseData.side,
            status: caseData.status,
            stage: caseData.stage,
            nija_phase: caseData.nija_phase,
            opponent_name: caseData.opponent_name,
            opponent_doc: caseData.opponent_doc,
            client_name: client?.full_name || null,
            client_type: client?.person_type || null,
            client_doc: client?.cpf || client?.cnpj || null,
          };
          if (client) {
            context.client = {
              id: client.id,
              name: client.full_name,
              type: client.person_type,
              doc: client.cpf || client.cnpj,
              email: client.email,
              phone: client.phone,
            };
          }
        }
      }

      if (clientId && !context.client) {
        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .select("id, full_name, person_type, cpf, cnpj, email, phone")
          .eq("id", clientId)
          .maybeSingle();

        if (!clientError && clientData) {
          context.client = {
            id: clientData.id,
            name: clientData.full_name,
            type: clientData.person_type,
            doc: clientData.cpf || clientData.cnpj,
            email: clientData.email,
            phone: clientData.phone,
          };
        }
      }
    } catch (err) {
      console.error("[LEXOS-AI] Error fetching context:", err);
    }

    return context;
  };

  // Simulate streaming effect for the response
  const simulateStreaming = useCallback((fullText: string, onComplete: () => void) => {
    let currentIndex = 0;
    const chunkSize = 3; // Characters per frame
    const interval = 15; // ms between frames

    const streamInterval = setInterval(() => {
      currentIndex += chunkSize;
      if (currentIndex >= fullText.length) {
        setStreamingText(fullText);
        clearInterval(streamInterval);
        onComplete();
      } else {
        setStreamingText(fullText.slice(0, currentIndex));
      }
    }, interval);

    return () => clearInterval(streamInterval);
  }, []);

  const sendMessage = useCallback(async (messageText: string, mode: LexosChatMode = "chat") => {
    const trimmedMessage = messageText.trim();
    
    if (!trimmedMessage || loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setStreamingText("");
    
    const userMessage = trimmedMessage;
    setInput("");

    const newUserMessage: Message = { role: "user", content: userMessage, timestamp: new Date() };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        loadingRef.current = false;
        setLoading(false);
        toast({ title: "LEXOS Assistant", description: "Sessão expirada. Faça login novamente.", variant: "destructive" });
        return;
      }

      const context = await fetchContext();

      const body = {
        message: userMessage,
        mode,
        thread_id: threadId,
        scope,
        case_id: caseId || null,
        client_id: clientId || null,
        route: location.pathname,
        context,
      };
      assertLexosChatPayload(body);

      const { data, error } = await supabase.functions.invoke("lexos-chat-assistant", {
        body,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const status = (error as any)?.context?.status as number | undefined;
        let msg = `Erro de conexão: ${error.message || JSON.stringify(error)}`;

        if (status === 402) {
          msg = "Créditos de IA esgotados. Adicione créditos ao workspace (Settings → Workspace → Usage).";
        } else if (status === 429) {
          msg = "Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.";
        }

        toast({ title: "LEXOS Assistant", description: msg, variant: "destructive" });
        loadingRef.current = false;
        setLoading(false);
        return;
      }

      if (data?.error) {
        const msg = `${data.error}${data.details ? " | " + data.details : ""}`;
        toast({ title: "LEXOS Assistant", description: msg, variant: "destructive" });
        loadingRef.current = false;
        setLoading(false);
        return;
      }

      if (data?.thread_id && !threadId) {
        setThreadId(data.thread_id);
      }

      const responseText = data?.message || "Não foi possível processar sua solicitação no momento.";
      
      // Start streaming animation
      simulateStreaming(responseText, () => {
        const assistantMessage: Message = {
          role: "assistant",
          content: responseText,
          timestamp: new Date(),
          actions: data?.actions,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingText("");
        loadingRef.current = false;
        setLoading(false);
      });

    } catch (err: any) {
      const msg = err?.message || "Erro ao processar solicitação";
      console.error("[LEXOS-AI] Error:", err);
      toast({ title: "LEXOS Assistant", description: msg, variant: "destructive" });
      setMessages((prev) => prev.slice(0, -1));
      loadingRef.current = false;
      setLoading(false);
    }
  }, [threadId, scope, caseId, clientId, location.pathname, simulateStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
    // Shift+Enter allows line break (default textarea behavior)
  };

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    sendMessage(action.prompt, action.mode);
  };

  const clearChat = () => {
    setMessages([]);
    setThreadId(null);
    setStreamingText("");
    historyLoadedRef.current = false;
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  const getScopeLabel = () => {
    switch (scope) {
      case "case": return "Caso atual";
      case "client": return "Cliente atual";
      case "page": return "Página atual";
      default: return "Global";
    }
  };

  const hasContext = caseId || clientId;

  // Markdown components for custom styling
  const markdownComponents = {
    h1: ({ children }: any) => <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-base font-bold mt-2 mb-1">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
    p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="ml-2">{children}</li>,
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-primary/50 pl-3 italic my-2 text-muted-foreground">
        {children}
      </blockquote>
    ),
    code: ({ inline, children }: any) => 
      inline ? (
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
      ) : (
        <pre className="bg-muted/80 p-3 rounded-lg overflow-x-auto my-2">
          <code className="text-xs font-mono">{children}</code>
        </pre>
      ),
    strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
    a: ({ href, children }: any) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
        {children}
      </a>
    ),
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 z-50 transition-transform hover:scale-105"
          title="LEXOS Assistant - IA Institucional"
        >
          <Scale className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 bg-background/95 backdrop-blur-sm">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b space-y-3 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shadow-sm">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold">LEXOS Assistant</span>
                <span className="text-[11px] text-muted-foreground font-normal">Inteligência Artificial Institucional</span>
              </div>
            </SheetTitle>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 text-xs">
                <X className="h-4 w-4 mr-1" />
                Nova conversa
              </Button>
            )}
          </div>

          {/* Context Selector */}
          <div className="flex items-center gap-2">
            <Select value={scope} onValueChange={(v) => setScope(v as ChatScope)}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-background/80">
                <SelectValue placeholder="Contexto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                {caseId && <SelectItem value="case">Caso atual</SelectItem>}
                {clientId && <SelectItem value="client">Cliente atual</SelectItem>}
                <SelectItem value="page">Página atual</SelectItem>
              </SelectContent>
            </Select>

            {hasContext && (
              <Badge variant="secondary" className="text-xs">
                {getScopeLabel()}
              </Badge>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.mode}
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 bg-background/80 hover:bg-background"
                onClick={() => handleQuickAction(action)}
                disabled={loading}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </SheetHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 bg-gradient-to-b from-muted/30 to-muted/10" ref={scrollAreaRef}>
          <div className="p-4 space-y-4 min-h-[300px]">
            {messages.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-lg">
                  <Scale className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-3">LEXOS Assistant</h3>
                <div className="text-sm text-muted-foreground max-w-[320px] text-left rounded-2xl p-4 bg-[#F5F5F5] dark:bg-muted/50 shadow-sm">
                  <ReactMarkdown components={markdownComponents} rehypePlugins={[rehypeHighlight]}>
                    {WELCOME_MESSAGE}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div
                    key={`msg-${idx}-${msg.timestamp.getTime()}`}
                    className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Scale className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] sm:max-w-[750px] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        msg.role === "user"
                          ? "bg-[#DCF8C6] dark:bg-emerald-800/80 text-foreground rounded-br-md"
                          : "bg-[#F5F5F5] dark:bg-muted/70 text-foreground rounded-bl-md"
                      }`}
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
                      <span className="text-[10px] opacity-50 mt-2 block text-right">
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>

                      {/* Actions from assistant */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-border/30 flex flex-wrap gap-1.5">
                          {msg.actions.map((action, i) => (
                            <Button
                              key={i}
                              variant="secondary"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                toast({ title: "Ação", description: `${action.label}: ${action.type}` });
                              }}
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
                      <Scale className="h-4 w-4 text-primary" />
                    </div>
                    <div className="max-w-[85%] sm:max-w-[750px] rounded-2xl rounded-bl-md px-4 py-3 text-sm bg-[#F5F5F5] dark:bg-muted/70 shadow-sm">
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
                      <Scale className="h-4 w-4 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-bl-md bg-[#F5F5F5] dark:bg-muted/70 shadow-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} className="h-1" />
              </>
            )}
          </div>
        </ScrollArea>

        {/* Disclaimer */}
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20">
          <div className="flex items-start gap-2 text-[10px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Ferramenta de apoio.</strong> A decisão final é de responsabilidade exclusiva do advogado responsável.
            </span>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <TextareaAutosize
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua consulta jurídica... (Enter envia, Shift+Enter quebra linha)"
                disabled={loading}
                minRows={1}
                maxRows={6}
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              />
            </div>
            <Button 
              onClick={() => sendMessage(input)} 
              disabled={loading || !input.trim()} 
              size="icon"
              className="h-11 w-11 rounded-xl bg-primary hover:bg-primary/90 shadow-md transition-all hover:shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendHorizonal className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
