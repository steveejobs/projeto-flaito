import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WhatsAppTab } from "@/modules/medicina/pacientes/components/WhatsAppTab";
import { 
    Search, 
    MessageSquare, 
    User, 
    Clock, 
    CheckCheck, 
    AlertCircle,
    Loader2,
    Filter,
    ChevronRight,
    MessageCircle,
    UserPlus,
    X,
    RefreshCw
} from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useOfficeSession } from "@/hooks/useOfficeSession";
import { toast } from 'sonner';
import { useMessaging } from '@/contexts/MessagingContext';

interface ChatSummary {
    client_id: string;
    client_name: string;
    client_phone: string;
    last_message: string;
    last_date: string;
    direction: 'inbound' | 'outbound';
    status: string;
}

const WhatsAppInbox = () => {
    const { user } = useAuth();
    const { officeId } = useOfficeSession(user?.id);
    const { context } = useMessaging();
    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
    const [isSearchingClients, setIsSearchingClients] = useState(false);
    const [limit, setLimit] = useState(50);
    const [hasMore, setHasMore] = useState(true);

    const handleSearchClients = async (q: string) => {
        if (q.length < 2) {
            setClientSearchResults([]);
            return;
        }
        setIsSearchingClients(true);
        
        if (context === 'MEDICAL') {
            const { data } = await ((supabase
                .from('pacientes' as any) as any)
                .select('id, nome, telefone')
                .or(`nome.ilike.%${q}%,telefone.ilike.%${q}%`)
                .limit(5) as any);
            
            setClientSearchResults((data || []).map((p: any) => ({
                id: p.id,
                name: p.nome,
                phone: p.telefone
            })));
        } else {
            const { data } = await ((supabase
                .from('clients' as any) as any)
                .select('id, full_name, phone')
                .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
                .limit(5) as any);
            
            setClientSearchResults((data || []).map((p: any) => ({
                id: p.id,
                name: p.full_name,
                phone: p.phone
            })));
        }
        
        setIsSearchingClients(false);
    };

    const fetchChats = async (currentLimit = limit) => {
        if (!officeId) return;

        try {
            const { data, error } = await ((supabase
                .from('message_logs' as any) as any)
                .select(`
                    client_id,
                    content,
                    direction,
                    status,
                    created_at,
                    paciente:pacientes(id, nome, telefone),
                    client:clients(id, full_name, phone)
                `)
                .eq('office_id', officeId)
                .eq('origin_context', context)
                .order('created_at', { ascending: false })
                .limit(currentLimit) as any);

            if (error) throw error;

            const grouped: Record<string, ChatSummary> = {};
            data?.forEach(msg => {
                const clientId = msg.client_id;
                if (!grouped[clientId]) {
                    const paciente = msg.paciente as any;
                    const client = msg.client as any;
                    
                    grouped[clientId] = {
                        client_id: clientId,
                        client_name: context === 'MEDICAL' 
                            ? (paciente?.nome || 'Paciente sem Nome')
                            : (client?.full_name || 'Cliente sem Nome'),
                        client_phone: context === 'MEDICAL'
                            ? (paciente?.telefone || 'Sem telefone')
                            : (client?.phone || 'Sem telefone'),
                        last_message: msg.content,
                        last_date: msg.created_at,
                        direction: msg.direction as 'inbound' | 'outbound',
                        status: msg.status
                    };
                }
            });

            const chatList = Object.values(grouped);
            setChats(chatList);
            setHasMore(data.length === currentLimit);
        } catch (error) {
            console.error('Erro ao carregar conversas:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!officeId) return;
        fetchChats();

        const channel = supabase
            .channel('public:message_logs:inbox')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'message_logs',
                filter: `office_id=eq.${officeId}`
            }, () => fetchChats())
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public', 
                table: 'message_logs',
                filter: `office_id=eq.${officeId}`
            }, () => fetchChats())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [officeId]);

    const filteredChats = chats.filter(chat => {
        const matchesSearch = chat.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             chat.client_phone.includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || chat.direction === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="flex bg-[#09090b] h-[calc(100vh-120px)] md:rounded-3xl overflow-hidden border border-white/5 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
            {/* Sidebar / Chat List */}
            <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] border-r border-white/5 bg-white/[0.02] flex-col`}>
                <div className="p-6 space-y-4 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                             <MessageCircle className="h-5 w-5 text-emerald-500" />
                             WhatsApp
                        </h2>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 uppercase text-[10px] tracking-widest font-bold">
                            Live
                        </Badge>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                                <Input 
                                    placeholder="Buscar pacientes..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-white/5 border-white/10 focus:border-emerald-500/50 transition-all rounded-xl h-10"
                                />
                            </div>
                            <Button
                                size="icon"
                                variant="outline"
                                className="rounded-xl border-white/10 hover:border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/5 shadow-lg shadow-emerald-500/5 transition-all active:scale-95"
                                onClick={() => setIsSearchModalOpen(true)}
                            >
                                <UserPlus className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/5">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setStatusFilter('all')}
                                className={`flex-1 text-[10px] uppercase font-bold rounded-md h-7 ${statusFilter === 'all' ? 'bg-emerald-500/10 text-emerald-500' : 'text-muted-foreground hover:bg-white/5'}`}
                            >
                                Geral
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setStatusFilter('inbound')}
                                className={`flex-1 text-[10px] uppercase font-bold rounded-md h-7 ${statusFilter === 'inbound' ? 'bg-blue-500/10 text-blue-500' : 'text-muted-foreground hover:bg-white/5'}`}
                            >
                                Recebidas
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setStatusFilter('outbound')}
                                className={`flex-1 text-[10px] uppercase font-bold rounded-md h-7 ${statusFilter === 'outbound' ? 'bg-purple-500/10 text-purple-500' : 'text-muted-foreground hover:bg-white/5'}`}
                            >
                                Enviadas
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {isLoading ? (
                        <div className="space-y-3 p-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse">
                                    <div className="h-12 w-12 rounded-2xl bg-white/5" />
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-2 bg-white/10 rounded w-1/4" />
                                        <div className="h-2 bg-white/5 rounded w-3/4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="p-12 text-center space-y-4">
                            <div className="h-20 w-20 bg-emerald-500/5 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-500/10 shadow-lg shadow-emerald-500/5">
                                <Search className="h-8 w-8 text-emerald-500/40" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white tracking-tight">Nenhuma conversa encontrada</p>
                                <p className="text-xs text-muted-foreground mt-1">Busque um cliente para iniciar uma interação</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.03]">
                            {filteredChats.map((chat) => (
                                <button
                                    key={chat.client_id}
                                    onClick={() => setSelectedChat(chat)}
                                    className={`w-full p-4 flex gap-4 transition-all border-b border-white/5 hover:bg-white/[0.04] text-left relative group ${
                                        selectedChat?.client_id === chat.client_id ? 'bg-emerald-500/5' : ''
                                    }`}
                                >
                                    <div className="relative">
                                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg transition-transform group-hover:scale-105 ${
                                            selectedChat?.client_id === chat.client_id 
                                                ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                                                : 'bg-white/5 text-muted-foreground border border-white/10'
                                        }`}>
                                            {chat.client_name.charAt(0)}
                                        </div>
                                        {chat.direction === 'inbound' && (
                                            <span className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 border-2 border-[#09090b] rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-sm text-white truncate max-w-[140px]">{chat.client_name}</h3>
                                            <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                                                {format(new Date(chat.last_date), 'HH:mm', { locale: ptBR })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate leading-relaxed flex items-center gap-1.5">
                                            {chat.direction === 'outbound' && (
                                                <span className="shrink-0 scale-75">
                                                    {chat.status === 'failed' ? (
                                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                                    ) : (
                                                        <CheckCheck className={`h-4 w-4 ${chat.status === 'read' ? 'text-blue-400' : 'text-muted-foreground/40'}`} />
                                                    )}
                                                </span>
                                            )}
                                            {chat.last_message}
                                        </p>
                                    </div>
                                    <ChevronRight className={`h-4 w-4 self-center transition-transform ${selectedChat?.client_id === chat.client_id ? 'translate-x-1 opacity-100' : 'opacity-0'}`} />
                                </button>
                            ))}
                            
                            {hasMore && (
                                <div className="p-4">
                                    <Button 
                                        variant="outline" 
                                        className="w-full border-white/5 bg-white/[0.02] text-xs font-bold uppercase tracking-widest hover:bg-white/[0.05] h-10 rounded-xl"
                                        onClick={() => {
                                            const newLimit = limit + 50;
                                            setLimit(newLimit);
                                            fetchChats(newLimit);
                                        }}
                                    >
                                        <RefreshCw className="h-3 w-3 mr-2" />
                                        Carregar Mais
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Detail Content */}
            <div className={`${selectedChat ? 'flex' : 'hidden md:flex'} flex-1 bg-black/20 flex-col relative overflow-hidden`}>
                {selectedChat ? (
                    <div className="h-full animate-in slide-in-from-right-4 duration-500 overflow-hidden flex flex-col">
                        <div className="p-3 border-b border-white/5 bg-white/5 md:hidden flex items-center gap-3">
                           <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)} className="shrink-0">
                               <ChevronRight className="h-5 w-5 rotate-180" />
                           </Button>
                           <div className="flex items-center gap-3 truncate">
                               <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center text-xs font-bold shrink-0">
                                   {selectedChat.client_name.charAt(0)}
                               </div>
                               <span className="font-bold text-sm truncate text-white">{selectedChat.client_name}</span>
                           </div>
                        </div>
                        <WhatsAppTab 
                            clientId={selectedChat.client_id}
                            patientName={selectedChat.client_name}
                            patientPhone={selectedChat.client_phone}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                        <div className="relative h-24 w-24">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl animate-pulse rounded-full" />
                            <div className="relative h-24 w-24 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                                <MessageSquare className="h-10 w-10 text-emerald-500 opacity-40" />
                            </div>
                        </div>
                        <div className="max-w-md space-y-2">
                             <h3 className="text-2xl font-bold text-white tracking-tight">Sua Inbox de Atendimento</h3>
                             <p className="text-muted-foreground leading-relaxed">
                                 Selecione uma conversa à esquerda para visualizar o histórico e responder seus pacientes.
                             </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-8 opacity-40">
                            <div className="p-4 rounded-2xl border border-white/5 bg-white/5 text-left">
                                <Clock className="h-4 w-4 mb-2 text-blue-400" />
                                <p className="text-[10px] font-bold uppercase tracking-wider">Histórico</p>
                                <p className="text-[10px]">Toda conversa salva</p>
                            </div>
                            <div className="p-4 rounded-2xl border border-white/5 bg-white/5 text-left">
                                <Filter className="h-4 w-4 mb-2 text-emerald-400" />
                                <p className="text-[10px] font-bold uppercase tracking-wider">Status</p>
                                <p className="text-[10px]">Acompanhe entregas</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Busca de Clientes (Novo Chat) */}
            {isSearchModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#111114] border border-white/10 w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                        <div className="p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                        <UserPlus className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    Novo Atendimento
                                </h3>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setIsSearchModalOpen(false)}
                                    className="rounded-full hover:bg-white/5"
                                >
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </Button>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input 
                                    placeholder="Nome ou telefone do paciente..."
                                    className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl focus:border-emerald-500/50 text-base"
                                    autoFocus
                                    onChange={(e) => handleSearchClients(e.target.value)}
                                />
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                {isSearchingClients ? (
                                    <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                                        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                                        <span className="text-xs uppercase font-bold tracking-widest">Buscando na base...</span>
                                    </div>
                                ) : clientSearchResults.length > 0 ? (
                                    clientSearchResults.map(client => (
                                        <button
                                            key={client.id}
                                            onClick={() => {
                                                setSelectedChat({
                                                    client_id: client.id,
                                                    client_name: client.name,
                                                    client_phone: client.phone || '',
                                                    last_message: 'Iniciar conversa WhatsApp',
                                                    last_date: new Date().toISOString(),
                                                    direction: 'outbound',
                                                    status: 'sent'
                                                });
                                                setIsSearchModalOpen(false);
                                            }}
                                            className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-emerald-500/5 hover:border-emerald-500/20 transition-all text-left flex items-center justify-between group"
                                        >
                                            <div>
                                                <p className="font-bold text-white group-hover:text-emerald-400 transition-colors">{client.name}</p>
                                                <p className="text-xs text-muted-foreground">{client.phone || 'Sem telefone'}</p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-12 text-center text-muted-foreground opacity-40">
                                        <p className="text-sm">Digite acima para buscar pacientes...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppInbox;
