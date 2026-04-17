import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Filter, User, Clock, MessageSquare, 
  CheckCircle2, AlertCircle, MoreVertical, Send,
  StickyNote, UserPlus, XCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { conversationOperationService } from "@/services/conversationOperationService";

const OperationsInbox = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const officeId = user?.user_metadata?.office_id;

  useEffect(() => {
    if (officeId) {
      loadConversations();
      
      // Realtime subscription
      const channel = supabase
        .channel('operations_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => loadConversations())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => {
             if (selectedId) loadMessages(selectedId);
             loadConversations();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [officeId, selectedId]);

  const loadConversations = async () => {
    const { data } = await supabase
      .from('whatsapp_conversations' as any)
      .select(`
        *,
        crm_leads (full_name),
        members:assigned_user_id (id)
      `)
      .eq('office_id', officeId)
      .order('last_message_at', { ascending: false });

    if (data) setConversations(data);
    setIsLoading(false);
  };

  const loadMessages = async (id: string) => {
    const { data: msgs } = await supabase
      .from('whatsapp_messages' as any)
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    const { data: nts } = await supabase
      .from('conversation_notes' as any)
      .select('*, author:author_user_id(id)')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    const { data: evts } = await supabase
      .from('conversation_events' as any)
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgs) setMessages(msgs);
    if (nts) setNotes(nts);
    // Para simplificar, vamos tratar eventos como notas para o estado, ou criar um novo
    setEvents(evts || []);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedId) return;

    try {
      if (isNoteMode) {
        await conversationOperationService.addNote(selectedId, officeId, user.id, inputText);
        toast({ title: "Nota adicionada" });
      } else {
        // Envio real via flowExecutionService ou direto (Aqui simulamos o disparo outbound)
        await supabase.from('whatsapp_messages' as any).insert({
          conversation_id: selectedId,
          office_id: officeId,
          direction: 'outbound',
          content: inputText,
        });
      }
      setInputText("");
      loadMessages(selectedId);
    } catch (e) {
      toast({ title: "Erro na operação", variant: "destructive" });
    }
  };

  const handleTakeover = async (id: string) => {
    try {
      await conversationOperationService.takeover(id, user.id, officeId);
      toast({ title: "Você assumiu este atendimento" });
      setSelectedId(id);
    } catch (e) {
      toast({ title: "Erro ao assumir", variant: "destructive" });
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background/50 backdrop-blur-xl border border-white/10 rounded-2xl md:m-4 shadow-2xl animate-in fade-in zoom-in duration-500">
      
      {/* SIDEBAR: Lista de Conversas */}
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-white/10 flex-col bg-black/5`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Central Inbox</h2>
            <Button variant="ghost" size="icon" className="hover:bg-white/10">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou fone..." className="pl-9 bg-white/5 border-white/10 focus-visible:ring-purple-500" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 pb-4 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full p-3 rounded-xl flex flex-col gap-1 transition-all duration-200 group relative ${
                  selectedId === conv.id 
                    ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/20 shadow-lg' 
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <span className="font-semibold text-sm truncate max-w-[140px]">
                    {conv.crm_leads?.full_name || conv.normalized_phone}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                   {conv.human_required && (
                     <Badge variant="destructive" className="h-4 px-1 animate-pulse">Humano</Badge>
                   )}
                   {conv.status === 'respondida_ia' && (
                     <Badge variant="secondary" className="h-4 px-1 bg-blue-500/20 text-blue-400">IA</Badge>
                   )}
                </div>
                <p className="text-xs text-muted-foreground truncate w-full text-left">
                  {conv.metadata?.last_message_preview || "Sem mensagens"}
                </p>
                {selectedId === conv.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* MAIN: Chat e Ações */}
      <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between backdrop-blur-md">
              <div className="flex items-center gap-3 overflow-hidden">
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSelectedId(null)}>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </Button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
                  {(selectedConv.crm_leads?.full_name?.[0] || 'U').toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-lg leading-tight truncate">{selectedConv.crm_leads?.full_name || selectedConv.normalized_phone}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap overflow-hidden">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> SLA: 15min</span>
                    <Separator orientation="vertical" className="h-3" />
                    <span className="flex items-center gap-1 truncate"><User className="w-3 h-3" /> {selectedConv.assigned_user_id ? 'Responsável' : 'Aguardando'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!selectedConv.assigned_user_id && (
                  <Button onClick={() => handleTakeover(selectedConv.id)} className="bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20">
                    <UserPlus className="w-4 h-4 mr-2" /> Assumir
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900/95 border-white/10 backdrop-blur-xl">
                    <DropdownMenuItem className="text-red-400 focus:text-red-300" onClick={() => conversationOperationService.close(selectedId!, user.id, officeId)}>
                      <XCircle className="w-4 h-4 mr-2" /> Encerrar Atendimento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6 max-w-4xl mx-auto">
                {[...messages, ...notes, ...events].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((item, idx) => {
                  const isNote = !!item.body;
                  const isEvent = !!item.event_type;
                  const isInbound = item.direction === 'inbound';
                  
                  if (isEvent) {
                    return (
                      <div key={idx} className="flex justify-center items-center gap-2 py-2">
                        <div className="h-[1px] flex-1 bg-white/5" />
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3 text-purple-400" />
                          {item.event_type}: {new Date(item.created_at).toLocaleTimeString()}
                        </div>
                        <div className="h-[1px] flex-1 bg-white/5" />
                      </div>
                    );
                  }

                  if (isNote) {
                    return (
                      <div key={idx} className="flex justify-center">
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex gap-3 max-w-[80%] shadow-inner animate-in slide-in-from-bottom-2">
                          <StickyNote className="w-4 h-4 text-orange-400 mt-1 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-orange-400 mb-1">Nota Interna</p>
                            <p className="text-sm text-orange-200/80 italic">"{item.body}"</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[70%] rounded-2xl p-4 shadow-xl transition-all hover:scale-[1.01] ${
                        isInbound 
                          ? 'bg-white/10 border border-white/10 rounded-tl-none' 
                          : 'bg-gradient-to-br from-purple-600 to-blue-600 border border-white/20 rounded-tr-none text-white'
                      }`}>
                        <p className="text-sm leading-relaxed">{item.content}</p>
                        <p className={`text-[10px] mt-2 opacity-60 flex items-center gap-1 ${isInbound ? 'justify-start' : 'justify-end'}`}>
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {!isInbound && <CheckCircle2 className="w-3 h-3 text-white/60" />}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-white/5 border-t border-white/10">
              <div className="max-w-4xl mx-auto space-y-3">
                <div className="flex gap-2">
                  <Button 
                    variant={isNoteMode ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setIsNoteMode(true)}
                    className={isNoteMode ? 'bg-orange-500 hover:bg-orange-600' : 'text-muted-foreground'}
                  >
                    <StickyNote className="w-4 h-4 mr-2" /> Nota Interna
                  </Button>
                  <Button 
                    variant={!isNoteMode ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setIsNoteMode(false)}
                    className={!isNoteMode ? 'bg-purple-600 hover:bg-purple-700' : 'text-muted-foreground'}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" /> Cliente
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={isNoteMode ? "Escrever nota interna (visível apenas para equipe)..." : "Responder ao cliente..."}
                    className="flex-1 bg-white/5 border-white/10 focus-visible:ring-purple-500 h-12"
                  />
                  <Button onClick={handleSendMessage} disabled={!inputText.trim()} size="icon" className="h-12 w-12 bg-purple-600 hover:bg-purple-700 shadow-lg">
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40 grayscale">
            <div className="w-24 h-24 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-6 blur-[1px]">
              <MessageSquare className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold italic">Selecione uma conversa para iniciar</h3>
            <p className="text-sm">Clique em um contato na barra lateral</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationsInbox;
