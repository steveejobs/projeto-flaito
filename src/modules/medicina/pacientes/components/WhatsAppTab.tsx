import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Send, MessageSquare, User, Clock, CheckCheck, AlertCircle,
    Loader2, RefreshCw, Variable, Paperclip, X, Info
} from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useOfficeSession } from "@/hooks/useOfficeSession";
import { renderTemplate, TemplateVariables } from "@/utils/templateEngine";

interface MessageTemplate {
    id: string;
    name: string;
    content: string;
    category_id: string;
}

interface MessageLog {
    id: string;
    content: string;
    direction: 'inbound' | 'outbound';
    status: string;
    created_at: string;
    classification?: string;
}

interface WhatsAppTabProps {
    clientId: string;
    patientPhone: string;
    patientName: string;
    resourceType?: 'CONSULTA' | 'CASE' | 'CLIENTE';
    resourceId?: string;
    contextType?: 'MEDICAL' | 'LEGAL';
}

export const WhatsAppTab: React.FC<WhatsAppTabProps> = ({ 
    clientId, 
    patientPhone, 
    patientName,
    resourceType = 'CLIENTE',
    resourceId,
    contextType = 'MEDICAL'
}) => {
    const { user } = useAuth();
    const { officeId } = useOfficeSession(user?.id);
    const [messages, setMessages] = useState<MessageLog[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [quickReplies, setQuickReplies] = useState<MessageTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [providerType, setProviderType] = useState('NON_OFFICIAL_PROVIDER');
    
    // Attachments
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchProviderConfig = async () => {
        if (!officeId) return;
        const { data } = await (supabase
            .from('notificacao_config' as any) as any)
            .select('provider_type, context_type')
            .eq('office_id', officeId);
            
        if (data && data.length > 0) {
           const specific = data.find(c => c.context_type === contextType);
           setProviderType((specific || data[0]).provider_type || 'NON_OFFICIAL_PROVIDER');
        }
    };

    const fetchTemplates = async () => {
        if (!officeId) return;
        setIsTemplatesLoading(true);
        try {
            const { data } = await (supabase
                .from('message_templates' as any)
                .select('*')
                .eq('office_id', officeId)
                .eq('is_active', true)
                .order('name') as any);
            
            const allTemplates = (data as any) || [];
            setQuickReplies(allTemplates.filter(t => t.category_id === 'QUICK'));
            setTemplates(allTemplates.filter(t => t.category_id !== 'QUICK'));
        } finally {
            setIsTemplatesLoading(false);
        }
    };

    const fetchHistory = async () => {
        if (!clientId) return;
        try {
            const { data, error } = await (supabase
                .from('message_logs' as any)
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: true }) as any);

            if (error) throw error;
            setMessages(data || []);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        fetchTemplates();
        fetchProviderConfig();

        const channel = supabase
            .channel(`public:message_logs:client_id=eq.${clientId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_logs', filter: `client_id=eq.${clientId}` }, 
                (payload) => {
                    const newMsg = payload.new as MessageLog;
                    setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
                }
            )
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_logs', filter: `client_id=eq.${clientId}` }, 
                (payload) => {
                    const updatedMsg = payload.new as MessageLog;
                    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [clientId, officeId]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');
    const hoursSinceLastInbound = lastInbound 
        ? (Date.now() - new Date(lastInbound.created_at).getTime()) / (1000 * 60 * 60) 
        : Infinity;
    
    const isOutside24hWindow = providerType === 'META_OFFICIAL_PROVIDER' && hoursSinceLastInbound > 24;
    const canSendFreeText = !isOutside24hWindow;

    const handleApplyTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;
        setSelectedTemplate(templateId);
        const variables: TemplateVariables = { client_name: patientName, client_phone: patientPhone, office_name: 'Flaito' };
        const rendered = renderTemplate(template.content, variables);
        setNewMessage(rendered);
        toast.info(`Template "${template.name}" aplicado.`);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !officeId) return;
        
        setIsUploading(true);
        setAttachment(file);
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${officeId}/${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
            if (uploadError) throw uploadError;
            
            const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
            setAttachmentUrl(data.publicUrl);
            toast.success("Arquivo anexado com sucesso!");
        } catch (error: any) {
            toast.error("Erro ao fazer upload: " + error.message);
            setAttachment(null);
            setAttachmentUrl(null);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveAttachment = () => {
        setAttachment(null);
        setAttachmentUrl(null);
    };

    const handleResend = async (msg: MessageLog) => {
        if (!officeId || !patientPhone) return;
        toast.loading("Tentando reenviar...", { id: 'resend' });
        try {
            await (supabase.from('message_logs' as any) as any).update({ status: 'pending' }).eq('id', msg.id);
            const { error: queueError } = await (supabase.from('notificacoes_fila' as any) as any).insert({
                office_id: officeId,
                context_type: contextType,
                resource_type: resourceType,
                resource_id: resourceId || clientId,
                destinatario_nome: patientName,
                destinatario: patientPhone,
                mensagem: msg.content,
                status: 'PENDING',
                tipo_envio: 'WHATSAPP',
                scheduled_at: new Date().toISOString(),
                payload_envio: { message_log_id: msg.id, correlation_id: `resend-${msg.id}` }
            });
            if (queueError) throw queueError;
            toast.success("Reenvio agendado!", { id: 'resend' });
        } catch (error: any) {
            toast.error("Erro ao reenviar: " + error.message, { id: 'resend' });
        }
    };

    const handleSendMessage = async () => {
        if (!user || !patientPhone || !officeId || isSending) return;
        if (!newMessage.trim() && !attachmentUrl) return;

        // Block free text outside 24h Meta
        if (isOutside24hWindow && !selectedTemplate) {
            toast.error("Fora da janela de 24h do Meta Oficial. É necessário selecionar um Template aprovado.");
            return;
        }

        setIsSending(true);
        try {
            const { data: pendingLog, error: logError } = await (supabase.from('message_logs' as any) as any)
                .insert({
                    office_id: officeId,
                    client_id: clientId,
                    provider: providerType === 'META_OFFICIAL_PROVIDER' ? 'whatsapp_meta' : 'whatsapp_zapi',
                    direction: 'outbound',
                    channel: 'whatsapp',
                    content: newMessage || (attachment ? `Arquivo: ${attachment.name}` : ''),
                    status: 'pending'
                }).select().single();

            if (logError) throw logError;
            setMessages(prev => [...prev, pendingLog as MessageLog]);

            const payloadEnvio: any = { message_log_id: pendingLog.id };
            if (attachmentUrl) payloadEnvio.static_attachments = [attachmentUrl];
            // If Meta + Template, we must pass variables list (extract from text or form, simplified for MVP)
            if (providerType === 'META_OFFICIAL_PROVIDER' && selectedTemplate) {
                payloadEnvio.template_vars = [patientName, 'Flaito']; 
            }

            const { error: queueError } = await (supabase.from('notificacoes_fila' as any) as any)
                .insert({
                    office_id: officeId,
                    context_type: contextType,
                    resource_type: resourceType,
                    resource_id: resourceId || clientId,
                    destinatario_nome: patientName,
                    destinatario: patientPhone,
                    mensagem: newMessage,
                    status: 'PENDING',
                    tipo_envio: 'WHATSAPP',
                    template_id: selectedTemplate || null,
                    payload_envio: payloadEnvio
                });

            if (queueError) throw queueError;
            
            setNewMessage('');
            setSelectedTemplate('');
            setAttachment(null);
            setAttachmentUrl(null);
        } catch (error: any) {
            toast.error(error.message || "Erro ao processar envio.");
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                <p className="text-muted-foreground animate-pulse font-medium">Carregando conversa...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[600px] border border-white/10 rounded-2xl bg-[#09090b]/40 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in duration-500">
            <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                        <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground leading-tight">{patientName}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{patientPhone}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className={`bg-white/5 border-white/10 text-[10px] font-bold uppercase tracking-wider h-6`}>
                        {providerType === 'META_OFFICIAL_PROVIDER' ? 'Meta API' : 'Z-API'}
                    </Badge>
                </div>
            </div>

            <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 opacity-40">
                            <MessageSquare className="h-12 w-12 text-muted-foreground shrink-0" />
                            <div><p className="font-medium text-lg">Inicie uma conversa</p></div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={msg.id} className={`flex w-full ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-500 fill-mode-both`} style={{ animationDelay: `${idx * 50}ms` }}>
                                <div className={`flex gap-3 max-w-[85%] ${msg.direction === 'outbound' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`h-8 w-8 rounded-xl shrink-0 flex items-center justify-center border shadow-lg ${msg.direction === 'outbound' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                        {msg.direction === 'outbound' ? <User className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                                    </div>
                                    <div className={`space-y-1.5 ${msg.direction === 'outbound' ? 'items-end' : 'items-start'} flex flex-col group`}>
                                        <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-xl backdrop-blur-sm relative ${msg.direction === 'outbound' ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none border border-blue-400/20 font-medium' : 'bg-white/[0.04] text-foreground border border-white/10 rounded-tl-none'}`}>
                                            {msg.content}
                                            {msg.status === 'failed' && msg.direction === 'outbound' && (
                                                <button onClick={() => handleResend(msg)} className="absolute -left-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-red-500/10 border border-red-500/20 flex flex-col items-center justify-center text-red-400 hover:bg-red-500/20 transition-all" title="Reenviar mensagem">
                                                    <RefreshCw className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 px-1">
                                            <span className="text-[10px] text-muted-foreground/50 font-bold tracking-tight uppercase">
                                                {format(new Date(msg.created_at), 'HH:mm • d MMM', { locale: ptBR })}
                                            </span>
                                            {msg.direction === 'outbound' && (
                                                <div className="flex items-center">
                                                    {['pending', 'processing'].includes(msg.status) ? <Clock className="h-3 w-3 text-yellow-500/60 animate-pulse" /> : 
                                                     msg.status === 'failed' ? <AlertCircle className="h-3 w-3 text-red-500" /> : 
                                                     <CheckCheck className={`h-3 w-3 ${msg.status === 'read' ? 'text-blue-400 opacity-100 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'text-muted-foreground/50'}`} />}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {isOutside24hWindow && (
                <div className="px-4 py-2 bg-yellow-500/10 border-t border-yellow-500/20 flex items-center gap-2 text-yellow-500 text-[11px] font-medium">
                    <Info className="h-4 w-4" />
                    Janela de 24h expirada. Somente mensagens com Templates aprovados podem ser enviadas (Regras do Meta Oficial).
                </div>
            )}

            {/* Quick Replies */}
            {quickReplies.length > 0 && (
                <div className="px-4 py-2 flex items-center gap-2 border-t border-white/5 bg-white/[0.02] overflow-x-auto no-scrollbar">
                    <div className="flex gap-1.5 w-max">
                        {quickReplies.map(qr => (
                            <Button key={qr.id} variant="ghost" size="sm" className="h-6 px-2 text-[9px] rounded-md border border-white/10 bg-white/5 hover:bg-blue-500/10 hover:text-blue-400 gap-1 shrink-0 font-medium uppercase tracking-tighter"
                                onClick={() => { setNewMessage(prev => prev ? `${prev} ${qr.content}` : qr.content); toast.info("Frase adicionada"); }}
                            >
                                <MessageSquare className="h-3 w-3" />
                                {qr.name}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Template Selector */}
            <div className="px-4 py-3 flex items-center gap-3 border-t border-white/5 bg-white/[0.01]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">Templates:</span>
                <ScrollArea className="flex-1 w-full">
                    <div className="flex gap-2 pb-1">
                        {isTemplatesLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : 
                         templates.length === 0 ? <span className="text-[10px] text-muted-foreground italic">Nenhum cadastrado.</span> : 
                         templates.map(tmp => (
                            <Button key={tmp.id} variant="ghost" size="sm" className={`h-7 text-[10px] rounded-full border border-white/5 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 gap-1 shrink-0 ${selectedTemplate === tmp.id ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : ''}`}
                                onClick={() => handleApplyTemplate(tmp.id)}
                            >
                                {tmp.name}
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
                {selectedTemplate && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-red-400" onClick={() => setSelectedTemplate('')}>
                        <X className="h-3 w-3" />
                    </Button>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/[0.02] border-t border-white/5 space-y-3">
                {attachment && (
                     <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 p-2 rounded-lg mb-2">
                        <div className="flex items-center gap-2 text-blue-400 text-xs font-medium">
                            <Paperclip className="h-4 w-4" />
                            {attachment.name}
                            {isUploading && <Loader2 className="h-3 w-3 animate-spin ml-2" />}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300" onClick={handleRemoveAttachment}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                <div className="relative group flex gap-2">
                    <div className="flex-1 relative">
                        <Textarea
                            placeholder={isOutside24hWindow && !selectedTemplate ? "Selecione um template..." : "Escreva sua mensagem..."}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={isOutside24hWindow && !selectedTemplate}
                            className="min-h-[100px] bg-white/5 border-white/10 focus:border-blue-500/50 transition-all duration-300 resize-none rounded-xl pr-12 pb-10"
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        />
                        <div className="absolute bottom-3 left-3 flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] bg-white/5 text-muted-foreground border-none flex items-center gap-1">
                                <Variable className="h-3 w-3" /> Variáveis suportadas
                            </Badge>
                        </div>
                        
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                        <Button 
                            variant="ghost" size="icon" 
                            className="absolute bottom-3 right-12 h-8 w-8 text-muted-foreground hover:text-white bg-white/5"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            <Paperclip className="h-4 w-4" />
                        </Button>

                        <Button 
                            size="icon"
                            disabled={isSending || isUploading || (!newMessage.trim() && !attachmentUrl) || (isOutside24hWindow && !selectedTemplate)}
                            onClick={handleSendMessage}
                            className={`absolute bottom-2 right-2 h-10 w-10 transition-all duration-500 rounded-lg ${
                                (newMessage.trim() || attachmentUrl) && (!isOutside24hWindow || selectedTemplate)
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20' 
                                    : 'bg-white/5 text-muted-foreground border border-white/10'
                            }`}
                        >
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
