import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
    Volume2, Play, Loader2, Save, Mic, Shield, Eye, Activity, Zap, Bot, User, MessageSquare
} from 'lucide-react';
import { toast } from "sonner";

interface Voice {
    voice_id: string;
    name: string;
    preview_url?: string;
    labels?: Record<string, string>;
}

const PERSONALITY_PRESETS = [
    {
        name: 'Executivo Formal',
        personality: 'Você é um assistente executivo de alto nível. Use linguagem formal, seja extremamente polido e foque em eficiência e precisão jurídica/médica.'
    },
    {
        name: 'Parceiro Ágil',
        personality: 'Você é um colega de trabalho proativo. Fale de forma direta, use termos técnicos do dia a dia e foque em resolver tarefas rapidamente.'
    },
    {
        name: 'Analista Detalhista',
        personality: 'Você é um consultor analítico. Sempre que trouxer dados, explique o contexto, destaque pontos de atenção e seja muito cauteloso com prazos.'
    }
];

export const VoiceSettingsCard = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [voices, setVoices] = useState<Voice[]>([]);
    const [previewLoading, setPreviewLoading] = useState<string | null>(null);
    
    const [settings, setSettings] = useState({
        voice_id: 'pNInz6obpgmqEba59W96', // Default (Adam)
        stability: 0.5,
        similarity_boost: 0.75,
        wake_word: 'Flaito',
        preferred_mode: 'automatic',
        agent_name: 'Flaito',
        agent_personality: 'Você é o Assistente Inteligente da Flaito. Seja prestativo, objetivo e fale em Português do Brasil.'
    });

    useEffect(() => {
        fetchVoicesAndSettings();
    }, []);

    const fetchVoicesAndSettings = async () => {
        setLoading(true);
        try {
            // 1. Fetch Voices
            const { data: voiceData, error: voiceError } = await supabase.functions.invoke('voice-config-proxy/voices', {
                method: 'GET'
            });
            if (voiceError) throw voiceError;
            if (voiceData?.voices) setVoices(voiceData.voices);

            // 2. Fetch User Settings
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: userSettings, error: settingsError } = await supabase
                    .from('user_voice_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();
                
                if (userSettings) {
                    setSettings({
                        voice_id: userSettings.voice_id || 'pNInz6obpgmqEba59W96',
                        stability: userSettings.stability || 0.5,
                        similarity_boost: userSettings.similarity_boost || 0.75,
                        wake_word: userSettings.wake_word || 'Flaito',
                        preferred_mode: userSettings.preferred_mode || 'automatic',
                        agent_name: userSettings.agent_name || 'Flaito',
                        agent_personality: userSettings.agent_personality || 'Você é o Assistente Inteligente da Flaito. Seja prestativo, objetivo e fale em Português do Brasil.'
                    });
                }
            }
        } catch (error) {
            console.error('[VoiceSettings] Fetch error:', error);
            toast.error('Erro ao carregar configurações de voz');
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async (vId: string) => {
        setPreviewLoading(vId);
        try {
            const { data, error } = await supabase.functions.invoke('voice-config-proxy/preview', {
                body: { 
                    voice_id: vId,
                    text: `Olá! Eu sou o ${settings.agent_name}. Como posso ajudar você hoje?`,
                    stability: settings.stability,
                    similarity_boost: settings.similarity_boost
                }
            });
            
            if (error) throw error;
            if (data?.audioBase64) {
                const audio = new Audio(data.audioBase64);
                audio.play();
            }
        } catch (error) {
            console.error('[VoiceSettings] Preview error:', error);
            toast.error('Erro ao gerar prévia de voz');
        } finally {
            setPreviewLoading(null);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Updated body to include personalization fields
            const { error } = await supabase.functions.invoke('voice-config-proxy/settings', {
                method: 'POST',
                body: settings
            });
            if (error) throw error;
            toast.success('Configurações de voz salvas');
        } catch (error) {
            console.error('[VoiceSettings] Save error:', error);
            toast.error('Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Volume2 className="h-5 w-5 text-primary" />
                        Configurações de Voz
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-center text-sm text-muted-foreground">Carregando vozes disponíveis...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden border-primary/10 shadow-xl bg-background/50 backdrop-blur-sm">
            <CardHeader className="bg-primary/5 pb-6">
                <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Bot className="h-5 w-5 text-primary" />
                    </div>
                    Agente de Voz & Personalidade
                </CardTitle>
                <CardDescription>
                    Escolha como o seu assistente se identifica e como ele deve se comportar.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 space-y-10">
                
                {/* IDENTIDADE DO AGENTE */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
                        <User className="h-4 w-4 text-primary" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-primary/70">Identidade</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">NOME DO AGENTE</Label>
                            <Input 
                                className="h-12 rounded-2xl border-white/10 bg-muted/30 font-bold"
                                value={settings.agent_name}
                                onChange={(e) => setSettings(prev => ({ ...prev, agent_name: e.target.value }))}
                                placeholder="Ex: Flaito, Assistente, Athena..."
                            />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">WAKE WORD (PALAVRA DE ATIVAÇÃO)</Label>
                            <div className="relative">
                                <Mic className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                                <Input 
                                    className="h-12 pl-11 rounded-2xl border-white/10 bg-muted/30 font-bold"
                                    value={settings.wake_word}
                                    onChange={(e) => setSettings(prev => ({ ...prev, wake_word: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">PERSONALIDADE & INSTRUÇÕES</Label>
                            <Select onValueChange={(val) => {
                                const preset = PERSONALITY_PRESETS.find(p => p.name === val);
                                if (preset) setSettings(prev => ({ ...prev, agent_personality: preset.personality }));
                            }}>
                                <SelectTrigger className="w-[200px] h-8 text-[10px] font-bold uppercase rounded-full bg-primary/5 border-primary/10">
                                    <SelectValue placeholder="USAR PRESET..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {PERSONALITY_PRESETS.map(p => (
                                        <SelectItem key={p.name} value={p.name} className="text-xs font-bold">{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Textarea 
                            className="min-h-[120px] rounded-2xl border-white/10 bg-muted/30 text-sm leading-relaxed p-4 resize-none"
                            value={settings.agent_personality}
                            onChange={(e) => setSettings(prev => ({ ...prev, agent_personality: e.target.value }))}
                            placeholder="Descreva como o agente deve falar e agir..."
                        />
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                            <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-muted-foreground leading-tight italic">
                                <strong>Dica:</strong> Defina o tom (formal/informal) e quais módulos o agente deve priorizar nas respostas.
                            </p>
                        </div>
                    </div>
                </div>

                {/* VOZ E PARÂMETROS */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
                        <Volume2 className="h-4 w-4 text-primary" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-primary/70">Síntese de Voz (TTS)</h3>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                            TIMBRE DA VOZ
                            <span className="text-primary/60">{voices.length} vozes disponíveis</span>
                        </Label>
                        <div className="flex gap-3">
                            <Select 
                                value={settings.voice_id} 
                                onValueChange={(val) => setSettings(prev => ({ ...prev, voice_id: val }))}
                            >
                                <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-muted/30">
                                    <SelectValue placeholder="Selecione uma voz" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {voices.map(v => (
                                        <SelectItem key={v.voice_id} value={v.voice_id}>
                                            <div className="flex flex-col">
                                                <span className="font-bold">{v.name}</span>
                                                <span className="text-[10px] opacity-60">
                                                    {v.labels?.accent || v.labels?.gender || 'Voz ElevenLabs'}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-12 w-12 shrink-0 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                                onClick={() => handlePreview(settings.voice_id)}
                                disabled={!!previewLoading}
                            >
                                {previewLoading === settings.voice_id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-tight">Estabilidade</Label>
                                <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    {Math.round(settings.stability * 100)}%
                                </span>
                            </div>
                            <Slider 
                                value={[settings.stability]} 
                                max={1} 
                                step={0.05} 
                                onValueChange={(val) => setSettings(prev => ({ ...prev, stability: val[0] }))}
                            />
                        </div>

                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-tight">Clareza & Similaridade</Label>
                                <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    {Math.round(settings.similarity_boost * 100)}%
                                </span>
                            </div>
                            <Slider 
                                value={[settings.similarity_boost]} 
                                max={1} 
                                step={0.05} 
                                onValueChange={(val) => setSettings(prev => ({ ...prev, similarity_boost: val[0] }))}
                            />
                        </div>
                    </div>
                </div>

                {/* MODO OPERACIONAL */}
                <div className="space-y-6 pt-4">
                    <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-primary/70">Operação</h3>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">MODO PADRÃO DE SEGURANÇA</Label>
                        <Select 
                            value={settings.preferred_mode} 
                            onValueChange={(val) => setSettings(prev => ({ ...prev, preferred_mode: val }))}
                        >
                            <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-muted/30">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="consultation" className="font-bold flex items-center gap-2">
                                    <div className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-blue-500" /> Consulta (Apenas leitura)</div>
                                </SelectItem>
                                <SelectItem value="assisted" className="font-bold">
                                    <div className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-green-500" /> Assistido (Confirmações leves)</div>
                                </SelectItem>
                                <SelectItem value="critical" className="font-bold">
                                    <div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-red-500" /> Crítico (Exige confirmação total)</div>
                                </SelectItem>
                                <SelectItem value="automatic" className="font-bold">
                                    <div className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-500" /> Automático (Execução fluida)</div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Button 
                    className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 active:scale-95 transition-all gap-3 bg-primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    SALVAR TODAS AS CONFIGURAÇÕES
                </Button>
            </CardContent>
        </Card>
    );
};
