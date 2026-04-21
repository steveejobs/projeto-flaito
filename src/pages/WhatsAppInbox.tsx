import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WhatsAppTab } from "@/modules/medicina/pacientes/components/WhatsAppTab";
import { 
    Search, 
    MessageSquare, 
    User, 
    Clock, 
    CheckCheck, 
    Loader2,
    Filter,
    ChevronRight,
    MessageCircle,
    UserPlus,
    X
} from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

    const isMedical = context === 'MEDICAL';

    const handleSearchClients = async (q: string) => {
        if (q.length < 2 || !officeId) {
            setClientSearchResults([]);
            return;
        }
        setIsSearchingClients(true);
        
        try {
            if (isMedical) {
                const { data } = await supabase
                    .from('pacientes' as any)
                    .select('id, nome, telefone')
                    .or(`nome.ilike.%${q}%,telefone.ilike.%${q}%`)
                    .eq('office_id', officeId)
                    .limit(5);
                
                setClientSearchResults((data || []).map((p: any) => ({
                    id: p.id,
                    name: p.nome,
                    phone: p.telefone
                })));
            } else {
                const { data } = await supabase
                    .from('clients')
                    .select('id, full_name, phone')
                    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
                    .eq('office_id', officeId)
                    .limit(5);
                
                setClientSearchResults((data || []).map((p: any) => ({
                    id: p.id,
                    name: p.full_name,
                    phone: p.phone
                })));
            }
        } catch (err) {
            console.error("Erro na busca:", err);
        } finally {
            setIsSearchingClients(false);
        }
    };

    const fetchChats = async (currentLimit = limit) => {
        if (!officeId) return;

        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('message_logs' as any)
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
                .limit(currentLimit);

            if (error) throw error;

            const grouped: Record<string, ChatSummary> = {};
            data?.forEach(msg => {
                const clientId = msg.client_id;
                if (!grouped[clientId]) {
                    const paciente = msg.paciente as any;
                    const client = msg.client as any;
                    
                    grouped[clientId] = {
                        client_id: clientId,
                        client_name: isMedical 
                            ? (paciente?.nome || 'Paciente sem Nome')
                            : (client?.full_name || 'Cliente sem Nome'),
                        client_phone: isMedical
                            ? (paciente?.telefone || 'Sem telefone')
                            : (client?.phone || 'Sem telefone'),
                        last_message: msg.content,
                        last_date: msg.created_at,
                        direction: msg.direction as 'inbound' | 'outbound',
                        status: msg.status
                    };
                }
            });

            setChats(Object.values(grouped));
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
            .channel(`message_logs:${officeId}:${context}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'message_logs',
                filter: `office_id=eq.${officeId}`
            }, () => fetchChats())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [officeId, context]);

    const filteredChats = chats.filter(chat => {
        const matchesSearch = chat.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             chat.client_phone.includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || chat.direction === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="flex bg-[#09090b] h-[calc(100dvh-120px)] md:rounded-3xl overflow-hidden border border-white/5 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
            {/* Sidebar / Chat List */}
            <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] border-r border-white/5 bg-white/[0.02] flex-col`}>
                <div className="p-6 space-y-4 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                             <MessageCircle className="h-5 w-5 text-emerald-500" />
                             {isMedical ? 'Atendimento Clínico' : 'Central de Mensagens'}
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
                                    placeholder={isMedical ? "Buscar pacientes..." : "Buscar clientes..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-11 bg-white/[0.03] border-white/10 focus-visible:ring-emerald-500 rounded-xl"
                                />
                            </div>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-11 w-11 shrink-0 rounded-xl border-white/10 bg-white/[0.03] hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/50 transition-all"
                                onClick={() => setIsSearchModalOpen(true)}
                            >
                                <UserPlus className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="flex gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
                            <button 
                                onClick={() => setStatusFilter('all')}
                                className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white/10 text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                            >
                                Todos
                            </button>
                            <button 
                                onClick={() => setStatusFilter('inbound')}
                                className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${statusFilter === 'inbound' ? 'bg-emerald-500/20 text-emerald-400 shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                            >
                                Recebidos
                            </button>
                            <button 
                                onClick={() => setStatusFilter('outbound')}
                                className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${statusFilter === 'outbound' ? 'bg-blue-500/20 text-blue-400 shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                            >
                                Enviados
                            </button>
                        </div>
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    {isLoading ? (
                        <div className="p-12 flex flex-col items-center gap-4 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                            <p className="text-sm font-medium animate-pulse">Carregando conversas...</p>
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="p-12 text-center space-y-4">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                                <MessageSquare className="h-8 w-8 text-white/20" />
                            </div>
                            <p className="text-muted-foreground text-sm font-medium">Nenhuma conversa ativa no momento.</p>
                            <Button variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold uppercase tracking-widest gap-2" onClick={() => setIsSearchModalOpen(true)}>
                                <UserPlus className="h-4 w-4" /> Iniciar conversa
                            </Button>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {filteredChats.map((chat) => (
                                <button
                                    key={chat.client_id}
                                    onClick={() => setSelectedChat(chat)}
                                    className={`w-full p-6 flex gap-4 hover:bg-white/[0.04] transition-all group relative ${
                                        selectedChat?.client_id === chat.client_id ? 'bg-emerald-500/5' : ''
                                    }`}
                                >
                                    {selectedChat?.client_id === chat.client_id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                                    )}
                                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center text-white/50 border border-white/10 group-hover:scale-105 transition-transform shadow-lg">
                                        <User className="h-7 w-7" />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                                                {chat.client_name}
                                            </span>
                                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">
                                                {chat.last_date ? format(new Date(chat.last_date), 'HH:mm', { locale: ptBR }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground/80 line-clamp-1 group-hover:text-white/70 transition-colors">
                                            {chat.last_message}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            {chat.direction === 'outbound' ? (
                                                <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20 py-0 px-2 rounded-full font-black uppercase tracking-tighter">
                                                    Você enviou
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 py-0 px-2 rounded-full font-black uppercase tracking-tighter">
                                                    Recebida
                                                </Badge>
                                            )}
                                            {chat.status === 'read' && <CheckCheck className="h-3 w-3 text-blue-400" />}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Chat Content */}
            <div className={`flex-1 flex flex-col bg-[#0c0c0e] ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {selectedChat ? (
                    <div className="flex flex-col h-full">
                        <header className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="md:hidden h-10 w-10 text-white hover:bg-white/10 rounded-xl"
                                    onClick={() => setSelectedChat(null)}
                                >
                                    <X className="h-6 w-6" />
                                </Button>
                                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-inner">
                                    <User className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-white text-lg leading-tight tracking-tight">
                                        {selectedChat.client_name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        {selectedChat.client_phone}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" size="sm" className="hidden sm:flex rounded-xl border-white/10 bg-white/5 text-xs font-bold uppercase tracking-widest gap-2 hover:bg-white/10 transition-all">
                                    <Clock className="h-4 w-4" /> Histórico
                                </Button>
                                <Button variant="outline" size="sm" className="hidden sm:flex rounded-xl border-white/10 bg-white/5 text-xs font-bold uppercase tracking-widest gap-2 hover:bg-white/10 transition-all">
                                    <Filter className="h-4 w-4" /> Filtrar
                                </Button>
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/10 rounded-xl" onClick={() => setSelectedChat(null)}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-hidden relative">
                             <WhatsAppTab 
                                patientId={selectedChat.client_id}
                                patientPhone={selectedChat.client_phone}
                             />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6 animate-in fade-in duration-1000">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full" />
                            <div className="relative w-32 h-32 bg-white/[0.03] rounded-full flex items-center justify-center border border-white/5 shadow-2xl">
                                <MessageSquare className="h-16 w-16 text-white/10" />
                            </div>
                        </div>
                        <div className="space-y-2 relative">
                            <h3 className="text-2xl font-bold text-white tracking-tight">Suas conversas aparecem aqui</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
                                {isMedical 
                                    ? "Selecione um paciente na lista lateral para visualizar e gerenciar o atendimento via WhatsApp."
                                    : "Selecione um cliente na lista lateral para gerenciar as comunicações e o fluxo processual."}
                            </p>
                        </div>
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-[0.2em] px-8 h-14 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                            onClick={() => setIsSearchModalOpen(true)}
                        >
                            Nova Conversa
                        </Button>
                    </div>
                )}
            </div>

            {/* Modal de Busca de Clientes (Novo Chat) */}
            <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
                <DialogContent className="bg-[#121214] border-white/10 sm:max-w-md p-0 overflow-hidden rounded-3xl text-white">
                    <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
                                <UserPlus className="h-5 w-5 text-emerald-500" />
                                {isMedical ? "Nova Conversa com Paciente" : "Novo Atendimento Jurídico"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="mt-6 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                            <Input
                                placeholder={isMedical ? "Nome ou telefone do paciente..." : "Nome ou telefone do cliente..."}
                                className="pl-11 h-14 bg-white/[0.03] border-white/10 focus-visible:ring-emerald-500 rounded-2xl text-lg text-white"
                                onChange={(e) => handleSearchClients(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto p-4 space-y-2">
                        {isSearchingClients ? (
                            <div className="flex flex-col items-center justify-center p-12 gap-3">
                                <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Buscando na base...</span>
                            </div>
                        ) : clientSearchResults.length > 0 ? (
                            clientSearchResults.map((client) => (
                                <button
                                    key={client.id}
                                    className="w-full p-4 flex items-center gap-4 hover:bg-emerald-500/10 rounded-2xl transition-all border border-transparent hover:border-emerald-500/20 group"
                                    onClick={() => {
                                        setSelectedChat({
                                            client_id: client.id,
                                            client_name: client.name,
                                            client_phone: client.phone,
                                            last_message: 'Iniciando nova conversa...',
                                            last_date: new Date().toISOString(),
                                            direction: 'outbound',
                                            status: 'sent'
                                        });
                                        setIsSearchModalOpen(false);
                                    }}
                                >
                                    <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-all shadow-inner">
                                        <User className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-bold text-white group-hover:text-emerald-400 transition-all">{client.name}</p>
                                        <p className="text-xs text-muted-foreground">{client.phone}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:translate-x-1 transition-all" />
                                </button>
                            ))
                        ) : (
                            <div className="p-12 text-center flex flex-col items-center gap-4 opacity-30 grayscale text-white">
                                <User className="h-12 w-12 text-white" />
                                <p className="text-sm font-medium text-white">{isMedical ? "Busque por pacientes existentes" : "Busque por clientes da sua base jurídica"}</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default WhatsAppInbox;
