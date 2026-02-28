import React, { useState, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    FileText
} from "lucide-react";

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    type?: 'text' | 'differential' | 'interaction' | 'summary';
    data?: any;
}

const DecifradorCasosPage = () => {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
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
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = () => {
        if (!input.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        // Simulando raciocínio clínico da IA
        setTimeout(() => {
            let aiResponse: Message;

            const lowerInput = input.toLowerCase();

            if (lowerInput.includes('paciente') && lowerInput.includes('sintoma')) {
                // Diagnóstico Diferencial Mock
                aiResponse = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    content: 'Com base nos sintomas descritos (Fadiga, perda de peso, febre vespertina e sudorese noturna), aqui está a análise de Diagnóstico Diferencial:',
                    type: 'differential',
                    data: [
                        { condicao: 'Tuberculose Pulmonar', prob: 'Alta', descricao: 'Investigar história epidemiológica rastro de contatos. Pedir Rx Tórax e BAAR.' },
                        { condicao: 'Linfoma (Hodgkin / Não-Hodgkin)', prob: 'Moderada', descricao: 'Sintomas B clássicos. Avaliar linfonodomegalias e hemograma.' },
                        { condicao: 'Endocardite Infecciosa', prob: 'Baixa', descricao: 'Auscultar sopros, investigar uso de drogas IV ou procedimentos dentários recentes.' }
                    ]
                };
            } else if (lowerInput.includes('interação') || lowerInput.includes('remédio')) {
                // Interação Medicamentosa Mock
                aiResponse = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    content: 'Atenção aos seguintes riscos de interação medicamentosa encontrados na prescrição:',
                    type: 'interaction',
                    data: [
                        { drogaA: 'Fluoxetina', drogaB: 'Tramadol', gravidade: 'Alta', risco: 'Risco aumentado de Síndrome Serotoninérgica ou convulsões.' },
                        { drogaA: 'Omeprazol', drogaB: 'Clopidogrel', gravidade: 'Moderada', risco: 'Omeprazol pode reduzir a eficácia antiplaquetária do Clopidogrel (inibição da CYP2C19).' }
                    ]
                };
            } else {
                // Resposta Textual Genérica
                aiResponse = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'text',
                    content: 'Interessante. Baseado nos guidelines atuais, recomendo a solicitação inicial de exames laboratoriais amplos (Hemograma, PCR, VHS, perfil hepático e renal) antes de fecharmos a conduta.\n\nQuer que eu monte uma sugestão de protocolo de investigação?'
                };
            }

            setMessages(prev => [...prev, aiResponse]);
            setIsTyping(false);
        }, 2000);
    };

    return (
        <div className="p-6 max-w-screen-xl mx-auto h-[calc(100vh-6rem)] flex flex-col animate-in fade-in duration-700">
            {/* Header */}
            <header className="mb-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-2xl">
                        <Bot className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                            Decifrador de Casos (IA)
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Seu co-piloto clínico para raciocínio diagnóstico e revisão de condutas.
                        </p>
                    </div>
                </div>

                <div className="hidden md:flex gap-2">
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20">
                        Associação de Sintomas
                    </Badge>
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 cursor-pointer hover:bg-rose-500/20">
                        Revisar Interações
                    </Badge>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20">
                        Resumir Prontuário
                    </Badge>
                </div>
            </header>

            {/* Chat Container */}
            <Card className="flex-1 flex flex-col bg-black/40 border-white/10 overflow-hidden shadow-2xl relative">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:32px_32px] pointer-events-none" />

                {/* Messages */}
                <ScrollArea className="flex-1 p-6 relative">
                    <div className="space-y-6 max-w-4xl mx-auto pb-6">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {/* Avatar */}
                                <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center shadow-lg ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-blue-600 to-cyan-600'
                                        : 'bg-gradient-to-br from-indigo-600 to-purple-600'
                                    }`}>
                                    {msg.role === 'user' ? <Stethoscope className="h-5 w-5 text-white" /> : <Sparkles className="h-5 w-5 text-white" />}
                                </div>

                                {/* Bubble */}
                                <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                                    <div className={`p-4 rounded-2xl ${msg.role === 'user'
                                            ? 'bg-blue-600/20 border border-blue-500/30 text-blue-50'
                                            : 'bg-white/5 border border-white/10 text-slate-200'
                                        }`}>
                                        <p className="whitespace-pre-wrap leading-relaxed text-sm">
                                            {msg.content}
                                        </p>
                                    </div>

                                    {/* Render Custom AI Cards based on Type */}
                                    {msg.role === 'ai' && msg.type === 'differential' && msg.data && (
                                        <div className="grid grid-cols-1 gap-3 w-full mt-2">
                                            {msg.data.map((diff: any, i: number) => (
                                                <Card key={i} className="p-4 bg-black/40 border-indigo-500/30">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="font-semibold text-indigo-300 flex items-center gap-2">
                                                            <Microscope className="h-4 w-4" /> {diff.condicao}
                                                        </h4>
                                                        <Badge variant="outline" className={
                                                            diff.prob === 'Alta' ? 'bg-red-500/20 text-red-400' :
                                                                diff.prob === 'Moderada' ? 'bg-amber-500/20 text-amber-400' :
                                                                    'bg-emerald-500/20 text-emerald-400'
                                                        }>
                                                            Probabilidade: {diff.prob}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{diff.descricao}</p>
                                                </Card>
                                            ))}
                                        </div>
                                    )}

                                    {msg.role === 'ai' && msg.type === 'interaction' && msg.data && (
                                        <div className="grid grid-cols-1 gap-3 w-full mt-2">
                                            {msg.data.map((int: any, i: number) => (
                                                <Card key={i} className="p-4 bg-rose-950/20 border-rose-500/30">
                                                    <div className="flex gap-3">
                                                        <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                                                        <div>
                                                            <h4 className="font-medium text-rose-300 text-sm flex items-center gap-2">
                                                                <Pill className="h-3 w-3" /> {int.drogaA} <span className="text-muted-foreground">x</span> {int.drogaB}
                                                            </h4>
                                                            <p className="text-xs text-rose-200/70 mt-1">{int.risco}</p>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}

                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex gap-4 flex-row">
                                <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                                    <Bot className="h-5 w-5 text-white animate-pulse" />
                                </div>
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-center">
                                    <div className="flex gap-1.5 items-center">
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span className="text-xs text-muted-foreground mt-2">Correlacionando bases bibliográficas...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 bg-black/60 border-t border-white/10 backdrop-blur-md shrink-0">
                    <div className="max-w-4xl mx-auto relative flex items-end gap-3">
                        <div className="flex-1 relative">
                            <Textarea
                                placeholder="Descreva o caso clínico, liste sintomas ou pergunte sobre interações medicamentosas..."
                                className="min-h-[60px] max-h-[200px] resize-none pr-12 bg-white/5 border-white/10 focus-visible:ring-indigo-500 text-sm"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <div className="absolute right-3 bottom-3 flex gap-2">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-indigo-400">
                                    <FileText className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <Button
                            onClick={handleSend}
                            disabled={!input.trim() || isTyping}
                            className="h-[60px] w-[60px] shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25"
                        >
                            {isTyping ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default DecifradorCasosPage;
