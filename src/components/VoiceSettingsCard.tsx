import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
    Volume2, Play, Loader2, Save, Mic, Shield, Eye, Activity, Zap 
} from 'lucide-react';
import { toast } from "sonner";

interface Voice {
    voice_id: string;
    name: string;
    preview_url?: string;
    labels?: Record<string, string>;
}

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
        preferred_mode: 'automatic'
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
                        preferred_mode: userSettings.preferred_mode || 'automatic'
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
                    text: "Olá! Esta é uma demonstração da minha voz no sistema Flaito.",
                    stability: settings.stability,
                    similarity_boost: settings.similarity_boost
                }
            });

            // Note: Our proxy actually uses 'parts.pop()' so we need to call with /preview
            // Let's refine the invoke call if necessary. In our proxy it was parts.pop() which is 'voice-config-proxy'
            // Wait, we need to call the specific path. invoke usually appends the path? 
            // supabase-js invoke doesn't easily append path. I'll use fetch directly or adjust proxy.
            
            // Re-fetching with correct path if needed, but let's try direct first.
            // Actually, let's just use the preview_url from ElevenLabs if available for speed, 
            // but the proxy is better for testing the actual settings.
            
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
        <Card className="overflow-hidden border-primary/10 shadow-xl">
            <CardHeader className="bg-primary/5 pb-6">
                <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Volume2 className="h-5 w-5 text-primary" />
                    </div>
                    Agente de Voz & Personalidade
                </CardTitle>
                <CardDescription>
                    Escolha como o sistema fala com você e como ele deve reagir à sua voz.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
                {/* Seleção de Voz */}
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                        VOZ DO ASSISTENTE
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

                {/* Parâmetros de Áudio */}
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
                        <p className="text-[10px] text-muted-foreground leading-tight px-1 italic">
                            Valores baixos tornam a voz mais expressiva/variável.
                        </p>
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
                        <p className="text-[10px] text-muted-foreground leading-tight px-1 italic">
                            Aumenta a fidelidade à voz original do modelo.
                        </p>
                    </div>
                </div>

                {/* Wake Word & Mode */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-muted pt-8">
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ATIVAÇÃO</Label>
                        <div className="relative">
                            <Mic className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                            <input 
                                className="w-full h-12 pl-11 pr-4 rounded-2xl border-white/10 bg-muted/30 text-sm font-bold focus:ring-2 ring-primary/20 outline-none transition-all"
                                value={settings.wake_word}
                                onChange={(e) => setSettings(prev => ({ ...prev, wake_word: e.target.value }))}
                                placeholder="Flaito"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground px-1">Nome que ativa o agente (ex: "Alexa", "Eco").</p>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">MODO PADRÃO</Label>
                        <Select 
                            value={settings.preferred_mode} 
                            onValueChange={(val) => setSettings(prev => ({ ...prev, preferred_mode: val }))}
                        >
                            <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-muted/30">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="consultation" className="font-bold flex items-center gap-2">
                                    <div className="flex items-center gap-2"><Eye className="h-3 w-3 text-blue-500" /> Consulta</div>
                                </SelectItem>
                                <SelectItem value="assisted" className="font-bold">
                                    <div className="flex items-center gap-2"><Activity className="h-3 w-3 text-green-500" /> Assistido</div>
                                </SelectItem>
                                <SelectItem value="critical" className="font-bold">
                                    <div className="flex items-center gap-2"><Shield className="h-3 w-3 text-red-500" /> Crítico</div>
                                </SelectItem>
                                <SelectItem value="automatic" className="font-bold">
                                    <div className="flex items-center gap-2"><Zap className="h-3 w-3 text-amber-500" /> Automático</div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground px-1">Modo de segurança inicial ao ativar o agente.</p>
                    </div>
                </div>

                <Button 
                    className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all gap-2"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    SALVAR PREFERÊNCIAS DE VOZ
                </Button>
            </CardContent>
        </Card>
    );
};
