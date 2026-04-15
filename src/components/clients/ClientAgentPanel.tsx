import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Bot, Sparkles, Send, Loader2, Info, History, User, Terminal } from "lucide-react";
import { executeAgent, getActiveAgents, getAgentHistory, type AgentExecuteResponse, type AgentExecution } from "@/services/agentService";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
    clientId: string;
}

const AGENT_NAME_MAPPING: Record<string, string> = {
    'lexos-chat-assistant': 'Lexos Chat Assistant',
    'voice-assistant': 'Assistente de Voz',
    'nija-full-analysis': 'Análise NIJA (Completa)',
    'maestro-orchestrator': 'Orquestrador Maestro',
    'document-analyzer': 'Analisador de Documentos',
    'legal-researcher': 'Pesquisador Jurídico',
};

const SUGGESTED_ACTIONS = [
    {
        id: 'summarize',
        label: 'Gerar Resumo',
        agentSlug: 'lexos-chat-assistant',
        input: 'Resuma este cliente de forma objetiva para uso interno, focando no perfil e necessidades.',
    },
    {
        id: 'next-steps',
        label: 'Próximos Passos',
        agentSlug: 'lexos-chat-assistant',
        input: 'Com base nos dados e notas do cliente, sugira 3 próximos passos concretos para o atendimento.',
    },
    {
        id: 'analyze-risk',
        label: 'Analisar Perfil',
        agentSlug: 'nija-full-analysis',
        input: 'Realize uma análise crítica do perfil deste cliente buscando inconsistências ou pontos de atenção.',
    },
    {
        id: 'welcome-msg',
        label: 'Sugerir Mensagem',
        agentSlug: 'lexos-chat-assistant',
        input: 'Crie um rascunho de mensagem cordial de primeiro contato, baseando-se nos dados disponíveis.',
    }
];

