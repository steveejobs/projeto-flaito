import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
    Bot,
    Send,
    Sparkles,
    Activity,
    ShieldAlert,
    Pill,
    Microscope,
    Stethoscope,
    ChevronRight,
    Loader2,
    FileText,
    History,
    Trash2
} from "lucide-react";

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    type?: 'text' | 'differential' | 'interaction' | 'summary';
    data?: any;
    created_at?: string;
}

const DecifradorCasosPage = () => {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isLoadingHistory, setIsLoadingLoading] = useState(true);
    const { user } = useAuth();
    const { officeId } = useOfficeRole();
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'ai',
            type: 'text',
            content: 'Olá, Doutor(a). Eu sou o Assistente de Inteligência Clínica.\n\nEstou aqui para ajudar a decifrar casos complexos, gerar diagnósticos diferenciais, analisar interações medicamentosas e resumir o histórico de pacientes longos. Como posso apoiar sua conduta hoje?'
        }
    ]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (messages.length > 0) scrollToBottom();
    }, [messages, isTyping]);

    // Carregar histórico persistente
    const loadHistory = useCallback(async () => {
        if (!officeId) return;
        
        try {
            setIsLoadingLoading(true);
            const { data, error } = await supabase
                .from('medical_agent_analyses' as any)
                .select('*')
                .eq('office_id', officeId)
                .eq('agent_slug', 'decoder')
                .order('created_at', { ascending: true })
                .limit(50);

            if (error) throw error;

            if (data && data.length > 0) {
                const historyMessages: Message[] = [];
                data.forEach((row: any) => {
                    // Adiciona a pergunta do usuário
                    historyMessages.push({
                        id: `u-${row.id}`,
                        role: 'user',
                        content: row.input_text || '',
                        created_at: row.created_at
                    });
                    // Adiciona a resposta da IA
                    if (row.result_json) {
                        historyMessages.push({
                            id: `ai-${row.id}`,
                            role: 'ai',
                            type: row.result_json.type || 'text',
                            content: row.result_json.content || '',
                            data: row.result_json.data,
                            created_at: row.created_at
                        });
                    }
                });
                setMessages(prev => [prev[0], ...historyMessages]);
            }
        } catch (err: any) {
            console.error("Erro ao carregar histórico:", err);
        } finally {
            setIsLoadingLoading(false);
        }
    }, [officeId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const handleSend = async () => {
        if (!input.trim() || !officeId) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        setInput('');
        setIsTyping(true);

        try {
            const { data, error } = await supabase.functions.invoke('medical-agent-analysis', {
                body: {
                    officeId: officeId,
                    pacienteId: null,
                    inputText: currentInput,
                    tipoAnalise: 'chat',
                    agentType: 'decoder'
                }
            });

            if (error) throw new Error(error.message || "Erro na comunicação com a IA.");
            if (!data || !data.resultado) throw new Error("A IA retornou um formato inesperado.");

            const result = data.resultado;

            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                type: result.type || 'text',
                content: result.content || (result.type === 'text' ? '' : 'Baseado na análise, identifiquei os seguintes pontos:'),
                data: result.data || undefined
            };

            setMessages(prev => [...prev, aiResponse]);

            // Persistir no Banco de Dados
            await supabase.from('medical_agent_analyses' as any).insert({
                office_id: officeId,
                patient_id: null, // Pode ser expandido para contexto de paciente
                agent_slug: 'decoder',
                input_text: currentInput,
                result_json: result,
                metadata: { source: 'web-decifrador' }
            });
            
        } catch (error: any) {
            console.error("Chat Error:", error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                type: 'text',
                content: `🚨 **Erro de Conexão com o Agente:** ${error.message}. Por favor, verifique suas configurações de API ou tente novamente.`
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const clearHistory = async () => {
        if (!window.confirm("Deseja apagar todo o histórico de decifração clínica?")) return;
        
        try {
            const { error } = await supabase
                .from('medical_agent_analyses' as any)
                .delete()
                .eq('office_id', officeId)
                .eq('agent_slug', 'decoder');

            if (error) throw error;
            
            setMessages([messages[0]]);
            toast({ title: "Histórico limpo" });
        } catch (err: any) {
            toast({ title: "Erro ao limpar", description: err.message, variant: "destructive" });
        }
    };

    return (
        <div className="p-6 max-w-screen-xl mx-auto h-[calc(100vh-6rem)] flex flex-col animate-in fade-in duration-700">
            {/* Header Premium */}
            <header className="mb-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-2xl border border-indigo-500/10 shadow-inner">
                        <Bot className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-violet-400 bg-clip-text text-transparent">
                            Decifrador de Casos
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                            <Activity className="h-3 w-3 text-emerald-500" />
                            Co-piloto clínico para raciocínio diagnóstico e revisão de condutas.
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={clearHistory} className="text-muted-foreground hover:text-destructive gap-2 rounded-xl">
                        <Trash2 className="h-4 w-4" />
                        Limpar
                    </Button>
                    <div className="hidden md:flex gap-2">
                        <Badge variant="outline" className="bg-indigo-500/5 text-indigo-400 border-indigo-500/10 py-1.5 px-3 rounded-full hover:bg-indigo-500/10 transition-colors">
                            Sintomas
                        </Badge>
                        <Badge variant="outline" className="bg-rose-500/5 text-rose-400 border-rose-500/10 py-1.5 px-3 rounded-full hover:bg-rose-500/10 transition-colors">
                            Interações
                        </Badge>
                    </div>
                </div>
            </header>

            {/* Chat Container - Glassmorphism UI */}
            <Card className="flex-1 flex flex-col bg-slate-950/40 border-white/5 overflow-hidden shadow-2xl relative backdrop-blur-sm rounded-3xl">
                <div className="absolute inset-0 bg-grid-white/[0.01] bg-[length:40px_40px] pointer-events-none" />
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />

                {/* Messages */}
                <ScrollArea className="flex-1 p-6 relative">
                    {isLoadingHistory && (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                        </div>
                    )}
                    
                    <div className="space-y-8 max-w-4xl mx-auto pb-6">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {/* Avatar com Glow */}
                                <div className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center shadow-2xl transition-transform hover:scale-105 ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-blue-600 to-cyan-500 shadow-blue-500/20'
                                        : 'bg-gradient-to-br from-indigo-600 to-purple-500 shadow-indigo-500/20'
                                    }`}>
                                    {msg.role === 'user' ? <Stethoscope className="h-6 w-6 text-white" /> : <Sparkles className="h-6 w-6 text-white" />}
                                </div>

                                {/* Bubble - Premium Content */}
                                <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-3`}>
                                    <div className={`p-5 rounded-3xl shadow-sm ${msg.role === 'user'
                                            ? 'bg-blue-600/15 border border-blue-500/20 text-blue-50 rounded-tr-none'
                                            : 'bg-white/[0.03] border border-white/10 text-slate-100 rounded-tl-none'
                                        }`}>
                                        <p className="whitespace-pre-wrap leading-relaxed text-[15px]">
                                            {msg.content}
                                        </p>
                                    </div>

                                    {/* AI Specialized Cards */}
                                    {msg.role === 'ai' && msg.type === 'differential' && msg.data && (
                                        <div className="grid grid-cols-1 gap-4 w-full mt-2 animate-in slide-in-from-bottom-4 duration-500">
                                            {msg.data.map((diff: any, i: number) => (
                                                <Card key={i} className="p-5 bg-indigo-950/20 border-indigo-500/20 hover:border-indigo-500/40 transition-all rounded-2xl group">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h4 className="font-bold text-indigo-200 text-lg flex items-center gap-2 group-hover:text-indigo-100">
                                                            <Microscope className="h-5 w-5 text-indigo-400" /> {diff.condicao}
                                                        </h4>
                                                        <Badge variant="outline" className={cn(
                                                            "rounded-lg font-bold border-none",
                                                            diff.prob === 'Alta' ? 'bg-red-500/10 text-red-400' :
                                                                diff.prob === 'Moderada' ? 'bg-amber-500/10 text-amber-400' :
                                                                    'bg-emerald-500/10 text-emerald-400'
                                                        )}>
                                                            Probabilidade: {diff.prob}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-slate-300/80 leading-relaxed italic border-l-2 border-indigo-500/20 pl-4">{diff.descricao}</p>
                                                </Card>
                                            ))}
                                        </div>
                                    )}

                                    {msg.role === 'ai' && msg.type === 'interaction' && msg.data && (
                                        <div className="grid grid-cols-1 gap-3 w-full mt-2 animate-in slide-in-from-bottom-4 duration-500">
                                            {msg.data.map((int: any, i: number) => (
                                                <Card key={i} className="p-5 bg-rose-950/20 border-rose-500/20 rounded-2xl">
                                                    <div className="flex gap-4">
                                                        <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                                                            <ShieldAlert className="h-6 w-6 text-rose-500" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-rose-200 text-base flex items-center gap-2">
                                                                <Pill className="h-4 w-4" /> {int.drogaA} <span className="text-rose-500/50 font-black">×</span> {int.drogaB}
                                                            </h4>
                                                            <p className="text-sm text-rose-100/60 mt-2 font-medium bg-rose-500/5 p-3 rounded-lg border border-rose-500/10">{int.risco}</p>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}

                                    {msg.created_at && (
                                        <span className="text-[10px] text-slate-500 font-mono px-2">
                                            {new Date(msg.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex gap-4 flex-row animate-pulse">
                                <div className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                                    <Bot className="h-6 w-6 text-white" />
                                </div>
                                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col justify-center rounded-tl-none">
                                    <div className="flex gap-2 items-center">
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span className="text-xs font-bold text-indigo-400/80 uppercase tracking-widest mt-3">Correlacionando literatura clínica...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Input Area - Futuristic Gloss */}
                <div className="p-6 bg-black/60 border-t border-white/5 backdrop-blur-xl shrink-0">
                    <div className="max-w-4xl mx-auto relative flex items-end gap-4">
                        <div className="flex-1 relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                            <Textarea
                                placeholder="Descreva o quadro clínico, liste sintomas ou analise uma prescrição..."
                                className="relative min-h-[70px] max-h-[250px] resize-none pr-14 py-4 rounded-2xl bg-slate-900/50 border-white/10 focus-visible:ring-indigo-500/50 text-[15px] placeholder:text-slate-500"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <div className="absolute right-4 bottom-4 flex gap-2">
                                <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-500 hover:text-indigo-400 rounded-xl hover:bg-indigo-500/10 transition-all">
                                    <FileText className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <Button
                            onClick={handleSend}
                            disabled={!input.trim() || isTyping || !officeId}
                            className="h-[70px] w-[70px] shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all border border-indigo-400/20"
                        >
                            {isTyping ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6 text-white" />}
                        </Button>
                    </div>
                    <p className="text-[10px] text-center text-slate-600 mt-4 uppercase tracking-[0.2em] font-bold">
                        Powered by Flaito Decipher Engine • HIPAA Compliant
                    </p>
                </div>
            </Card>
        </div>
    );
};

export default DecifradorCasosPage;
