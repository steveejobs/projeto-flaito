import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Bot,
    Search,
    Sparkles,
    Settings2,
    Cpu,
    Pencil,
    Building2,
    Lock,
    Info,
    Globe,
    Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────

interface AIAgentConfig {
    id: string;
    slug: string;
    office_id: string | null;
    pipeline_stage: string | null;
    model: string;
    system_prompt: string;
    extra_instructions: string | null;
    temperature: number;
    max_tokens: number;
    is_active: boolean;
    mode: 'automatic' | 'advanced';
    metadata: Record<string, unknown>;
    version: number;
    created_at: string;
    updated_at: string;
}

const AGENT_NAME_MAPPING: Record<string, string> = {
    'lexos-chat-assistant': 'Lexos Chat Assistant',
    'voice-assistant': 'Voice Assistant',
    'nija-full-analysis': 'NIJA Analysis Agent',
    'maestro-orchestrator': 'Maestro Orchestrator',
    'document-analyzer': 'Document Analyzer',
    'legal-researcher': 'Legal Researcher',
};

const AVAILABLE_MODELS = [
    { value: 'google/gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Google' },
    { value: 'google/gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'Google' },
    { value: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash', provider: 'Google' },
    { value: 'openai/gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
    { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
    { value: 'openai/o3-mini', label: 'O3 Mini', provider: 'OpenAI' },
    { value: 'anthropic/claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
    { value: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (v2)', provider: 'Anthropic' },
];

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const AIAgentsManager = () => {
    const [configs, setConfigs] = useState<AIAgentConfig[]>([]);
    const [allRawConfigs, setAllRawConfigs] = useState<AIAgentConfig[]>([]);
    const [officeId, setOfficeId] = useState<string | null>(null);
    const [officeName, setOfficeName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [editingConfig, setEditingConfig] = useState<AIAgentConfig | null>(null);
    const [editForm, setEditForm] = useState<Partial<AIAgentConfig>>({});

    // ─── Fetch data ───
    useEffect(() => {
        const initialize = async () => {
            setLoading(true);
            try {
                // 1. Get office_id
                const { data: sessionData, error: sessionErr } = await supabase.rpc('lexos_healthcheck_session');
                if (sessionErr) throw sessionErr;
                
                const currentOfficeId = sessionData?.[0]?.office_id;
                setOfficeId(currentOfficeId);

                // 1.1 Fetch office name if exists
                if (currentOfficeId) {
                    const { data: officeData } = await supabase
                        .from('offices')
                        .select('name')
                        .eq('id', currentOfficeId)
                        .maybeSingle();
                    if (officeData) setOfficeName(officeData.name);
                }

                // 2. Fetch all configs (Global + This Office)
                let query = supabase
                    .from('ai_agent_configs')
                    .select('*');

                if (currentOfficeId) {
                    query = query.or(`office_id.is.null,office_id.eq.${currentOfficeId}`);
                } else {
                    query = query.is('office_id', null);
                }

                const { data, error } = await query.order('slug', { ascending: true });

                if (error) throw error;
                
                setAllRawConfigs(data || []);

                // Redução para manter apenas a versão mais específica (STAGE > OFFICE > GLOBAL)
                const resolved = (data || []).reduce((acc: AIAgentConfig[], curr: AIAgentConfig) => {
                    const existingIdx = acc.findIndex(a => a.slug === curr.slug);
                    
                    if (existingIdx === -1) {
                        acc.push(curr);
                    } else {
                        const existing = acc[existingIdx];
                        // Prioridade: STAGE (pipeline_stage != null) > OFFICE (office_id != null) > GLOBAL (null)
                        const getWeight = (c: AIAgentConfig) => {
                            if (c.pipeline_stage) return 3;
                            if (c.office_id) return 2;
                            return 1;
                        };

                        if (getWeight(curr) > getWeight(existing)) {
                            acc[existingIdx] = curr;
                        }
                    }
                    return acc;
                }, []);

                setConfigs(resolved);
            } catch (err) {
                console.error('[AIAgents] Initialization error:', err);
                toast.error('Erro ao inicializar gestor de agentes');
            } finally {
                setLoading(false);
            }
        };

        initialize();
    }, []);

    // ─── Open editor ───
    const openEditor = (config: AIAgentConfig) => {
        setEditingConfig(config);
        setEditForm({ ...config });
    };

    // ─── Handle field changes ───
    const handleFieldChange = (field: keyof AIAgentConfig, value: any) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    // ─── Verification helpers for Inheritance ───
    const getGlobalValue = (slug: string, field: keyof AIAgentConfig) => {
        const globalRef = allRawConfigs.find(c => c.slug === slug && !c.office_id && !c.pipeline_stage);
        return globalRef ? globalRef[field] : null;
    };

    const isInherited = (field: keyof AIAgentConfig) => {
        if (!editingConfig) return true;
        const globalRefValue = getGlobalValue(editingConfig.slug, field);
        const currentVal = editForm[field];
        
        if (globalRefValue === undefined || globalRefValue === null) return false;
        
        // Handle numeric/string comparisons safely
        if (typeof globalRefValue === 'number') {
            return globalRefValue === Number(currentVal);
        }
        return globalRefValue === currentVal;
    };

    // ─── Save Office Override ───
    const handleSave = async () => {
        if (!editingConfig || !officeId) return;

        try {
            // Find provider from model catalog
            const selectedModel = AVAILABLE_MODELS.find(m => m.value === editForm.model);
            const provider = selectedModel?.provider.toLowerCase() || 'google';

            const payload = {
                slug: editingConfig.slug,
                office_id: officeId,
                pipeline_stage: editingConfig.pipeline_stage, // Mantém o estágio se houver (ex: ANALYSIS/GENERATION)
                model: editForm.model,
                provider: provider,
                temperature: Number(editForm.temperature),
                max_tokens: Number(editForm.max_tokens),
                extra_instructions: editForm.extra_instructions,
                is_active: editForm.is_active,
                mode: editForm.mode,
                system_prompt: editingConfig.system_prompt, // Read-only
                friendly_name: editingConfig.friendly_name || AGENT_NAME_MAPPING[editingConfig.slug] || editingConfig.slug,
                metadata: editingConfig.metadata || {},
                version: (editingConfig.version || 1) + 1
            };

            const { data, error } = await supabase
                .from('ai_agent_configs')
                .upsert(payload, { onConflict: 'slug,office_id,pipeline_stage' })
                .select()
                .single();

            if (error) throw error;

            const saved = data as AIAgentConfig;
            
            // Update raw configs too
            setAllRawConfigs(prev => {
                const filtered = prev.filter(c => !(c.slug === saved.slug && c.office_id === saved.office_id && c.pipeline_stage === saved.pipeline_stage));
                return [...filtered, saved];
            });

            setConfigs(prev => prev.map(c => c.slug === saved.slug ? saved : c));
            setEditingConfig(saved);
            
            toast.success('Alterações salvas para seu escritório');
        } catch (err) {
            console.error('[AIAgents] Save error:', err);
            toast.error('Erro ao salvar personalização');
        }
    };

    // ─── Filter configs ───
    const filteredConfigs = configs.filter(config => {
        const friendlyName = AGENT_NAME_MAPPING[config.slug] || config.slug;
        const matchesSearch = !search ||
            config.slug.toLowerCase().includes(search.toLowerCase()) ||
            friendlyName.toLowerCase().includes(search.toLowerCase()) ||
            (config.system_prompt || '').toLowerCase().includes(search.toLowerCase());
        
        const matchesStatus = statusFilter === 'ALL' || 
            (statusFilter === 'ACTIVE' ? config.is_active : !config.is_active);

        return matchesSearch && matchesStatus;
    });

    const getModelLabel = (modelValue: string) => {
        const found = AVAILABLE_MODELS.find(m => m.value === modelValue);
        return found ? found.label : (modelValue.split('/').pop() || modelValue);
    };

    const getOriginBadge = (config: AIAgentConfig) => {
        if (config.pipeline_stage) {
            return (
                <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] uppercase font-bold px-2 py-0.5">
                   <Layers className="h-3 w-3 mr-1" /> Stage
                </Badge>
            );
        }
        if (config.office_id) {
            return (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase font-bold px-2 py-0.5">
                   <Building2 className="h-3 w-3 mr-1" /> Office
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="text-muted-foreground text-[9px] uppercase font-bold px-2 py-0.5">
               <Globe className="h-3 w-3 mr-1" /> Global
            </Badge>
        );
    };

    // ─────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            {/* Header */}
            <div className="px-6 lg:px-10 pt-8 pb-6 border-b border-white/5 bg-card/20 backdrop-blur-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20 shadow-2xl shadow-violet-500/10">
                            <Bot className="h-7 w-7 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                                Agentes de IA
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1 font-medium">
                                Gestão centralizada de inteligência, prompts e modelos avançados
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs px-4 py-2 border-violet-500/30 text-violet-300 bg-violet-500/5 backdrop-blur-md font-bold uppercase tracking-widest">
                            <Sparkles className="h-3 w-3 mr-2" />
                            {configs.length} Agentes
                        </Badge>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-violet-400 transition-colors" />
                        <Input
                            placeholder="Buscar configuração por nome, slug ou prompt..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-12 h-12 bg-white/[0.02] border-white/10 hover:border-white/20 focus:border-violet-500/50 rounded-xl transition-all shadow-inner"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[200px] h-12 bg-white/[0.02] border-white/10 rounded-xl font-semibold">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-white/10">
                            <SelectItem value="ALL">Todos os status</SelectItem>
                            <SelectItem value="ACTIVE">Ativos</SelectItem>
                            <SelectItem value="INACTIVE">Inativos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 px-6 lg:px-10 py-10">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <Card key={i} className="h-[180px] bg-white/[0.02] border-white/5 animate-pulse rounded-2xl" />
                        ))}
                    </div>
                ) : filteredConfigs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground bg-white/[0.01] rounded-[2rem] border border-dashed border-white/5 max-w-4xl mx-auto shadow-2xl">
                        <div className="p-6 rounded-full bg-white/[0.02] mb-6">
                            <Bot className="h-16 w-16 opacity-10" />
                        </div>
                        <p className="text-xl font-bold opacity-40 tracking-tight">Nenhum agente configurado</p>
                        <p className="text-sm opacity-30 mt-2">Tente ajustar seus filtros de busca</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {filteredConfigs.map(config => (
                            <Card
                                key={config.id}
                                className={`relative group overflow-hidden bg-card border-white/5 hover:border-violet-500/40 transition-all duration-500 cursor-pointer rounded-2xl shadow-lg hover:shadow-violet-500/10 ${!config.is_active ? 'opacity-60 grayscale-[0.8]' : ''}`}
                                onClick={() => openEditor(config)}
                            >
                                <div className="absolute -inset-2 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity blur-2xl" />

                                <div className="relative p-6 h-full flex flex-col">
                                    {/* Status Dot */}
                                    <div className={`absolute top-6 right-6 h-2 w-2 rounded-full ${config.is_active ? 'bg-emerald-500' : 'bg-red-500/50'}`} />

                                    {/* Name & Origin */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="space-y-1.5 overflow-hidden">
                                            <h3 className="text-sm font-bold truncate pr-8">
                                                {AGENT_NAME_MAPPING[config.slug] || config.slug}
                                            </h3>
                                            <code className="text-[9px] font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded block w-fit truncate">
                                                {config.slug}
                                            </code>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2">
                                            {getOriginBadge(config)}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-6 h-9 leading-relaxed font-medium">
                                        {config.system_prompt || 'Nenhuma instrução base definida'}
                                    </p>

                                    {/* Tags */}
                                    <div className="mt-auto flex flex-wrap gap-2 pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 tracking-wider">
                                            <Cpu className="h-3 w-3 opacity-40 text-violet-400" />
                                            {getModelLabel(config.model)}
                                        </div>
                                        <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg border tracking-wider ${config.mode === 'advanced' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-300 border-blue-500/20'}`}>
                                            <Settings2 className="h-3 w-3 opacity-40" />
                                            {config.mode === 'advanced' ? 'Avançado' : 'Auto'}
                                        </div>
                                    </div>

                                    {/* Premium Hover Button */}
                                    <div className="absolute inset-x-4 bottom-4 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-4 transition-all duration-300">
                                        <Button className="w-full bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-[0.15em] h-10 rounded-xl shadow-2xl shadow-violet-600/40">
                                            {config.office_id ? 'Ajustar Config' : 'Visualizar / Override'}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Config View & Edit Sheet */}
            <Sheet open={!!editingConfig} onOpenChange={(open) => !open && setEditingConfig(null)}>
                <SheetContent className="w-full sm:max-w-2xl bg-background border-l border-white/5 p-0 overflow-hidden flex flex-col shadow-2xl shadow-black/80">
                    <div className="relative p-8 border-b border-white/5 bg-card/40 backdrop-blur-3xl overflow-hidden">
                        <div className="flex items-start justify-between gap-6 mb-8">
                            <div className="space-y-2">
                                <SheetHeader className="text-left space-y-2">
                                    <SheetTitle className="flex items-center gap-3 text-2xl font-black tracking-tight leading-none text-white">
                                        <div className="p-2 rounded-xl bg-violet-600/10 text-violet-400 border border-violet-600/20">
                                            <Bot className="h-6 w-6" />
                                        </div>
                                        {editForm.slug ? (AGENT_NAME_MAPPING[editForm.slug] || editForm.slug) : 'Agente IA'}
                                    </SheetTitle>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <SheetDescription className="font-mono text-[10px] font-black text-violet-400 bg-violet-400/5 w-fit px-2 py-0.5 rounded border border-violet-400/10 tracking-widest uppercase truncate max-w-[300px]">
                                                {editForm.slug}
                                            </SheetDescription>
                                            {editingConfig && getOriginBadge(editingConfig)}
                                        </div>
                                        {officeName && (
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                <Building2 className="h-3 w-3" />
                                                Configuração do escritório: <span className="text-white/70">{officeName}</span>
                                            </p>
                                        )}
                                    </div>
                                </SheetHeader>
                            </div>
                            <div className="flex flex-col items-end gap-3 shrink-0">
                                <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
                                    <label className="text-[9px] uppercase font-black text-muted-foreground tracking-widest ml-1">{editForm.is_active ? 'Ativo' : 'Inativo'}</label>
                                    <Switch
                                        checked={editForm.is_active}
                                        onCheckedChange={(checked) => handleFieldChange('is_active', checked)}
                                        className="data-[state=checked]:bg-emerald-500 scale-90"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Mode Indicator & Selector */}
                        <div className="flex items-center gap-4 py-3 px-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
                            <div className="flex-1">
                                <label className="text-[9px] uppercase font-black text-violet-400/80 block mb-1.5 tracking-widest">
                                    Escopo de Operação
                                </label>
                                <Select value={editForm.mode} onValueChange={(val) => handleFieldChange('mode', val)}>
                                    <SelectTrigger className="h-8 border-none bg-transparent p-0 focus:ring-0 text-xs font-black uppercase tracking-wider text-foreground">
                                        <div className="flex items-center gap-2">
                                            <Settings2 className="h-4 w-4 text-violet-400/60" />
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-white/10">
                                        <SelectItem value="automatic">Modo Automático</SelectItem>
                                        <SelectItem value="advanced">Acesso Avançado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {officeName && (
                                <div className="text-right border-l border-white/10 pl-4 py-1">
                                    <p className="text-[10px] font-bold text-emerald-400/60 leading-tight uppercase tracking-tighter">Impacto</p>
                                    <p className="text-[9px] text-muted-foreground/60 leading-tight">Clientes do escritório</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-none">
                        <section className="space-y-6">
                            <div className="flex items-center gap-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-white/50 flex-none ml-1">
                                    Motor Técnico
                                </h3>
                                <div className="h-px w-full bg-white/5" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            Modelo
                                            <span className="text-[8px] font-medium opacity-40 lowercase">
                                                ({isInherited('model') ? 'Global' : 'Personalizado'})
                                            </span>
                                        </span>
                                    </label>
                                    <Select value={editForm.model} onValueChange={(val) => handleFieldChange('model', val)}>
                                        <SelectTrigger className="h-14 border-white/10 bg-white/[0.02] px-4 rounded-xl font-mono text-xs shadow-inner focus:border-violet-500/30">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-white/10 max-h-[300px]">
                                            {AVAILABLE_MODELS.map(m => (
                                                <SelectItem key={m.value} value={m.value} className="font-mono text-xs py-3">
                                                    <div className="flex flex-col">
                                                        <span>{m.label}</span>
                                                        <span className="text-[9px] opacity-40 uppercase tracking-tighter">{m.provider}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center block">
                                            Temp
                                            <span className="text-[8px] font-medium opacity-40 lowercase block">
                                                ({isInherited('temperature') ? 'Global' : 'Personalizado'})
                                            </span>
                                        </label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="2"
                                            value={editForm.temperature}
                                            onChange={(e) => handleFieldChange('temperature', e.target.value)}
                                            className="h-14 border-white/10 bg-white/[0.02] text-center font-mono text-xs rounded-xl shadow-inner focus:border-violet-500/30"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center block">
                                            Tokens
                                            <span className="text-[8px] font-medium opacity-40 lowercase block">
                                                ({isInherited('max_tokens') ? 'Global' : 'Personalizado'})
                                            </span>
                                        </label>
                                        <Input
                                            type="number"
                                            value={editForm.max_tokens}
                                            onChange={(e) => handleFieldChange('max_tokens', e.target.value)}
                                            className="h-14 border-white/10 bg-white/[0.02] text-center font-mono text-xs rounded-xl shadow-inner focus:border-violet-500/30"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-6">
                            <div className="flex items-center gap-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-white/50 flex-none ml-1">
                                    Instruções Base
                                </h3>
                                <div className="h-px w-full bg-white/5" />
                            </div>

                            <div className="space-y-4 opacity-70">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em] flex items-center justify-between px-1">
                                    <span className="flex items-center gap-2">
                                        System Prompt
                                        <Lock className="h-2.5 w-2.5 text-muted-foreground/40" />
                                    </span>
                                </label>
                                <Textarea
                                    value={editForm.system_prompt}
                                    readOnly
                                    className="min-h-[200px] bg-white/[0.01] border-white/5 leading-relaxed text-[10px] px-6 py-5 rounded-2xl font-medium scrollbar-none cursor-default"
                                />
                                <p className="text-[9px] italic opacity-50 px-2 tracking-tight">* Instruções de sistema são geridas pela plataforma para segurança do core.</p>
                            </div>
                        </section>

                        <section className="space-y-6">
                            <div className="flex items-center gap-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-400/60 flex-none ml-1">
                                    Personalização Local
                                </h3>
                                <div className="h-px w-full bg-emerald-500/10" />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center justify-between px-1">
                                    <span className="flex items-center gap-2.5">
                                        Extra Instructions
                                        <span className="text-[8px] font-medium opacity-40 lowercase">
                                            ({isInherited('extra_instructions') ? 'Global' : 'Personalizado'})
                                        </span>
                                    </span>
                                </label>
                                <Textarea
                                    value={editForm.extra_instructions || ''}
                                    placeholder="Adicione orientações específicas do seu escritório..."
                                    onChange={(e) => handleFieldChange('extra_instructions', e.target.value)}
                                    className="min-h-[140px] bg-emerald-500/5 border-emerald-500/10 leading-relaxed text-xs p-6 rounded-2xl font-semibold hover:border-emerald-500/30 focus:border-emerald-500/50"
                                />
                            </div>
                        </section>
                    </div>

                    {/* Footer - Impact message added */}
                    <div className="p-8 border-t border-white/5 bg-card/60 backdrop-blur-3xl flex items-center justify-between gap-6">
                        <div className="flex items-center gap-3 opacity-60">
                           <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                <Info className="h-4 w-4 text-violet-400" />
                           </div>
                           <div className="text-left hidden md:block">
                               <p className="text-[10px] font-bold text-white uppercase tracking-tighter leading-none">Contexto de Escritório</p>
                               <p className="text-[9px] text-muted-foreground mt-1 tracking-tight">Afeta atendimentos realizados para clientes deste escritório.</p>
                           </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button 
                                variant="ghost" 
                                onClick={() => setEditingConfig(null)}
                                className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-white"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handleSave}
                                className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-black uppercase tracking-[0.1em] px-10 py-6 rounded-2xl shadow-xl shadow-violet-600/20 active:scale-95 transition-all"
                            >
                                Salvar Override
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );

};

export default AIAgentsManager;