export function ClientAgentPanel({ clientId }: Props) {
    const [agents, setAgents] = useState<string[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("");
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<AgentExecuteResponse | null>(null);
    const [history, setHistory] = useState<AgentExecution[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [useRecentContext, setUseRecentContext] = useState(false);

    useEffect(() => {
        const loadAgents = async () => {
            const slugs = await getActiveAgents();
            setAgents(slugs);
            if (slugs.length > 0) {
                // Tentar selecionar o lexos-chat-assistant por padrão se existir
                if (slugs.includes('lexos-chat-assistant')) {
                    setSelectedAgent('lexos-chat-assistant');
                } else {
                    setSelectedAgent(slugs[0]);
                }
            }
        };
        const loadHistory = async () => {
            setLoadingHistory(true);
            try {
                const data = await getAgentHistory(clientId);
                setHistory(data);
            } catch (error) {
                console.error("Erro ao carregar histórico:", error);
            } finally {
                setLoadingHistory(false);
            }
        };

        loadAgents();
        loadHistory();
        // Resetar toggle ao trocar de cliente (Etapa 9)
        setUseRecentContext(false);
    }, [clientId]);

    const handleExecute = async (overrideParams?: { agentSlug: string, input: string }) => {
        const agentToUse = overrideParams?.agentSlug || selectedAgent;
        const inputToUse = overrideParams?.input || input;

        if (!agentToUse) {
            toast.error("Por favor, selecione um agente.");
            return;
        }
        if (!inputToUse.trim()) {
            toast.error("Por favor, digite uma instrução ou pergunta.");
            return;
        }

        setLoading(true);
        setResponse(null);
        try {
            const res = await executeAgent({
                clientId,
                agentSlug: agentToUse,
                input: inputToUse.trim(),
                useContext: useRecentContext
            });
            setResponse(res);
            toast.success("Agente executado com sucesso!");
        } catch (error: any) {
            toast.error(error.message || "Erro ao executar agente.");
        } finally {
            setLoading(false);
            // Atualizar histórico após execução
            const updatedHistory = await getAgentHistory(clientId);
            setHistory(updatedHistory);
        }
    };

    const handleQuickAction = (action: typeof SUGGESTED_ACTIONS[0]) => {
        if (loading) return;
        
        // Feedback visual: preencher campos
        setSelectedAgent(action.agentSlug);
        setInput(action.input);

        // Executar após pequeno delay para o usuário perceber a mudança
        setTimeout(() => {
            handleExecute({
                agentSlug: action.agentSlug,
                input: action.input
            });
        }, 300);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="border-violet-500/10 bg-violet-500/[0.02]">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base flex items-center gap-2 text-violet-600 dark:text-violet-400">
                                <Bot className="h-5 w-5" />
                                Inteligência Cognitiva
                            </CardTitle>
                            <CardDescription>
                                Execute agentes de IA sobre o contexto deste cliente
                            </CardDescription>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="h-3 w-3" />
                            Live Engine
                        </div>
                    </div>

                    {/* Toggle de Memória Contextual (Etapa 9) */}
                    <div className={cn(
                        "mt-4 flex items-center justify-between p-3 rounded-xl border transition-all duration-300",
                        useRecentContext 
                            ? "bg-violet-500/10 border-violet-500/30 shadow-sm shadow-violet-500/10" 
                            : "bg-background/40 border-violet-500/10"
                    )}>
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="context-memory" className="text-xs font-bold cursor-pointer flex items-center gap-1.5">
                                    <History className={cn("h-3.5 w-3.5 transition-colors", useRecentContext ? "text-violet-500" : "text-muted-foreground")} />
                                    Continuidade Contextual
                                </Label>
                                {useRecentContext && (
                                    <span className="text-[8px] bg-violet-500 text-white px-1 rounded animate-pulse uppercase font-black">Ativa</span>
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                                Utiliza as últimas 3 execuções como memória para esta tarefa.
                            </p>
                        </div>
                        <Switch 
                            id="context-memory"
                            checked={useRecentContext}
                            onCheckedChange={setUseRecentContext}
                            className="data-[state=checked]:bg-violet-500"
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                            Selecionar Agente
                        </label>
                        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                            <SelectTrigger className="w-full bg-background/50 border-violet-500/20 focus:ring-violet-500/30">
                                <SelectValue placeholder="Escolha um agente..." />
                            </SelectTrigger>
                            <SelectContent>
                                {agents.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                        Nenhum agente ativo localizado
                                    </div>
                                ) : (
                                    agents.map(slug => (
                                        <SelectItem key={slug} value={slug} className="text-sm font-medium">
                                            {AGENT_NAME_MAPPING[slug] || slug}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                            Ações Sugeridas
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTED_ACTIONS
                                .filter(action => agents.includes(action.agentSlug))
                                .map((action) => (
                                    <Button
                                        key={action.id}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleQuickAction(action)}
                                        disabled={loading}
                                        className="h-7 text-[10px] font-bold border-violet-500/10 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
                                    >
                                        {action.label}
                                    </Button>
                                ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                            Instrução / Comando
                        </label>
                        <Textarea
                            placeholder="Ex: Resuma o perfil deste cliente ou analise se há inconsistências nos dados..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="min-h-[100px] bg-background/50 border-violet-500/20 focus:border-violet-500/50 resize-none text-sm"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    handleExecute();
                                }
                            }}
                        />
                        <p className="text-[9px] text-muted-foreground italic px-1">
                            Pressione Ctrl + Enter para executar rapidamente.
                        </p>
                    </div>

                    <Button
                        onClick={handleExecute}
                        disabled={loading || !selectedAgent || !input.trim()}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-violet-600/20 transition-all active:scale-[0.98]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Processando Inteligência...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                Executar Agente
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Resultado */}
            {response && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    <Card className="border-emerald-500/10 bg-emerald-500/[0.01]">
                        <CardHeader className="pb-2 border-b border-emerald-500/5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    Resposta do Agente
                                </CardTitle>
                                {response._audit && (
                                    <div className="flex items-center gap-3">
                                        <div className="text-[9px] font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                            {response._audit.model}
                                        </div>
                                        <div className="text-[9px] font-bold text-violet-400 bg-violet-400/5 px-2 py-0.5 rounded border border-violet-400/10 uppercase">
                                            {response._audit.source} Source
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground/90 font-medium">
                                <ReactMarkdown>
                                    {response.content}
                                </ReactMarkdown>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                        <Info className="h-4 w-4 text-blue-500" />
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                            Esta resposta foi gerada utilizando apenas o nome, email, telefone e notas deste cliente para garantir a privacidade.
                        </p>
                    </div>
                </div>
            )}

            {loading && !response && (
                <div className="flex flex-col items-center justify-center py-20 bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
                    <div className="relative">
                        <Loader2 className="h-10 w-10 text-violet-500/30 animate-spin" />
                        <Bot className="h-5 w-5 text-violet-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
                        Sincronizando Contexto...
                    </p>
                </div>
            )}

            {/* Histórico Simplificado (Ajuste Etapa 7) */}
            <div className="pt-6 border-t border-violet-500/10">
                <div className="flex items-center gap-2 mb-4 px-1">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Histórico de Execuções
                    </h3>
                </div>

                {loadingHistory ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
                    </div>
                ) : history.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic text-center py-4 px-6 border border-dashed border-muted-foreground/10 rounded-lg">
                        Nenhuma execução registrada para este cliente.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {history.map((item) => (
                            <div 
                                key={item.id} 
                                className="p-3 rounded-lg bg-background/40 border border-muted-foreground/5 hover:border-violet-500/20 transition-all group"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-violet-500/80 uppercase tracking-tighter">
                                            {AGENT_NAME_MAPPING[item.agent_slug] || item.agent_slug}
                                        </span>
                                        <span className="text-[8px] text-muted-foreground/60">•</span>
                                        <span className="text-[9px] font-mono text-muted-foreground/60">
                                            {new Date(item.created_at).toLocaleString('pt-BR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-bold text-muted-foreground/40 bg-muted-foreground/5 px-1.5 py-0.5 rounded uppercase">
                                            {item.config_source} v{item.config_version}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="space-y-1.5">
                                    <div className="flex gap-2">
                                        <User className="h-3 w-3 text-muted-foreground/30 mt-0.5 shrink-0" />
                                        <p className="text-[11px] text-muted-foreground/80 leading-tight">
                                            {item.input}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 p-2 rounded-md bg-emerald-500/[0.02] border border-emerald-500/5">
                                        <Terminal className="h-3 w-3 text-emerald-500/30 mt-0.5 shrink-0" />
                                        <div className="text-[11px] text-foreground/70 leading-relaxed overflow-hidden text-ellipsis line-clamp-3">
                                            {item.output}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
