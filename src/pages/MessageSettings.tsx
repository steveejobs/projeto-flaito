import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
    Plus, 
    Save, 
    Trash2, 
    MessageSquare, 
    Zap, 
    Settings2, 
    CheckCircle2, 
    AlertCircle,
    Copy,
    History as HistoryIcon,
    ArrowLeft,
    Database
} from "lucide-react";
import { toast } from 'sonner';
import { useOfficeSession } from "@/hooks/useOfficeSession";
import { useMessaging } from "@/contexts/MessagingContext";
import { VariableCatalog } from "@/components/settings/VariableCatalog";
const MessageSettings = () => {
    const { user } = useAuth();
    const { officeId } = useOfficeSession(user?.id);
    const { context } = useMessaging();
    const [templates, setTemplates] = useState<any[]>([]);
    const [rules, setRules] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [viewingHistory, setViewingHistory] = useState<any>(null);
    const [templateHistory, setTemplateHistory] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    const fetchData = async () => {
        if (!officeId) return;
        setIsLoading(true);
        try {
            const [tData, rData, cData, aData] = await Promise.all([
                supabase.from('message_templates' as any).select('*').eq('office_id', officeId).eq('context_type', context).order('name'),
                supabase.from('automation_rules' as any).select('*, message_templates(name)').eq('office_id', officeId).eq('context_type', context),
                supabase.from('message_template_categories' as any).select('*'),
                supabase.from('audit_logs' as any).select('*').eq('office_id', officeId).eq('entity_type', 'TEMPLATE').order('created_at', { ascending: false }).limit(20)
            ]);

            setTemplates(tData.data || []);
            setRules(rData.data || []);
            setCategories(cData.data || []);
            setAuditLogs(aData.data || []);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            toast.error("Erro ao carregar configurações.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchHistory = async (templateId: string) => {
        const { data, error } = await supabase
            .from('message_template_history' as any)
            .select('*')
            .eq('template_id', templateId)
            .order('version', { ascending: false });
        
        if (error) {
            toast.error("Erro ao carregar histórico.");
        } else {
            setTemplateHistory(data || []);
        }
    };

    useEffect(() => {
        fetchData();
    }, [officeId, context]);

    const handleSaveTemplate = async () => {
        if (!editingTemplate.name || !editingTemplate.content) {
            toast.error("Preencha todos os campos.");
            return;
        }

        try {
            const dataToSave = {
                ...editingTemplate,
                office_id: officeId,
                context_type: context,
                updated_at: new Date().toISOString()
            };

            const { error } = editingTemplate.id 
                ? await supabase.from('message_templates' as any).update(dataToSave).eq('id', editingTemplate.id)
                : await supabase.from('message_templates' as any).insert(dataToSave);

            if (error) throw error;
            toast.success("Template salvo com sucesso!");
            setEditingTemplate(null);
            fetchData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleViewHistory = (template: any) => {
        setViewingHistory(template);
        fetchHistory(template.id);
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <Settings2 className="h-8 w-8 text-emerald-500" />
                    Configurações de Mensagens
                </h1>
                <p className="text-muted-foreground">Gerencie seus templates e regras de automação com total governança.</p>
            </div>

            <Tabs defaultValue="templates" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl h-12 mb-8">
                    <TabsTrigger value="templates" className="rounded-lg data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 gap-2">
                        <MessageSquare className="h-4 w-4" /> Templates
                    </TabsTrigger>
                    <TabsTrigger value="rules" className="rounded-lg data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 gap-2">
                        <Zap className="h-4 w-4" /> Automações
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="rounded-lg data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-500 gap-2">
                        <HistoryIcon className="h-4 w-4" /> Auditoria
                    </TabsTrigger>
                    <TabsTrigger value="variables" className="rounded-lg data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-500 gap-2">
                        <Database className="h-4 w-4" /> Variáveis
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="templates" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Meus Templates</h2>
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl"
                            onClick={() => setEditingTemplate({ name: '', content: '', category_id: 'GENERAL', is_active: true })}
                        >
                            <Plus className="h-4 w-4" /> Novo Template
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map(t => (
                            <Card key={t.id} className="bg-white/[0.02] border-white/5 hover:border-emerald-500/30 transition-all group">
                                <CardHeader className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-tighter bg-white/5 border-white/10">
                                                {t.category_id}
                                            </Badge>
                                            <Badge variant="secondary" className="text-[10px] bg-white/10">
                                                v{t.version || 1}
                                            </Badge>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleViewHistory(t)}>
                                                <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingTemplate(t)}>
                                                <Settings2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg font-bold mt-2 text-white">{t.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <p className="text-sm text-muted-foreground line-clamp-3 italic">"{t.content}"</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {editingTemplate && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                            <Card className="w-full max-w-2xl bg-[#09090b] border-white/10 shadow-2xl overflow-hidden">
                                <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                                    <CardTitle className="text-xl font-bold text-white">
                                        {editingTemplate.id ? 'Editar Template' : 'Novo Template'}
                                    </CardTitle>
                                    <CardDescription>Defina o conteúdo e as variáveis dinâmicas.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 p-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white">Nome do Template</label>
                                        <Input 
                                            value={editingTemplate.name} 
                                            onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                            className="bg-white/5 border-white/10"
                                            placeholder="Ex: Lembrete de Consulta Legal"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white">Categoria</label>
                                            <select 
                                                className="w-full h-10 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white"
                                                value={editingTemplate.category_id}
                                                onChange={e => setEditingTemplate({...editingTemplate, category_id: e.target.value})}
                                            >
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-end pb-2">
                                            <Button 
                                                variant="outline" 
                                                className="w-full gap-2 border-dashed"
                                                onClick={() => setEditingTemplate({...editingTemplate, content: editingTemplate.content + ' {{client_name}}'})}
                                            >
                                                <Plus className="h-3 w-3" /> Inserir Variável
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white">Conteúdo</label>
                                        <Textarea 
                                            value={editingTemplate.content} 
                                            onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})}
                                            className="min-h-[150px] bg-white/5 border-white/10"
                                            placeholder="Use {{client_name}}, {{appointment_date}}, etc."
                                        />
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-6">
                                        <Button variant="ghost" onClick={() => setEditingTemplate(null)}>Cancelar</Button>
                                        <Button onClick={handleSaveTemplate} className="bg-emerald-600 text-white">Salvar Alterações</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {viewingHistory && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                            <Card className="w-full max-w-3xl bg-[#09090b] border-white/10 shadow-2xl h-[80vh] flex flex-col">
                                <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                                            <HistoryIcon className="h-5 w-5 text-emerald-500" />
                                            Histórico de Versões: {viewingHistory.name}
                                        </CardTitle>
                                        <CardDescription>Rastreabilidade de alterações para auditoria.</CardDescription>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setViewingHistory(null)}>
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {templateHistory.map((v) => (
                                        <div key={v.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-3 relative overflow-hidden group">
                                            <div className="flex justify-between items-center relative z-10">
                                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none">
                                                    Versão {v.version}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(v.created_at).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground italic line-clamp-2">"{v.content}"</p>
                                            
                                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                               <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => {
                                                   setEditingTemplate({...viewingHistory, content: v.content});
                                                   setViewingHistory(null);
                                               }}>
                                                   Restaurar Conteúdo
                                               </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {templateHistory.length === 0 && (
                                        <div className="text-center py-20 text-muted-foreground uppercase text-xs tracking-widest opacity-30">
                                            Nenhuma versão anterior encontrada
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="rules" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Regras Automáticas</h2>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl">
                            <Plus className="h-4 w-4" /> Nova Regra
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {rules.map(r => (
                            <Card key={r.id} className="bg-white/[0.02] border-white/5 p-4 flex items-center justify-between hover:border-blue-500/30 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">{r.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Resource: <strong>{r.resource_type}</strong> • 
                                            Trigger: <strong>{r.event_type}</strong> • 
                                            Offset: <strong>{r.offset_days} dias</strong>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge className={r.is_active ? 'bg-emerald-500/10 text-emerald-400 border-none' : 'bg-red-500/10 text-red-400 border-none'}>
                                        {r.is_active ? 'Ativa' : 'Inativa'}
                                    </Badge>
                                    <Button variant="ghost" size="icon"><Settings2 className="h-4 w-4" /></Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="audit" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-white">Log de Auditoria</h2>
                            <p className="text-sm text-muted-foreground">Rastreamento de todas as alterações em templates e configurações.</p>
                        </div>
                    </div>

                    <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
                        <div className="grid grid-cols-4 gap-4 p-4 border-b border-white/5 bg-white/5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            <div>Data/Hora</div>
                            <div>Ação</div>
                            <div>Usuário</div>
                            <div>Detalhes</div>
                        </div>
                        <div className="divide-y divide-white/5">
                            {auditLogs.map((log) => (
                                <div key={log.id} className="grid grid-cols-4 gap-4 p-4 text-sm items-center hover:bg-white/[0.02] transition-colors">
                                    <div className="text-muted-foreground">
                                        {new Date(log.created_at).toLocaleString('pt-BR')}
                                    </div>
                                    <div>
                                        <Badge className={`${
                                            log.action === 'INSERT' ? 'bg-emerald-500/10 text-emerald-500' :
                                            log.action === 'UPDATE' ? 'bg-blue-500/10 text-blue-500' :
                                            'bg-red-500/10 text-red-500'
                                        } border-none font-bold text-[10px]`}>
                                            {log.action}
                                        </Badge>
                                    </div>
                                    <div className="text-white font-medium">
                                        {log.actor_user_id ? 'Usuário do Sistema' : 'Automatização'}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                        ID: {log.entity_id.split('-')[0]}...
                                    </div>
                                </div>
                            ))}
                            {auditLogs.length === 0 && (
                                <div className="p-12 text-center text-muted-foreground opacity-30 italic">
                                    Nenhum log de auditoria encontrado.
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="variables" className="space-y-6">
                    <VariableCatalog />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default MessageSettings;
